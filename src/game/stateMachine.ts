import type { ChantSpeed, GamePhase, MatchState, PlayerId, RoundState, ThumbState, Vec2 } from '../types';
import { DESIGN_H, DESIGN_W, HOLE_Y, hitboxPx, swingBounds } from './geometry';
import {
  BEAT_MS,
  CHANT_BEATS,
  CLASH_MS,
  CLASH_WINDOW_MS,
  ESCAPE_DECAY_MS,
  ESCAPE_FATIGUE,
  ESCAPE_TAP_VALUE,
  ESCAPE_THRESHOLD,
  FAULT_MEMORY_CHANTS,
  FAULTS_TO_FORFEIT,
  INTRO_MS,
  LUNGE_REACH,
  PIN_DURATION_MS,
  PIN_INITIAL_ADVANTAGE,
  PIN_REACH_PINNED,
  PIN_REACH_PINNER,
  REACH_EASE,
  RESOLVE_MS,
  ROUNDS_TO_WIN,
  WHIFF_RECOVERY_MS,
} from './constants';

/** Events the state machine emits so audio/haptics/rendering can react without coupling. */
export type GameEvent =
  | { type: 'introBeat'; index: number }
  | { type: 'beat'; beat: number; label: string }
  | { type: 'strikeOpen' }
  | { type: 'strikeLanded'; by: PlayerId }
  | { type: 'whiff'; by: PlayerId }
  | { type: 'clash' }
  | { type: 'fault'; by: PlayerId; count: number }
  | { type: 'forfeit'; by: PlayerId }
  | { type: 'pinStart'; pinner: PlayerId }
  | { type: 'escapeTap'; by: PlayerId }
  | { type: 'escaped'; by: PlayerId }
  | { type: 'roundWon'; by: PlayerId }
  | { type: 'matchWon'; by: PlayerId };

export type EventListener = (evt: GameEvent) => void;

function freshThumb(x: number, y: number): ThumbState {
  return {
    pos: { x, y },
    strikeStart: null,
    strikeAt: null,
    holding: false,
    squash: 1,
    reach: 0,
    reachTarget: 0,
    faultChants: [],
    faults: 0,
    whiffed: false,
  };
}

function freshRound(now: number, phase: GamePhase = 'chant'): RoundState {
  return {
    phase,
    beat: -1,
    chantCount: 0,
    phaseStart: now,
    pinner: null,
    pinMeter: 0,
    escapeTaps: 0,
    escapeCredit: 0,
    escapesUsed: { p1: 0, p2: 0 },
    winner: null,
  };
}

/**
 * The heart of the game. Pure logic: no canvas, no Capacitor, no DOM.
 * Input adapters push touch events in; the AI controller uses the exact
 * same public methods, so single-player needs no special-casing here.
 */
export class StateMachine {
  round: RoundState;
  match: MatchState = { roundsWon: { p1: 0, p2: 0 }, roundNumber: 1, matchWinner: null };
  thumbs: Record<PlayerId, ThumbState>;

  /** Design-space layout size, needed for hitbox math. Kept in sync by the renderer. */
  private w = DESIGN_W;
  private h = DESIGN_H;

  private listeners: EventListener[] = [];
  private beatMs: number;
  /** Pending strike waiting out the clash window. */
  private pendingStrike: { by: PlayerId; at: number } | null = null;
  /** Whiff recovery timers: player → time their exposure ends. */
  private whiffUntil: Partial<Record<PlayerId, number>> = {};
  /** Last frame time the pin meter was integrated, for credit decay. */
  private lastPinTick = 0;
  /** Highest intro card lit so far, so each one fires its beep once. */
  private introBeat = -1;

  constructor(chantSpeed: ChantSpeed, now: number) {
    this.beatMs = BEAT_MS[chantSpeed];
    this.round = freshRound(now);
    this.thumbs = {
      p1: freshThumb(this.w / 2, this.h * HOLE_Y.p1),
      p2: freshThumb(this.w / 2, this.h * HOLE_Y.p2),
    };
  }

