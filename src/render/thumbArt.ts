import type { PlayerId, Vec2 } from '../types';
import { THUMB_WIDTH, knuckle, thumbLength } from '../game/geometry';

/**
 * ═══════════════════════ PLACEHOLDER ART ═══════════════════════
 * Programmer art drawn with canvas primitives, but built on the real
 * anatomy of the game: two hands clasped in the middle with their four
 * fingers interlocked, and only the thumbs free to fight. Swap these
 * draw* functions for sprites without touching game logic.
 * ═══════════════════════════════════════════════════════════════
 */

export const PALETTE = {
  table: '#3E2A1C',
  cream: '#FDF3E3',
  p1: '#E8A15C', // warm skin tone — your hand
  p1Deep: '#C97F3E',
  p1Nail: '#F7D9BC',
  p2: '#8FB8D9', // cooler tone — opponent's hand (reads for common CVD)
  p2Deep: '#5E8CB5',
  p2Nail: '#DCEBF7',
  fizz: '#FFE9B8',
  fault: '#C4453B',
} as const;

export function playerColor(p: PlayerId): string {
  return p === 'p1' ? PALETTE.p1 : PALETTE.p2;
}
function deepColor(p: PlayerId): string {
  return p === 'p1' ? PALETTE.p1Deep : PALETTE.p2Deep;
}

export function drawTable(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = PALETTE.table;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.85);
  g.addColorStop(0, 'rgba(253,243,227,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/**
 * The clasp: two hands gripping each other, four fingers of each hand
 * interlocked across the middle. Static — only the thumbs move.
 */
export function drawClaspedHands(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const palmW = h * 0.34;
  const palmH = h * 0.3;

  // Forearms running off each edge, so the hands feel attached to bodies.
  for (const p of ['p1', 'p2'] as PlayerId[]) {
    const down = p === 'p1';
    ctx.fillStyle = deepColor(p);
    ctx.beginPath();
    const armTop = down ? cy + palmH * 0.5 : cy - palmH * 0.5;
    const edge = down ? h + 10 : -10;
    ctx.moveTo(cx - palmW * 0.34, armTop);
    ctx.lineTo(cx + palmW * 0.34, armTop);
    ctx.lineTo(cx + palmW * 0.42, edge);
    ctx.lineTo(cx - palmW * 0.42, edge);
    ctx.closePath();
    ctx.fill();
  }

  // Palms: p1's grip is nearer the viewer, so it's drawn on top.
  for (const p of ['p2', 'p1'] as PlayerId[]) {
    const down = p === 'p1';
    const palmY = down ? cy + palmH * 0.16 : cy - palmH * 0.16;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundedRect(ctx, cx - palmW / 2 + 4, palmY - palmH / 2 + 5, palmW, palmH, h * 0.05);
    ctx.fill();
    const grad = ctx.createLinearGradient(cx - palmW / 2, 0, cx + palmW / 2, 0);
    grad.addColorStop(0, deepColor(p));
    grad.addColorStop(0.4, playerColor(p));
    grad.addColorStop(1, deepColor(p));
    ctx.fillStyle = grad;
    roundedRect(ctx, cx - palmW / 2, palmY - palmH / 2, palmW, palmH, h * 0.05);
    ctx.fill();
    ctx.restore();
  }

  // Interlocked fingers: four from each hand, alternating across the seam.
  const fingerW = palmW * 0.17;
  const fingerL = palmH * 0.62;
  for (let i = 0; i < 8; i++) {
    // Alternate ownership so the fingers visibly interleave.
    const owner: PlayerId = i % 2 === 0 ? 'p1' : 'p2';
    const down = owner === 'p1';
    const x = cx - palmW * 0.42 + (i * palmW * 0.84) / 7;
    // A p1 finger reaches up across the seam; a p2 finger reaches down.
    const yStart = down ? cy + fingerL * 0.15 : cy - fingerL * 0.15;
    const yEnd = down ? yStart - fingerL : yStart + fingerL;
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = fingerW + 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 2, yStart + 2);
    ctx.lineTo(x + 2, yEnd + 2);
    ctx.stroke();

    ctx.strokeStyle = playerColor(owner);
    ctx.lineWidth = fingerW;
    ctx.beginPath();
    ctx.moveTo(x, yStart);
    ctx.lineTo(x, yEnd);
    ctx.stroke();

    // Knuckle crease near the fingertip.
    ctx.strokeStyle = 'rgba(0,0,0,0.14)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - fingerW * 0.35, yEnd + (down ? fingerL * 0.22 : -fingerL * 0.22));
    ctx.lineTo(x + fingerW * 0.35, yEnd + (down ? fingerL * 0.22 : -fingerL * 0.22));
    ctx.stroke();
  }
}

