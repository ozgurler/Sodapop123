import type { SaveData, Skin } from '../types';
import { SKINS, STAGES, skinById } from '../game/content';
import { drawThumbPortrait } from './crate';
import {
  C,
  button,
  chevron,
  chunk,
  display,
  note,
  roundRectPath,
  star,
  tracked,
  ui,
  vgrad,
  type Rect,
} from './theme';

/** Everything the menu screens need to draw themselves. */
export interface MenuView {
  save: SaveData;
  /** Index into SKINS the picker is previewing (may be locked). */
  skinCursor: number;
  /** Index into STAGES the carousel is showing. */
  stageCursor: number;
  soundOn: boolean;
  /** The how-to-play card is up; it swallows every tap until dismissed. */
  helpOpen: boolean;
  pressed: string | null;
  /** Transient message under the primary button ("Not enough caps"). */
  toast: string;
}

// ---------------------------------------------------------------- shared bits

function stripes(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  angle: number,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.translate(w / 2, h / 2);
  ctx.rotate(angle);
  for (let x = -h; x < h; x += 52) ctx.fillRect(x, -h, 26, h * 2);
  ctx.restore();
}

function header(
  ctx: CanvasRenderingContext2D,
  w: number,
  title: string,
  back: Rect,
  pressed: string | null,
): void {
  button(ctx, back, '', {
    fill: C.cream,
    text: C.ink,
    radius: 18,
    drop: 4,
    pressed: pressed === 'back',
  });
  chevron(ctx, back.x + back.w / 2 + 2, back.y + back.h / 2 + (pressed === 'back' ? 4 : 0), 9, -1, C.ink);
  ctx.font = display(18);
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(title).width + 36;
  chunk(ctx, { x: (w - tw) / 2, y: back.y + 11, w: tw, h: 34 }, { fill: C.gold, radius: 14, border: 4 });
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  ctx.fillText(title, w / 2, back.y + 29);
}

function capsChip(ctx: CanvasRenderingContext2D, right: number, y: number, caps: number): void {
  ctx.font = display(15);
  ctx.textBaseline = 'middle';
  const label = caps.toLocaleString('en-US');
  const cw = ctx.measureText(label).width + 48;
  chunk(ctx, { x: right - cw, y, w: cw, h: 34 }, { fill: C.cream, radius: 17, border: 4 });
  ctx.beginPath();
  ctx.arc(right - cw + 21, y + 17, 8, 0, Math.PI * 2);
  ctx.fillStyle = C.gold;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'left';
  ctx.fillText(label, right - cw + 34, y + 18);
}

function toast(ctx: CanvasRenderingContext2D, text: string, w: number, y: number): void {
  if (!text) return;
  ctx.font = ui(13, 800);
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, y);
}

// ------------------------------------------------------------------ 1a title

export function titleLayout(w: number, h: number): Record<string, Rect> {
  const bw = w - 52;
  const iconY = h - 84;
  const ix = w / 2;
  return {
    solo: { x: 26, y: h - 300, w: bw, h: 92 },
    versus: { x: 26, y: h - 196, w: bw, h: 92 },
    sound: { x: ix - 108, y: iconY, w: 64, h: 64 },
    thumbs: { x: ix - 32, y: iconY, w: 64, h: 64 },
    help: { x: ix + 44, y: iconY, w: 64, h: 64 },
    helpClose: { x: 46, y: h / 2 + 112, w: w - 92, h: 60 },
  };
}

const HELP_LINES: Array<[string, string]> = [
  ['Line up', 'Slide your thumb left and right. The guide turns solid gold when you can actually reach.'],
  ['Strike', 'Swipe toward the middle on "3!". Swipe early and it is a fault \u2014 two faults lose the round.'],
  ['Escape', 'Pinned? Tap your half as fast as you can before the PIN gauge fills.'],
  ['Win', 'First to three rounds takes the crate.'],
];

