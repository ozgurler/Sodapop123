import type { PlayerId, Skin, Stage, Vec2 } from '../types';
import {
  THUMB_WIDTH,
  holeCenter,
  holeRadius,
  knuckle,
  seamY,
  thumbLength,
} from '../game/geometry';
import { C, barrel, vgrad } from './theme';

/**
 * The arena: a wooden crate lid seen from above, split by a seam, with a
 * bottle-hole on each side. Thumbs push up through the holes and lunge across
 * the seam. Programmer art, but built on the real geometry — swap these
 * draw* functions for sprites without touching game logic.
 */

export function drawCrate(ctx: CanvasRenderingContext2D, stage: Stage, w: number, h: number): void {
  ctx.fillStyle = vgrad(ctx, 0, h, stage.lidTop, stage.lidBottom);
  ctx.fillRect(0, 0, w, h);

  // Plank grain: thin dark lines every 34px, matching the mockup's stripe.
  ctx.fillStyle = stage.plank;
  for (let y = 0; y < h; y += 34) ctx.fillRect(0, y, w, 4);

  // Vignette so the HUD reads against the lid.
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.12, w / 2, h / 2, h * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // The seam the thumbs fight across.
  ctx.fillStyle = 'rgba(59,42,29,.45)';
  ctx.fillRect(0, seamY(h) - 4, w, 8);
}

/** One bottle-hole: dark well, thick rim, inner shadow. */
export function drawHole(
  ctx: CanvasRenderingContext2D,
  player: PlayerId,
  stage: Stage,
  w: number,
  h: number,
): void {
  const c = holeCenter(player, w, h);
  const r = holeRadius(h);

  ctx.save();
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fillStyle = stage.hole;
  ctx.fill();

  // Inner shadow: a soft dark band along the top of the well.
  ctx.clip();
  const inner = ctx.createLinearGradient(0, c.y - r, 0, c.y + r * 0.4);
  inner.addColorStop(0, 'rgba(0,0,0,.6)');
  inner.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = inner;
  ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.lineWidth = h * 0.011;
  ctx.strokeStyle = stage.ring;
  ctx.stroke();
}

export interface ThumbDraw {
  player: PlayerId;
  skin: Skin;
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
 * One thumb, rising out of its bottle-hole. Length is a real thumb's length;
 * aiming leans it sideways rather than stretching it.
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
  const wTip = width * (d.pinned ? 0.74 : 0.88);

  // Cast shadow onto the lid, offset away from the seam.
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  capsule(ctx, base.x + 4, base.y - dir * 3, tip.x + 4, tip.y - dir * 3, width, wTip, px, py);
  ctx.fill();

  capsule(ctx, base.x, base.y, tip.x, tip.y, width, wTip, px, py);
  ctx.fillStyle = barrel(ctx, tip.x - width, tip.x + width, d.skin.deep, d.skin.base);
  ctx.fill();
  ctx.lineWidth = Math.max(3, d.h * 0.006);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.ink;
  ctx.stroke();

  // Nail near the tip, rotated to follow the thumb.
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(angle - Math.PI / 2);
  ctx.beginPath();
  // Negative local y sits the nail INSIDE the tip, back toward the knuckle.
  ctx.ellipse(0, -wTip * 0.45, wTip * 0.58, wTip * 0.74, 0, 0, Math.PI * 2);
  ctx.fillStyle = d.skin.nail;
  ctx.fill();
  ctx.lineWidth = Math.max(2.5, d.h * 0.005);
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.restore();

  // Single knuckle crease across the middle.
  ctx.strokeStyle = 'rgba(0,0,0,.18)';
  ctx.lineWidth = 2.5;
  const mx = base.x + (tip.x - base.x) * 0.5;
  const my = base.y + (tip.y - base.y) * 0.5;
  ctx.beginPath();
  ctx.moveTo(mx - px * width * 0.55, my - py * width * 0.55);
  ctx.lineTo(mx + px * width * 0.55, my + py * width * 0.55);
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
  // Sweep AWAY from the base so the cap bulges past the tip. Sweeping the
  // other way tucks the arc back down the barrel and leaves the tip flat.
  const a = Math.atan2(py, px);
  ctx.arc(tx, ty, wTip, a, a - Math.PI, true);
  ctx.lineTo(bx - px * wBase, by - py * wBase);
  ctx.closePath();
}