export interface ThumbDraw {
  player: PlayerId;
  /** Aim point — where the tip is heading. */
  tipX: number;
  reach: number;
  squash: number;
  /** True when this thumb is the one being held down. */
  pinned: boolean;
  w: number;
  h: number;
}

/**
 * One thumb, pivoting from its knuckle beside the clasp. Length is a real
 * thumb's length; aiming leans it sideways rather than stretching it.
 */
export function drawThumb(ctx: CanvasRenderingContext2D, d: ThumbDraw): void {
  const base = knuckle(d.player, d.w, d.h);
  const dir = d.player === 'p1' ? -1 : 1;
  const len = thumbLength(d.reach, d.h);
  const tip: Vec2 = { x: d.tipX, y: base.y + dir * len };
  const width = d.h * THUMB_WIDTH * d.squash;

  const angle = Math.atan2(tip.y - base.y, tip.x - base.x);
  const perp = angle + Math.PI / 2;
  const px = Math.cos(perp);
  const py = Math.sin(perp);
  // A pinned thumb is squashed flatter under the winner.
  const wTip = width * (d.pinned ? 0.75 : 0.86);

  // Shadow first, offset toward the viewer for depth.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  capsule(ctx, base.x + 3, base.y + 4, tip.x + 3, tip.y + 4, width, wTip, px, py);
  ctx.fill();

  const grad = ctx.createLinearGradient(base.x - width, base.y, base.x + width, base.y);
  grad.addColorStop(0, deepColor(d.player));
  grad.addColorStop(0.45, playerColor(d.player));
  grad.addColorStop(1, deepColor(d.player));
  ctx.fillStyle = grad;
  capsule(ctx, base.x, base.y, tip.x, tip.y, width, wTip, px, py);
  ctx.fill();

  // Nail near the tip, rotated to follow the thumb.
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(angle - Math.PI / 2);
  ctx.fillStyle = d.player === 'p1' ? PALETTE.p1Nail : PALETTE.p2Nail;
  ctx.beginPath();
  ctx.ellipse(0, -wTip * 0.35, wTip * 0.62, wTip * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Single knuckle crease across the middle.
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 2.5;
  const mx = base.x + (tip.x - base.x) * 0.45;
  const my = base.y + (tip.y - base.y) * 0.45;
  ctx.beginPath();
  ctx.moveTo(mx - px * width * 0.6, my - py * width * 0.6);
  ctx.lineTo(mx + px * width * 0.6, my + py * width * 0.6);
  ctx.stroke();
}

/** Tapered rounded capsule from base to tip. */
function capsule(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  tx: number,
  ty: number,
  wBase: number,
  wTip: number,
  px: number,
  py: number,
): void {
  ctx.beginPath();
  ctx.moveTo(bx + px * wBase, by + py * wBase);
  ctx.lineTo(tx + px * wTip, ty + py * wTip);
  ctx.arc(tx, ty, wTip, Math.atan2(py, px), Math.atan2(py, px) + Math.PI, false);
  ctx.lineTo(bx - px * wBase, by - py * wBase);
  ctx.closePath();
}

/** Alignment guide: shows whether the thumb tips line up. */
export function drawAlignmentGuide(
  ctx: CanvasRenderingContext2D,
  t1: Vec2,
  t2: Vec2,
  aligned: boolean,
): void {
  ctx.save();
  ctx.globalAlpha = aligned ? 0.55 : 0.25;
  ctx.strokeStyle = aligned ? PALETTE.cream : PALETTE.fault;
  ctx.lineWidth = aligned ? 3 : 2;
  ctx.setLineDash(aligned ? [] : [5, 7]);
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.stroke();
  ctx.restore();
}

export function drawPlayerBadge(
  ctx: CanvasRenderingContext2D,
  player: PlayerId,
  x: number,
  y: number,
  r: number,
): void {
  ctx.fillStyle = PALETTE.cream;
  ctx.beginPath();
  if (player === 'p1') {
    ctx.arc(x, y, r, 0, Math.PI * 2);
  } else {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.lineTo(x - r, y + r);
    ctx.closePath();
  }
  ctx.fill();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
