import type { GameMode, PlayerId, Settings, Skin, Stage } from '../types';
import type { StateMachine } from '../game/stateMachine';
import { CHANT_BEATS, INTRO_COUNT, INTRO_LINE, INTRO_MS, ROUNDS_TO_WIN } from '../game/constants';
import { seamY } from '../game/geometry';
import { drawPlayerBadge } from './crate';
import { C, button, chunk, display, outlined, star, tracked, ui, vgrad, type Rect } from './theme';

export interface BattleView {
  sm: StateMachine;
  settings: Settings;
  mode: GameMode;
  stage: Stage;
  /** P1's chosen cosmetic thumb. */
  skin: Skin;
  /** P2's thumb — the walnut opponent in solo, a second player's pick in versus. */
  foeSkin: Skin;
  shout: string;
  shoutUntil: number;
  capsEarned: number;
}

/** Flank gauge: PIN on the left, ESCAPE on the right. */
function gauge(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  bottom: number,
  w: number,
  frac: number,
  from: string,
  to: string,
  label: string,
  active: boolean,
): void {
  const h = bottom - top;
  ctx.save();
  ctx.globalAlpha = active ? 1 : 0.45;
  chunk(ctx, { x, y: top, w, h }, { fill: 'rgba(59,42,29,.45)', radius: w / 2, border: 4, borderColor: C.walnutDark });
  const fillH = Math.max(0, Math.min(1, frac)) * (h - 8);
  if (fillH > 1) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 4, top + 4 + (h - 8 - fillH), w - 8, fillH);
    ctx.clip();
    ctx.fillStyle = vgrad(ctx, top, bottom, from, to);
    ctx.fillRect(x + 4, top + 4, w - 8, h - 8);
    ctx.restore();
  }
  ctx.font = ui(10, 800);
  ctx.fillStyle = 'rgba(255,246,232,.9)';
  ctx.save();
  ctx.translate(x + w / 2, bottom + 8);
  ctx.textBaseline = 'top';
  tracked(ctx, label, 0, 0, 1.5);
  ctx.restore();
  ctx.restore();
}

/**
 * A player's name in their own colour. `flip` rotates it 180 degrees for the
 * player sitting at the far end of the phone in a two-player match.
 */
function namePill(
  ctx: CanvasRenderingContext2D,
  name: string,
  color: string,
  x: number,
  y: number,
  flip: boolean,
  w: number,
): void {
  const label = name.toUpperCase();
  ctx.font = display(13);
  const pw = ctx.measureText(label).width + 38;
  ctx.save();
  if (flip) {
    ctx.translate(w / 2, y + 15);
    ctx.rotate(Math.PI);
    ctx.translate(-w / 2, -(y + 15));
    x = w - x - pw;
  }
  chunk(ctx, { x, y, w: pw, h: 30 }, { fill: C.cream, radius: 12, border: 4 });
  ctx.beginPath();
  ctx.arc(x + 17, y + 15, 7, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 30, y + 16);
  ctx.restore();
}