/** How to play. Drawn over the title screen; `helpClose` is the only live region. */
export function drawHelp(ctx: CanvasRenderingContext2D, v: MenuView, w: number, h: number): void {
  ctx.fillStyle = C.scrim;
  ctx.fillRect(0, 0, w, h);

  const card: Rect = { x: 26, y: h / 2 - 250, w: w - 52, h: 424 };
  chunk(ctx, card, { fill: C.cream, radius: 28, border: 6, drop: 9 });

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = display(28);
  ctx.fillStyle = C.ink;
  ctx.fillText('How to play', w / 2, card.y + 44);

  let y = card.y + 92;
  HELP_LINES.forEach(([title, body], i) => {
    ctx.beginPath();
    ctx.arc(card.x + 34, y + 8, 15, 0, Math.PI * 2);
    ctx.fillStyle = [C.blue, C.cherry, C.teal, C.gold][i];
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.font = display(15);
    ctx.fillStyle = C.white;
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), card.x + 34, y + 9);

    ctx.textAlign = 'left';
    ctx.font = display(17);
    ctx.fillStyle = C.ink;
    ctx.fillText(title, card.x + 60, y + 2);
    ctx.font = ui(12, 700);
    ctx.fillStyle = C.grey;
    y = wrap(ctx, body, card.x + 60, y + 22, card.w - 76, 16) + 20;
  });

  button(ctx, titleLayout(w, h).helpClose, 'Got it', {
    fill: C.cherry,
    text: C.white,
    shadow: C.cherryShadow,
    radius: 22,
    font: display(22),
    pressed: v.pressed === 'helpClose',
  });
}