/**
 * Alignment guide: the single most important readability aid in the game.
 * Solid and bright when the tips overlap, dashed and red when they don't —
 * shape as well as colour, so it survives colourblind play.
 */
export function drawAlignmentGuide(
  ctx: CanvasRenderingContext2D,
  t1: Vec2,
  t2: Vec2,
  aligned: boolean,
): void {
  ctx.save();
  ctx.globalAlpha = aligned ? 0.85 : 0.4;
  ctx.strokeStyle = aligned ? C.gold : C.cherry;
  ctx.lineWidth = aligned ? 5 : 3;
  ctx.setLineDash(aligned ? [] : [6, 9]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.stroke();
  ctx.restore();
}

/** Shape badge so players are told apart without relying on colour. */
export function drawPlayerBadge(
  ctx: CanvasRenderingContext2D,
  player: PlayerId,
  x: number,
  y: number,
  r: number,
): void {
  ctx.beginPath();
  if (player === 'p1') {
    ctx.arc(x, y, r, 0, Math.PI * 2);
  } else {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.lineTo(x - r, y + r);
    ctx.closePath();
  }
  ctx.fillStyle = C.cream;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
}

/** A thumb drawn upright in a box — used by the title and skin-picker screens. */
export function drawThumbPortrait(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  cx: number,
  cy: number,
  bw: number,
  bh: number,
  tilt = 0,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  const r = bw / 2;
  ctx.beginPath();
  ctx.moveTo(-r, bh / 2 - r * 0.5);
  ctx.lineTo(-r, -bh / 2 + r);
  ctx.arc(0, -bh / 2 + r, r, Math.PI, 0);
  ctx.lineTo(r, bh / 2 - r * 0.5);
  ctx.arcTo(r, bh / 2, r - 12, bh / 2, 14);
  ctx.lineTo(-r + 12, bh / 2);
  ctx.arcTo(-r, bh / 2, -r, bh / 2 - r * 0.5, 14);
  ctx.closePath();
  ctx.fillStyle = barrel(ctx, -r, r, skin.deep, skin.base);
  ctx.fill();
  ctx.lineWidth = Math.max(4, bw * 0.07);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.ink;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, -bh / 2 + r * 1.05, r * 0.55, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin.nail;
  ctx.fill();
  ctx.lineWidth = Math.max(3, bw * 0.05);
  ctx.stroke();
  ctx.restore();
}

/**
 * Redraws the far half of a bottle-hole's rim ON TOP of the thumb, so the
 * barrel disappears into the well instead of sitting flat on the lid. Called
 * after the thumbs are drawn; the near half is left alone so a lunging thumb
 * still crosses the rim cleanly.
 */
export function drawHoleRim(
  ctx: CanvasRenderingContext2D,
  player: PlayerId,
  stage: Stage,
  w: number,
  h: number,
): void {
  const c = holeCenter(player, w, h);
  const r = holeRadius(h);
  // p1's hole sits at the bottom, so its outer edge is the lower arc.
  const from = player === 'p1' ? 0 : Math.PI;
  ctx.save();
  // Shadow the mouth of the well where the thumb enters it.
  ctx.beginPath();
  ctx.arc(c.x, c.y, r - 2, from, from + Math.PI);
  ctx.lineWidth = h * 0.02;
  ctx.strokeStyle = 'rgba(0,0,0,.45)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(c.x, c.y, r, from, from + Math.PI);
  ctx.lineWidth = h * 0.011;
  ctx.strokeStyle = stage.ring;
  ctx.stroke();
  ctx.restore();
}