function pips(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  won: number,
  color: string,
  showBadge: PlayerId | null,
): void {
  const gap = 24;
  const start = cx - ((ROUNDS_TO_WIN - 1) / 2) * gap;
  for (let i = 0; i < ROUNDS_TO_WIN; i++) {
    ctx.beginPath();
    ctx.arc(start + i * gap, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = i < won ? color : 'rgba(255,246,232,.25)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  }
  if (showBadge) drawPlayerBadge(ctx, showBadge, start - gap - 4, y, 8);
}

function faults(ctx: CanvasRenderingContext2D, cx: number, y: number, count: number): void {
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.arc(cx - 11 + i * 22, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = C.cherry;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  }
}

export class BattleHud {
  draw(ctx: CanvasRenderingContext2D, v: BattleView, w: number, h: number, now: number): void {
    const { sm, mode, settings } = v;
    const seam = seamY(h);
    const versus = mode.kind === 'versus';

    // Top bar: who you're fighting, and which round it is. In two-player the
    // top thumb belongs to a person reading the phone upside down, so their
    // name pill is rotated for them and P1 gets a matching one at the bottom.
    ctx.textBaseline = 'middle';
    namePill(ctx, versus ? v.foeSkin.name : v.stage.opponent, v.foeSkin.pip, 56, 52, versus, w);
    if (versus) namePill(ctx, v.skin.name, v.skin.pip, 56, h - 82, false, w);

    const roundLabel = `ROUND ${sm.match.roundNumber}`;
    ctx.font = display(14);
    const rw = ctx.measureText(roundLabel).width + 24;
    chunk(ctx, { x: w - 56 - rw, y: 52, w: rw, h: 30 }, { fill: C.ink, radius: 12, border: 0 });
    ctx.fillStyle = C.gold;
    ctx.fillText(roundLabel, w - 56 - rw / 2, 68);

    // Round-win pips, one row per player, each on their own side of the seam.
    pips(ctx, w / 2, 100, sm.match.roundsWon.p2, v.foeSkin.pip, settings.colorblindSafe ? 'p2' : null);
    pips(ctx, w / 2, h - 44, sm.match.roundsWon.p1, v.skin.pip, settings.colorblindSafe ? 'p1' : null);
    faults(ctx, w / 2, 124, sm.thumbs.p2.faults);
    faults(ctx, w / 2, h - 68, sm.thumbs.p1.faults);

    // Flank gauges. Only meaningful during a pin, so they dim otherwise.
    const pinning = sm.phase === 'pin';
    const gTop = 150;
    const gBottom = h - 150;
    gauge(ctx, 14, gTop, gBottom, 26, sm.round.pinMeter, C.gold, C.orange, 'PIN', pinning);
    gauge(ctx, w - 40, gTop, gBottom, 26, sm.escapeProgress, C.tealLight, C.tealDeep, 'FREE', pinning);

    if (sm.phase === 'chant') this.drawBeats(ctx, sm, w, seam);
    if (sm.phase === 'strike') this.drawGo(ctx, w, seam, now);
    if (sm.phase === 'pin') this.drawPinPrompt(ctx, sm, v, w, h);
    // Kept well clear of the seam: a bubble at the contact point hides the
    // exact frame the pin lands, which is the one worth seeing.
    if (v.shout && now < v.shoutUntil) this.drawShout(ctx, v.shout, w, seam - h * 0.155);

    if (sm.phase === 'intro') this.drawIntro(ctx, sm, w, h, now);
    if (sm.phase === 'resolve') this.drawResolve(ctx, sm, v, w, h);
  }

  /** Beat markers sitting on the seam — the chant made visible. */
  private drawBeats(ctx: CanvasRenderingContext2D, sm: StateMachine, w: number, seam: number): void {
    const n = CHANT_BEATS.length;
    const cw = 46;
    const gap = 7;
    const total = n * cw + (n - 1) * gap;
    let x = (w - total) / 2;
    ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const lit = i <= sm.round.beat;
      const last = i === n - 1;
      chunk(
        ctx,
        { x, y: seam - 22, w: cw, h: 44 },
        {
          fill: lit ? (last ? C.gold : C.cream) : 'rgba(255,246,232,.28)',
          radius: 13,
          border: 4,
          drop: lit ? 4 : 0,
        },
      );
      ctx.font = display(lit ? 17 : 15);
      ctx.fillStyle = lit ? C.ink : 'rgba(34,29,43,.5)';
      ctx.textAlign = 'center';
      ctx.fillText(CHANT_BEATS[i], x + cw / 2, seam + 1);
      x += cw + gap;
    }
  }

  private drawGo(ctx: CanvasRenderingContext2D, w: number, seam: number, now: number): void {
    const pulse = 1 + 0.07 * Math.sin(now / 70);
    outlined(ctx, 'GO!', w / 2, seam + 14, display(Math.round(52 * pulse)), C.gold, 10, C.ink);
  }

  private drawShout(ctx: CanvasRenderingContext2D, text: string, w: number, y: number): void {
    ctx.font = display(34);
    const tw = ctx.measureText(text).width + 44;
    ctx.save();
    ctx.translate(w / 2, y);
    ctx.rotate(-0.09);
    chunk(ctx, { x: -tw / 2, y: -30, w: tw, h: 60 }, { fill: C.gold, radius: 18, border: 6, drop: 6 });
    ctx.fillStyle = C.cherry;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 2);
    ctx.restore();
  }

  /** Tells the trapped player, and only the trapped player, to hammer their half. */
  private drawPinPrompt(
    ctx: CanvasRenderingContext2D,
    sm: StateMachine,
    v: BattleView,
    w: number,
    h: number,
  ): void {
    if (!sm.round.pinner) return;
    const trapped: PlayerId = sm.round.pinner === 'p1' ? 'p2' : 'p1';
    // In solo play the computer's struggle needs no prompt.
    if (v.mode.kind === 'solo' && trapped === 'p2') return;
    const y = trapped === 'p1' ? h * 0.86 : h * 0.14;
    ctx.save();
    if (trapped === 'p2') {
      ctx.translate(w / 2, y);
      ctx.rotate(Math.PI);
      ctx.translate(-w / 2, -y);
    }
    outlined(ctx, 'TAP FAST!', w / 2, y, display(40), C.cream, 9, C.ink);
    ctx.restore();
  }

  /** "1, 2, 3, 4 — I declare a thumb war!" Runs once at the top of a match. */
  private drawIntro(
    ctx: CanvasRenderingContext2D,
    sm: StateMachine,
    w: number,
    h: number,
    now: number,
  ): void {
    const p = sm.introProgress(now);
    ctx.fillStyle = 'rgba(34,29,43,.6)';
    ctx.fillRect(0, 0, w, h);

    const lit = Math.floor(p * INTRO_MS / (INTRO_MS / 6));
    const cw = 62;
    const gap = 10;
    const total = INTRO_COUNT.length * cw + (INTRO_COUNT.length - 1) * gap;
    let x = (w - total) / 2;
    const y = h * 0.4;

    ctx.textBaseline = 'middle';
    ctx.font = ui(13, 800);
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    tracked(ctx, 'ROUND INTRO', w / 2, y - 56, 3);

    for (let i = 0; i < INTRO_COUNT.length; i++) {
      const on = i < lit;
      const now_ = i === lit - 1;
      const bump = now_ ? 4 : 0;
      chunk(
        ctx,
        { x: x - bump / 2, y: y - cw / 2 - bump / 2, w: cw + bump, h: cw + bump },
        {
          fill: on ? (i === INTRO_COUNT.length - 1 ? C.gold : C.cream) : 'rgba(255,255,255,.22)',
          radius: 18,
          border: 5,
          borderColor: on ? C.ink : 'rgba(255,255,255,.55)',
          drop: on ? 5 : 0,
        },
      );
      ctx.font = display(30);
      ctx.fillStyle = on ? C.ink : 'rgba(255,255,255,.85)';
      ctx.textAlign = 'center';
      ctx.fillText(INTRO_COUNT[i], x + cw / 2, y + 1);
      x += cw + gap;
    }

    if (lit >= INTRO_COUNT.length) {
      outlined(ctx, INTRO_LINE, w / 2, y + 82, display(22), C.white, 7, C.ink);
    }
  }

  private drawResolve(
    ctx: CanvasRenderingContext2D,
    sm: StateMachine,
    v: BattleView,
    w: number,
    h: number,
  ): void {
    if (!sm.round.winner) return;
    const you = sm.round.winner === 'p1';
    const label =
      v.mode.kind === 'solo'
        ? you
          ? 'Point: you'
          : `Point: ${v.stage.opponent}`
        : `Point: ${you ? v.skin.name : v.foeSkin.name}`;
    ctx.font = display(30);
    const tw = ctx.measureText(label).width + 56;
    chunk(
      ctx,
      { x: (w - tw) / 2, y: seamY(h) - 40, w: tw, h: 80 },
      { fill: C.cream, radius: 24, border: 6, drop: 8 },
    );
    ctx.fillStyle = v.mode.kind === 'solo' ? (you ? C.teal : C.cherry) : C.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, seamY(h) + 2);
  }
}