/** Word-wraps at `maxW`, returning the y of the last line drawn. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
): number {
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      ctx.fillText(line, x, y);
      y += lineH;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) ctx.fillText(line, x, y);
  return y;
}

export function drawTitle(
  ctx: CanvasRenderingContext2D,
  v: MenuView,
  w: number,
  h: number,
  now: number,
): void {
  const g = ctx.createRadialGradient(w / 2, 0, 40, w / 2, 0, h * 1.1);
  g.addColorStop(0, C.cherryLight);
  g.addColorStop(0.45, C.cherry);
  g.addColorStop(1, C.cherryDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  stripes(ctx, w, h, 0.42, 0.07);

  // Fizz bubbles drifting up the background.
  for (let i = 0; i < 6; i++) {
    const t = (now / 2600 + i * 0.37) % 1;
    ctx.globalAlpha = 0.3 * (1 - t);
    ctx.beginPath();
    ctx.arc(30 + ((i * 71) % (w - 60)), h * 0.6 - t * h * 0.45, 6 + (i % 3) * 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Logo plate.
  const plateW = 252;
  const plateH = 130;
  ctx.save();
  ctx.translate(w / 2, Math.max(118, h * 0.15));
  ctx.rotate(-0.035);
  chunk(
    ctx,
    { x: -plateW / 2, y: -plateH / 2, w: plateW, h: plateH },
    { fill: C.cream, radius: 20, border: 6, drop: 8, dropColor: 'rgba(0,0,0,.25)' },
  );
  ctx.textBaseline = 'middle';
  ctx.font = ui(15, 800);
  ctx.fillStyle = C.cherry;
  tracked(ctx, 'SODA', 0, -plateH / 2 + 26, 3);
  ctx.textAlign = 'center';
  ctx.font = display(50);
  ctx.fillStyle = C.ink;
  ctx.fillText('POP', -52, 4);
  const nums: Array<[string, string]> = [
    ['1', C.blue],
    ['2', C.teal],
    ['3', C.gold],
  ];
  ctx.font = display(38);
  nums.forEach(([n, col], i) => {
    ctx.fillStyle = col;
    ctx.fillText(n, 20 + i * 32, 4);
  });
  ctx.font = ui(13, 800);
  ctx.fillStyle = C.grey;
  tracked(ctx, 'THUMB WAR', 0, plateH / 2 - 24, 2);
  ctx.restore();

  // Two thumbs squaring up, with a VS badge between them.
  const wiggle = Math.sin(now / 380) * 0.06;
  const ty = Math.max(310, h * 0.46);
  drawThumbPortrait(ctx, skinById(v.save.skin), w / 2 - 64, ty, 84, 182, -0.2 + wiggle);
  drawThumbPortrait(ctx, SKINS[3], w / 2 + 64, ty, 84, 182, 0.24 - wiggle);
  ctx.save();
  ctx.translate(w / 2, ty - 92);
  ctx.rotate(-0.1);
  chunk(ctx, { x: -38, y: -22, w: 76, h: 44 }, { fill: C.gold, radius: 14, border: 5, drop: 5 });
  ctx.font = display(22);
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VS', 0, 1);
  ctx.restore();

  const L = titleLayout(w, h);
  modeButton(ctx, L.solo, '1', C.blue, '1 player', 'Beat the crate champs', v.pressed === 'solo');
  modeButton(ctx, L.versus, '2', C.teal, '2 players', 'Same phone, one crate', v.pressed === 'versus');

  for (const key of ['sound', 'thumbs', 'help']) {
    const r = L[key];
    button(ctx, r, key === 'help' ? '?' : '', {
      fill: 'rgba(255,255,255,.16)',
      text: C.white,
      border: 4,
      radius: 20,
      font: display(24),
      drop: 0,
      pressed: v.pressed === key,
      alpha: key === 'sound' && !v.soundOn ? 0.55 : 1,
    });
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    if (key === 'sound') note(ctx, cx, cy, 13, C.white, !v.soundOn);
    else if (key === 'thumbs') star(ctx, cx, cy + 1, 15, C.white);
  }
}

function modeButton(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  numeral: string,
  color: string,
  title: string,
  sub: string,
  pressed: boolean,
): void {
  chunk(ctx, r, { fill: C.cream, radius: 24, border: 5, drop: 7, pressed });
  const sink = pressed ? 4 : 0;
  ctx.beginPath();
  ctx.arc(r.x + 50, r.y + r.h / 2 + sink, 28, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.font = display(26);
  ctx.fillStyle = C.white;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(numeral, r.x + 50, r.y + r.h / 2 + sink + 1);

  ctx.textAlign = 'left';
  ctx.font = display(24);
  ctx.fillStyle = C.ink;
  ctx.fillText(title, r.x + 92, r.y + r.h / 2 - 12 + sink);
  ctx.font = ui(12, 700);
  ctx.fillStyle = C.grey;
  ctx.fillText(sub, r.x + 92, r.y + r.h / 2 + 13 + sink);
}

// ------------------------------------------------------------- 1b thumb picker

const TILE_COLS = 4;
const TILE_H = 86;

export function thumbsLayout(w: number, h: number): Record<string, Rect> {
  const gap = 10;
  const tileW = (w - 44 - gap * (TILE_COLS - 1)) / TILE_COLS;
  const rows = Math.ceil(SKINS.length / TILE_COLS);
  const gridH = rows * TILE_H + (rows - 1) * gap;
  const gridY = h - 116 - gridH - 20;
  const out: Record<string, Rect> = {
    back: { x: 18, y: 56, w: 56, h: 56 },
    use: { x: 22, y: h - 96, w: w - 44, h: 68 },
  };
  for (let i = 0; i < SKINS.length; i++) {
    out[`skin${i}`] = {
      x: 22 + (i % TILE_COLS) * (tileW + gap),
      y: gridY + Math.floor(i / TILE_COLS) * (TILE_H + gap),
      w: tileW,
      h: TILE_H,
    };
  }
  return out;
}

export function drawThumbs(ctx: CanvasRenderingContext2D, v: MenuView, w: number, h: number): void {
  ctx.fillStyle = vgrad(ctx, 0, h, C.blue, C.blueDeep);
  ctx.fillRect(0, 0, w, h);
  stripes(ctx, w, h, 0, 0.06);

  const L = thumbsLayout(w, h);
  header(ctx, w, 'SELECT A THUMB', L.back, v.pressed);
  capsChip(ctx, w - 18, 67, v.save.caps);

  const skin = SKINS[v.skinCursor];
  const owned = v.save.unlocked.includes(skin.id);

  const card: Rect = { x: 22, y: 130, w: w - 44, h: Math.max(180, L.skin0.y - 148) };
  chunk(ctx, card, { fill: C.cream, radius: 24, border: 5, drop: 7 });
  ctx.textBaseline = 'middle';
  ctx.font = ui(13, 800);
  ctx.fillStyle = C.grey;
  tracked(ctx, owned ? 'NOW WEARING' : 'LOCKED', w / 2, card.y + 26, 2);
  const previewH = Math.min(250, card.h * 0.56);
  drawThumbPortrait(ctx, skin, w / 2, card.y + card.h * 0.46, previewH * 0.58, previewH);
  ctx.textAlign = 'center';
  ctx.font = display(26);
  ctx.fillStyle = C.ink;
  ctx.fillText(skin.name, w / 2, card.y + card.h - 42);
  ctx.font = ui(12.5, 700);
  ctx.fillStyle = C.grey;
  ctx.fillText(skin.blurb, w / 2, card.y + card.h - 20);

  SKINS.forEach((s, i) => drawSkinTile(ctx, L[`skin${i}`], s, v, i));

  const canAfford = owned || v.save.caps >= skin.cost;
  const label = owned ? 'Use this thumb' : `Unlock \u00b7 ${skin.cost}`;
  button(ctx, L.use, label, {
    fill: canAfford ? C.cherry : 'rgba(255,246,232,.3)',
    text: canAfford ? C.white : 'rgba(255,255,255,.55)',
    shadow: canAfford ? C.cherryShadow : 'rgba(0,0,0,.2)',
    radius: 26,
    font: display(24),
    pressed: v.pressed === 'use',
  });
  toast(ctx, v.toast, w, L.use.y - 14);
}

function drawSkinTile(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  s: Skin,
  v: MenuView,
  i: number,
): void {
  const owned = v.save.unlocked.includes(s.id);
  const selected = i === v.skinCursor;
  chunk(ctx, r, {
    fill: selected ? C.gold : C.cream,
    radius: 16,
    border: 4,
    borderColor: selected ? C.ink : 'rgba(34,29,43,.35)',
    drop: selected ? 4 : 0,
  });

  ctx.save();
  ctx.globalAlpha = owned ? 1 : 0.7;
  drawThumbPortrait(ctx, s, r.x + r.w / 2, r.y + r.h / 2 - 6, 34, 56);
  ctx.restore();

  // Ownership strip along the bottom edge: teal = owned, grey = price.
  ctx.save();
  roundRectPath(ctx, r.x, r.y, r.w, r.h, 16);
  ctx.clip();
  ctx.fillStyle = owned ? C.teal : C.grey;
  ctx.fillRect(r.x, r.y + r.h - 17, r.w, 17);
  ctx.restore();
  ctx.font = ui(9.5, 800);
  ctx.fillStyle = C.white;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(owned ? 'OWNED' : String(s.cost), r.x + r.w / 2, r.y + r.h - 8);
}

// -------------------------------------------------------------- 1c stage select

export function stagesLayout(w: number, h: number): Record<string, Rect> {
  const cardTop = 132;
  // dots (38) + opponent strip (78) + its gap (22) + the fight button (126)
  const cardH = Math.max(240, Math.min(520, h - cardTop - 264));
  return {
    back: { x: 18, y: 56, w: 56, h: 56 },
    prev: { x: 12, y: cardTop + cardH / 2 - 44, w: 44, h: 88 },
    next: { x: w - 56, y: cardTop + cardH / 2 - 44, w: 44, h: 88 },
    card: { x: 66, y: cardTop, w: w - 132, h: cardH },
    fight: { x: 22, y: h - 96, w: w - 44, h: 68 },
  };
}

export function drawStages(ctx: CanvasRenderingContext2D, v: MenuView, w: number, h: number): void {
  ctx.fillStyle = vgrad(ctx, 0, h, C.teal, C.tealShadow);
  ctx.fillRect(0, 0, w, h);
  stripes(ctx, w, h, 0, 0.05);

  const L = stagesLayout(w, h);
  header(ctx, w, 'CHOOSE A STAGE', L.back, v.pressed);

  const stage = STAGES[v.stageCursor];
  const locked = v.stageCursor > v.save.cleared + 1;

  chunk(ctx, L.card, { fill: C.cream, radius: 26, border: 5, drop: 8 });

  // Crate preview, clipped to the top of the card.
  const artH = L.card.h - 104; // leaves exactly the name/blurb/tags block
  ctx.save();
  roundRectPath(ctx, L.card.x + 3, L.card.y + 3, L.card.w - 6, artH, 22);
  ctx.clip();
  ctx.translate(L.card.x + 3, L.card.y + 3);
  drawCratePreview(ctx, stage, L.card.w - 6, artH);
  ctx.restore();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const tx = L.card.x + 18;
  ctx.font = display(24);
  ctx.fillStyle = C.ink;
  ctx.fillText(stage.name, tx, L.card.y + artH + 26);
  ctx.font = ui(12, 700);
  ctx.fillStyle = C.grey;
  ctx.fillText(stage.blurb, tx, L.card.y + artH + 48);

  const tagY = L.card.y + artH + 64;
  const stageLabel = `STAGE ${v.stageCursor + 1}`;
  tag(ctx, tx, tagY, stageLabel, C.gold, C.ink);
  ctx.font = ui(11, 800);
  const firstW = ctx.measureText(stageLabel).width + 26;
  const starW = 3 * 18 + 16;
  chunk(ctx, { x: tx + firstW, y: tagY, w: starW, h: 24 }, { fill: C.teal, radius: 10, border: 3 });
  for (let i = 0; i < 3; i++) {
    star(ctx, tx + firstW + 17 + i * 18, tagY + 12, 7, i < stage.stars ? C.white : 'rgba(255,255,255,.35)');
  }

  // Carousel arrows and dots.
  const atStart = v.stageCursor === 0;
  const atEnd = v.stageCursor === STAGES.length - 1;
  button(ctx, L.prev, '', {
    fill: atStart ? 'rgba(255,255,255,.2)' : C.gold,
    text: C.ink,
    border: 4,
    radius: 14,
    drop: 0,
    pressed: v.pressed === 'prev',
    alpha: atStart ? 0.5 : 1,
  });
  chevron(ctx, L.prev.x + L.prev.w / 2, L.prev.y + L.prev.h / 2, 10, -1, atStart ? C.white : C.ink);
  button(ctx, L.next, '', {
    fill: atEnd ? 'rgba(255,255,255,.2)' : C.gold,
    text: C.ink,
    border: 4,
    radius: 14,
    drop: 0,
    pressed: v.pressed === 'next',
    alpha: atEnd ? 0.5 : 1,
  });
  chevron(ctx, L.next.x + L.next.w / 2, L.next.y + L.next.h / 2, 10, 1, atEnd ? C.white : C.ink);
  const dotY = L.card.y + L.card.h + 24;
  STAGES.forEach((_, i) => {
    const x = w / 2 - ((STAGES.length - 1) / 2) * 24 + i * 24;
    ctx.beginPath();
    ctx.arc(x, dotY, 7, 0, Math.PI * 2);
    ctx.fillStyle = i === v.stageCursor ? C.gold : 'rgba(255,255,255,.45)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = i === v.stageCursor ? C.ink : C.white;
    ctx.stroke();
  });

  // Opponent strip.
  const strip: Rect = { x: 22, y: dotY + 22, w: w - 44, h: 78 };
  chunk(ctx, strip, { fill: 'rgba(0,0,0,.18)', radius: 20, border: 0 });
  drawThumbPortrait(ctx, SKINS[3], strip.x + 44, strip.y + strip.h / 2, 40, 56);
  ctx.textAlign = 'left';
  ctx.font = display(17);
  ctx.fillStyle = C.white;
  ctx.fillText(`Next up: ${stage.opponent}`, strip.x + 82, strip.y + 30);
  ctx.font = ui(12, 700);
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.fillText(stage.opponentTitle, strip.x + 82, strip.y + 52);

  button(ctx, L.fight, locked ? 'Locked' : 'Thumb war!', {
    fill: locked ? 'rgba(255,246,232,.3)' : C.cherry,
    text: locked ? 'rgba(255,255,255,.6)' : C.white,
    shadow: locked ? 'rgba(0,0,0,.2)' : C.cherryShadow,
    radius: 26,
    font: display(24),
    pressed: v.pressed === 'fight',
  });
  toast(ctx, locked ? 'Clear the stage before it to unlock' : v.toast, w, L.fight.y - 14);
}

function tag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  fill: string,
  text: string,
): void {
  ctx.font = ui(11, 800);
  const tw = ctx.measureText(label).width + 20;
  chunk(ctx, { x, y, w: tw, h: 24 }, { fill, radius: 10, border: 3 });
  ctx.fillStyle = text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 10, y + 13);
}

/** Miniature of the battle arena, used as the stage thumbnail. */
function drawCratePreview(
  ctx: CanvasRenderingContext2D,
  stage: (typeof STAGES)[number],
  w: number,
  h: number,
): void {
  ctx.fillStyle = vgrad(ctx, 0, h, stage.lidTop, stage.lidBottom);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = stage.plank;
  for (let y = 0; y < h; y += 26) ctx.fillRect(0, y, w, 3);
  ctx.fillStyle = 'rgba(59,42,29,.5)';
  ctx.fillRect(0, h / 2 - 3, w, 6);
  for (const cy of [h * 0.26, h * 0.74]) {
    ctx.beginPath();
    ctx.arc(w / 2, cy, h * 0.17, 0, Math.PI * 2);
    ctx.fillStyle = stage.hole;
    ctx.fill();
    ctx.lineWidth = h * 0.026;
    ctx.strokeStyle = stage.ring;
    ctx.stroke();
  }
}