  setLayout(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  get width(): number {
    return this.w;
  }
  get height(): number {
    return this.h;
  }

  setChantSpeed(speed: ChantSpeed): void {
    this.beatMs = BEAT_MS[speed];
  }

  on(listener: EventListener): void {
    this.listeners.push(listener);
  }

  private emit(evt: GameEvent): void {
    for (const l of this.listeners) l(evt);
  }

  get phase(): GamePhase {
    return this.round.phase;
  }

  /** 0..1 progress through the pre-match declaration, for the intro overlay. */
  introProgress(now: number): number {
    if (this.round.phase !== 'intro') return 1;
    return Math.min(1, (now - this.round.phaseStart) / INTRO_MS);
  }

  /** Horizontal gap between the two thumbs, in design px. */
  get alignmentGap(): number {
    return Math.abs(this.thumbs.p1.pos.x - this.thumbs.p2.pos.x);
  }

  /** True when the thumb tips actually overlap on screen. */
  get aligned(): boolean {
    return this.alignmentGap <= hitboxPx(this.h);
  }

  /** Clamp a thumb's lateral position to the range a real thumb could swing. */
  private clampSwing(x: number): number {
    const { min, max } = swingBounds(this.w, this.h);
    return Math.max(min, Math.min(max, x));
  }

  private setPhase(phase: GamePhase, now: number): void {
    this.round.phase = phase;
    this.round.phaseStart = now;
  }

  /** Called every frame by the game loop. */
  update(now: number): void {
    switch (this.round.phase) {
      case 'intro':
        this.updateIntro(now);
        break;
      case 'chant':
        this.updateChant(now);
        break;
      case 'strike':
        this.updateStrike(now);
        break;
      case 'clash':
        if (now - this.round.phaseStart >= CLASH_MS) this.restartChant(now);
        break;
      case 'pin':
        this.updatePin(now);
        break;
      case 'resolve':
        if (now - this.round.phaseStart >= RESOLVE_MS) this.nextRound(now);
        break;
      case 'matchEnd':
        break;
    }
    this.updateThumbAnimation(now);
  }

  private updateIntro(now: number): void {
    const elapsed = now - this.round.phaseStart;
    const card = Math.floor(elapsed / (INTRO_MS / 6));
    if (card !== this.introBeat && card < 4) {
      this.introBeat = card;
      this.emit({ type: 'introBeat', index: card });
    }
    if (elapsed >= INTRO_MS) {
      this.round.beat = -1;
      this.setPhase('chant', now);
    }
  }

  /** Eases squash and reach toward their targets — this is what makes thumbs meet. */
  private updateThumbAnimation(now: number): void {
    for (const id of ['p1', 'p2'] as PlayerId[]) {
      const t = this.thumbs[id];
      t.squash += (1 - t.squash) * 0.12;

      // Decide where this thumb should be reaching right now.
      if (this.round.phase === 'pin' && this.round.pinner) {
        t.reachTarget = id === this.round.pinner ? PIN_REACH_PINNER : PIN_REACH_PINNED;
      } else if (this.round.phase === 'clash') {
        t.reachTarget = LUNGE_REACH; // both lunging, thumbs colliding on the seam
      } else if (t.whiffed && now < (this.whiffUntil[id] ?? 0)) {
        t.reachTarget = LUNGE_REACH * 0.9; // stuck out, exposed
      } else if (this.round.phase === 'chant' || this.round.phase === 'strike') {
        t.reachTarget = t.holding ? 0.12 : 0; // small ready-pose lean
      } else {
        t.reachTarget = 0;
      }

      // Clear whiff exposure once recovered.
      if (t.whiffed && now >= (this.whiffUntil[id] ?? 0)) t.whiffed = false;

      t.reach += (t.reachTarget - t.reach) * REACH_EASE;
    }
  }

  private updateChant(now: number): void {
    const beat = Math.floor((now - this.round.phaseStart) / this.beatMs);
    if (beat !== this.round.beat && beat < CHANT_BEATS.length) {
      this.round.beat = beat;
      this.emit({ type: 'beat', beat, label: CHANT_BEATS[beat] });
      if (beat === CHANT_BEATS.length - 1) {
        this.setPhase('strike', now);
        this.emit({ type: 'strikeOpen' });
      }
    }
  }

  /**
   * The strike window has no timeout. Once the chant has been said the thumbs
   * stay live until one of them lands a pin — a standoff is part of the game,
   * and looping back to the chant after a second and a half made the match feel
   * like it kept restarting instead of resolving. The chant is re-counted for
   * the NEXT attempt, which a clash, an escape or a round win all trigger.
   */
  private updateStrike(now: number): void {
    // Recovering from a whiff clears the "already swung" flag. Without this the
    // open-ended window deadlocks: a player who whiffs can never swing again,
    // so if both of them miss, the round has no way to end.
    for (const id of ['p1', 'p2'] as PlayerId[]) {
      const until = this.whiffUntil[id];
      if (until !== undefined && now >= until) {
        this.thumbs[id].strikeAt = null;
        delete this.whiffUntil[id];
      }
    }
    if (this.pendingStrike && now - this.pendingStrike.at >= CLASH_WINDOW_MS) {
      const by = this.pendingStrike.by;
      this.pendingStrike = null;
      this.startPin(by, now);
    }
  }

  private updatePin(now: number): void {
    // Escape credit decays, so breaking out needs a sustained fast tap rate.
    const dt = Math.max(0, now - this.lastPinTick);
    this.lastPinTick = now;
    this.round.escapeCredit *= Math.exp(-dt / ESCAPE_DECAY_MS);

    // Reaching the (fatigue-adjusted) threshold frees you, however far the pin has run.
    if (this.round.pinner && this.round.escapeCredit >= this.escapeRequirement) {
      const escapee = this.other(this.round.pinner);
      this.round.escapesUsed[escapee] += 1;
      this.emit({ type: 'escaped', by: escapee });
      this.restartChant(now);
      return;
    }

    // Otherwise the pin timer runs to a win.
    const held = (now - this.round.phaseStart) / PIN_DURATION_MS;
    this.round.pinMeter = Math.max(
      0,
      Math.min(1, PIN_INITIAL_ADVANTAGE + held * (1 - PIN_INITIAL_ADVANTAGE)),
    );
    if (this.round.pinMeter >= 1 && this.round.pinner) this.winRound(this.round.pinner, now);
  }

  /** Credit the trapped player currently needs — rises with each escape they've used. */
  get escapeRequirement(): number {
    if (!this.round.pinner) return ESCAPE_THRESHOLD;
    const trapped = this.other(this.round.pinner);
    return ESCAPE_THRESHOLD * (1 + ESCAPE_FATIGUE * this.round.escapesUsed[trapped]);
  }

  /** 0..1 — how close the trapped player is to breaking free. Drives the UI bar. */
  get escapeProgress(): number {
    return Math.min(1, this.round.escapeCredit / this.escapeRequirement);
  }

  // ---- Input API (touch adapter and AI controller both call these) ----

  /** Player's finger lands in their zone (or the AI places its thumb). */
  press(player: PlayerId, pos: Vec2, _now: number): void {
    const t = this.thumbs[player];
    t.holding = true;
    t.pos = { x: this.clampSwing(pos.x), y: t.pos.y }; // lateral only; depth comes from reach
    t.strikeStart = pos;

    if (this.round.phase === 'pin' && this.round.pinner && player !== this.round.pinner) {
      this.round.escapeTaps += 1;
      this.round.escapeCredit += ESCAPE_TAP_VALUE;
      t.squash = 1.35;
      this.emit({ type: 'escapeTap', by: player });
    }
  }

  /** Slide sideways to line up your thumb; a big enough push toward the seam strikes. */
  move(player: PlayerId, pos: Vec2, now: number, swipeThresholdPx: number): void {
    const t = this.thumbs[player];
    if (!t.holding) return;
    t.pos = { x: this.clampSwing(pos.x), y: t.pos.y };
    if (!t.strikeStart) return;

    const dy = Math.abs(t.strikeStart.y - pos.y);
    const dx = Math.abs(t.strikeStart.x - pos.x);
    if (Math.hypot(dx, dy) < swipeThresholdPx) return;
    // Sideways drags are aiming, not striking.
    if (dy < dx) return;

    if (this.round.phase === 'strike') this.registerStrike(player, now);
    else if (this.round.phase === 'chant') this.registerFault(player, now);
    t.strikeStart = null; // one swipe per touch
  }

  release(player: PlayerId): void {
    const t = this.thumbs[player];
    t.holding = false;
    t.strikeStart = null;
  }

  /** Move a thumb laterally without touching strike logic (used by the AI to dodge). */
  aim(player: PlayerId, x: number): void {
    this.thumbs[player].pos.x = this.clampSwing(x);
  }

  startMatch(now: number): void {
    this.match = { roundsWon: { p1: 0, p2: 0 }, roundNumber: 1, matchWinner: null };
    this.thumbs = {
      p1: freshThumb(this.w / 2, this.h * HOLE_Y.p1),
      p2: freshThumb(this.w / 2, this.h * HOLE_Y.p2),
    };
    this.whiffUntil = {};
    this.pendingStrike = null;
    this.introBeat = -1;
    this.round = freshRound(now, 'intro');
  }

  // ---- Internals ----

  private registerStrike(player: PlayerId, now: number): void {
    const t = this.thumbs[player];
    if (t.strikeAt !== null) return; // already struck this window
    t.strikeAt = now;
    t.squash = 1.5;

    // A strike only connects if the thumbs actually overlap.
    if (!this.aligned) {
      t.whiffed = true;
      this.whiffUntil[player] = now + WHIFF_RECOVERY_MS;
      this.emit({ type: 'whiff', by: player });
      // The opponent gets a fresh chance to punish: reopen their strike window.
      this.thumbs[this.other(player)].strikeAt = null;
      return;
    }

    this.emit({ type: 'strikeLanded', by: player });

    if (this.pendingStrike && this.pendingStrike.by !== player) {
      if (now - this.pendingStrike.at < CLASH_WINDOW_MS) {
        this.pendingStrike = null;
        this.setPhase('clash', now);
        this.emit({ type: 'clash' });
        return;
      }
    }
    if (!this.pendingStrike) this.pendingStrike = { by: player, at: now };
  }

  private registerFault(player: PlayerId, now: number): void {
    const t = this.thumbs[player];
    t.faultChants.push(this.round.chantCount);
    // Drop faults that have aged out of the memory window.
    const oldest = this.round.chantCount - FAULT_MEMORY_CHANTS;
    t.faultChants = t.faultChants.filter((c) => c > oldest);
    t.faults = t.faultChants.length;
    t.squash = 0.7;
    this.emit({ type: 'fault', by: player, count: t.faults });
    if (t.faults >= FAULTS_TO_FORFEIT) {
      this.emit({ type: 'forfeit', by: player });
      this.winRound(this.other(player), now);
    }
  }

  private startPin(pinner: PlayerId, now: number): void {
    this.round.pinner = pinner;
    this.round.pinMeter = PIN_INITIAL_ADVANTAGE;
    this.round.escapeTaps = 0;
    this.round.escapeCredit = 0;
    this.lastPinTick = now;
    // Snap the pinned thumb under the pinner so contact reads cleanly.
    const pinned = this.other(pinner);
    this.thumbs[pinned].pos.x = this.thumbs[pinner].pos.x;
    this.setPhase('pin', now);
    this.emit({ type: 'pinStart', pinner });
  }

  private restartChant(now: number): void {
    this.round.beat = -1;
    this.round.pinner = null;
    this.round.pinMeter = 0;
    this.round.escapeTaps = 0;
    this.round.escapeCredit = 0; // fatigue (escapesUsed) deliberately persists
    this.pendingStrike = null;
    this.whiffUntil = {};
    this.round.chantCount += 1;
    for (const id of ['p1', 'p2'] as PlayerId[]) {
      const t = this.thumbs[id];
      t.strikeAt = null;
      t.whiffed = false;
      // Expire stale faults so long rounds don't accumulate a forfeit.
      const oldest = this.round.chantCount - FAULT_MEMORY_CHANTS;
      t.faultChants = t.faultChants.filter((c) => c > oldest);
      t.faults = t.faultChants.length;
    }
    this.setPhase('chant', now);
  }

  private winRound(player: PlayerId, now: number): void {
    this.round.winner = player;
    this.match.roundsWon[player] += 1;
    this.emit({ type: 'roundWon', by: player });
    if (this.match.roundsWon[player] >= ROUNDS_TO_WIN) {
      this.match.matchWinner = player;
      this.setPhase('matchEnd', now);
      this.emit({ type: 'matchWon', by: player });
    } else {
      this.setPhase('resolve', now);
    }
  }

  private nextRound(now: number): void {
    this.match.roundNumber += 1;
    for (const id of ['p1', 'p2'] as PlayerId[]) {
      this.thumbs[id].faults = 0;
      this.thumbs[id].faultChants = [];
      this.thumbs[id].strikeAt = null;
      this.thumbs[id].whiffed = false;
    }
    this.pendingStrike = null;
    this.whiffUntil = {};
    this.round = freshRound(now);
  }

  private other(p: PlayerId): PlayerId {
    return p === 'p1' ? 'p2' : 'p1';
  }
}