/** Buttons on the end-of-match card. Returned so main.ts can hit-test them. */
export function matchEndButtons(w: number, h: number, canAdvance: boolean): Record<string, Rect> {
  const cardX = 24;
  const cardW = w - 48;
  const cardY = h * 0.3;
  const cardH = 330;
  const bw = (cardW - 40 - 12) / 2;
  const by = cardY + cardH - 82;
  return {
    primary: { x: cardX + 20, y: by, w: canAdvance ? bw : cardW - 40, h: 56 },
    rematch: { x: cardX + 20 + bw + 12, y: by, w: bw, h: 56 },
    menu: { x: w / 2 - 70, y: cardY + cardH + 22, w: 140, h: 48 },
  };
}

export function drawMatchEnd(
  ctx: CanvasRenderingContext2D,
  v: BattleView,
  w: number,
  h: number,
  canAdvance: boolean,
  pressed: string | null,
): void {
  const { sm, mode, stage } = v;
  const won = sm.match.matchWinner === 'p1';
  ctx.fillStyle = C.scrim;
  ctx.fillRect(0, 0, w, h);

  const cardX = 24;
  const cardW = w - 48;
  const cardY = h * 0.3;
  const cardH = 330;
  chunk(ctx, { x: cardX, y: cardY, w: cardW, h: cardH }, { fill: C.cream, radius: 28, border: 6, drop: 9 });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const title =
    mode.kind === 'versus'
      ? `${(won ? v.skin.name : v.foeSkin.name).toUpperCase()}!`
      : won
        ? 'PINNED!'
        : 'OUCH!';
  ctx.font = display(mode.kind === 'versus' && title.length > 11 ? 34 : 46);
  ctx.fillStyle = mode.kind === 'versus' ? (won ? v.skin.pip : v.foeSkin.pip) : won ? C.cherry : C.grey;
  ctx.fillText(title, w / 2, cardY + 54);

  const sub =
    mode.kind === 'versus'
      ? `${v.skin.name} ${sm.match.roundsWon.p1}\u2013${sm.match.roundsWon.p2} ${v.foeSkin.name}`
      : won
        ? `${stage.opponent} taps out`
        : `${stage.opponent} pinned you`;
  ctx.font = display(15);
  ctx.fillStyle = C.grey;
  ctx.fillText(sub, w / 2, cardY + 88);

  // Stars: one per round you took, so the readout matches the scoreline.
  const stars = sm.match.roundsWon.p1;
  for (let i = 0; i < ROUNDS_TO_WIN; i++) {
    const x = w / 2 - 68 + i * 68;
    const on = i < stars;
    ctx.beginPath();
    ctx.arc(x, cardY + 140, 26, 0, Math.PI * 2);
    ctx.fillStyle = on ? C.gold : C.creamDim;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    star(ctx, x, cardY + 141, 15, on ? C.ink : C.greyDim);
  }

  if (v.capsEarned > 0) {
    ctx.beginPath();
    ctx.arc(w / 2 - 58, cardY + 196, 11, 0, Math.PI * 2);
    ctx.fillStyle = C.gold;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.font = display(20);
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.fillText(`+${v.capsEarned} caps`, w / 2 - 40, cardY + 198);
    ctx.textAlign = 'center';
  }

  const b = matchEndButtons(w, h, canAdvance);
  button(ctx, b.primary, canAdvance ? 'Next stage' : 'Rematch', {
    fill: C.teal,
    text: C.white,
    shadow: C.tealShadow,
    radius: 20,
    font: display(18),
    drop: 6,
    pressed: pressed === 'primary',
  });
  if (canAdvance) {
    button(ctx, b.rematch, 'Rematch', {
      fill: C.white,
      text: C.ink,
      radius: 20,
      font: display(18),
      drop: 6,
      pressed: pressed === 'rematch',
    });
  }
  button(ctx, b.menu, 'Menu', {
    fill: 'rgba(255,246,232,.14)',
    text: C.cream,
    border: 3,
    borderColor: 'rgba(255,246,232,.7)',
    radius: 18,
    font: display(17),
    drop: 0,
    pressed: pressed === 'menu',
  });
}
