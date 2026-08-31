import type { Difficulty, PlayerId } from '../types';
import type { StateMachine } from './stateMachine';
import { CHANT_BEATS } from './constants';
import { hitboxPx, swingBounds } from './geometry';

/**
 * The computer opponent (Blue). It plays through the same public input API a
 * human uses — press / aim / move / release — so the state machine needs no
 * knowledge of whether a player is human.
 *
 * It both ATTACKS and DEFENDS:
 *   attack  — lines its thumb up with yours, then strikes on "three!"
 *   defense — slides away to break your alignment so your strike whiffs,
 *             and rapid-taps to escape when you pin it.
 * Difficulty is expressed purely as reaction time, accuracy, and tap rate.
 */

interface AiTuning {
  /** Mean reaction time (ms) after the strike window opens. */
  reactionMs: number;
  /** Jitter (± ms) added to reaction time. */
  jitterMs: number;
  /** Chance per chant of striking early (a fault). */
  faultChance: number;
  /** Escape taps per second while pinned. */
  escapeTapsPerSec: number;
  /** Lateral tracking speed, px per frame at 60fps. */
  trackSpeed: number;
  /** Chance per chant that it plays defensively (dodges) instead of chasing. */
  dodgeChance: number;
  /** How sloppily it aims — px of deliberate offset when attacking. */
  aimErrorPx: number;
  /**
   * How long it will hold its swing waiting for alignment before swinging
   * anyway. 0 = swings blind the moment its reaction timer fires.
   */
  patienceMs: number;
}

const TUNING: Record<Difficulty, AiTuning> = {
  rookie: {
    reactionMs: 470,
    jitterMs: 220,
    faultChance: 0.075,
    escapeTapsPerSec: 3.2,
    trackSpeed: 2.2,
    dodgeChance: 0.15,
    aimErrorPx: 55,
    patienceMs: 0,
  },
  contender: {
    reactionMs: 310,
    jitterMs: 160,
    faultChance: 0.015,
    escapeTapsPerSec: 6.4,
    trackSpeed: 4.5,
    dodgeChance: 0.35,
    aimErrorPx: 22,
    patienceMs: 420,
  },
  champ: {
    reactionMs: 240,
    jitterMs: 120,
    faultChance: 0.004,
    escapeTapsPerSec: 8,
    trackSpeed: 7,
    dodgeChance: 0.5,
    aimErrorPx: 6,
    patienceMs: 950,
  },
};

export class AiController {
  private strikeAt: number | null = null;
  private faultAt: number | null = null;
  private lastEscapeTap = 0;
  /** Re-rolled each chant: is it dodging (defense) or chasing (attack) this round? */
  private dodgingThisChant = false;
  private lastPhase = '';
  private dodgeTarget = 0;

  constructor(
    private sm: StateMachine,
    private player: PlayerId = 'p2',
    private difficulty: Difficulty = 'contender',
  ) {}

  setDifficulty(d: Difficulty): void {
    this.difficulty = d;
  }

  /** Call once per frame from the game loop. */
  tick(now: number): void {
    const t = TUNING[this.difficulty];
    const phase = this.sm.phase;
    const me = this.sm.thumbs[this.player];
    const foe = this.sm.thumbs[this.player === 'p2' ? 'p1' : 'p2'];
    const w = this.sm.width;

    // New chant → decide this round's plan and maybe schedule an early-strike fault.
    if (phase === 'chant' && this.lastPhase !== 'chant') {
      this.dodgingThisChant = Math.random() < t.dodgeChance;
      this.dodgeTarget = this.pickDodgeSpot(foe.pos.x, w);
      this.faultAt =
        Math.random() < t.faultChance
          ? now + 200 + Math.random() * (CHANT_BEATS.length - 2) * 400
          : null;
      this.strikeAt = null;
    }
    this.lastPhase = phase;

    switch (phase) {
      case 'chant':
        this.maneuver(now, t, me.pos.x, foe.pos.x, w);
        // Commit an early strike if this chant's fault roll said so.
        if (this.faultAt !== null && now >= this.faultAt) {
          this.faultAt = null;
          this.swipe(now);
        }
        break;

      case 'strike': {
        // The window is open: stop dodging and close in. Dodging was a chant-phase
        // tactic to spoil the human's aim; swinging while out of line would just
        // whiff and hand them a free counter.
        this.dodgingThisChant = false;
        this.maneuver(now, t, me.pos.x, foe.pos.x, w);

        if (this.strikeAt === null) {
          const jitter = (Math.random() * 2 - 1) * t.jitterMs;
          this.strikeAt = now + t.reactionMs + jitter;
        }
        if (now >= this.strikeAt) {
          const patienceExpired = now >= this.strikeAt + t.patienceMs;
          // Swing when the thumbs actually line up — or when patience runs out.
          if (this.sm.aligned || patienceExpired) {
            this.swipe(now);
            this.strikeAt = null;
          }
        }
        break;
      }

      case 'pin':
        // Defense: fight out of a pin by rapid tapping.
        if (this.sm.round.pinner !== this.player) {
          const interval = 1000 / t.escapeTapsPerSec;
          if (now - this.lastEscapeTap >= interval) {
            this.lastEscapeTap = now;
            this.sm.press(this.player, { x: me.pos.x, y: me.pos.y }, now);
            this.sm.release(this.player);
          }
        }
        break;

      default:
        this.strikeAt = null;
        break;
    }
  }

  /**
   * Lateral movement. Attacking = close the gap onto the opponent's thumb.
   * Defending = slide away so their strike can't connect.
   */
  private maneuver(now: number, t: AiTuning, myX: number, foeX: number, w: number): void {
    const target = this.dodgingThisChant ? this.dodgeTarget : foeX + this.aimJitter(t);
    const dx = target - myX;
    const step = Math.sign(dx) * Math.min(Math.abs(dx), t.trackSpeed);
    const next = myX + step;
    this.sm.aim(this.player, next);
    // Keep the thumb "held" so it renders in its ready pose.
    this.sm.press(this.player, { x: next, y: this.sm.thumbs[this.player].pos.y }, now);
    // Re-pick a dodge spot once it arrives, so it keeps moving.
    if (this.dodgingThisChant && Math.abs(dx) < 4) {
      this.dodgeTarget = this.pickDodgeSpot(foeX, w);
    }
  }

  /** A spot far enough from the opponent that their strike would whiff. */
  private pickDodgeSpot(foeX: number, w: number): number {
    const h = this.sm.height;
    const safe = hitboxPx(h) * 1.5;
    const { min, max } = swingBounds(w, h);
    const left = foeX - safe;
    const right = foeX + safe;
    const canLeft = left > min;
    const canRight = right < max;
    if (canLeft && canRight) return Math.random() < 0.5 ? left : right;
    if (canLeft) return left;
    if (canRight) return right;
    return (min + max) / 2;
  }

  private aimJitter(t: AiTuning): number {
    return (Math.random() * 2 - 1) * t.aimErrorPx;
  }

  private swipe(now: number): void {
    const me = this.sm.thumbs[this.player];
    const start = { x: me.pos.x, y: me.pos.y };
    this.sm.press(this.player, start, now);
    this.sm.move(this.player, { x: start.x, y: start.y + this.sm.height * 0.12 }, now, this.sm.height * 0.06);
    this.sm.release(this.player);
  }
}
