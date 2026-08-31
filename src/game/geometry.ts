import type { PlayerId, ThumbState, Vec2 } from '../types';

/**
 * Shared crate/thumb geometry. The renderer draws from these numbers and the
 * tests assert against them, so "do the thumbs actually overlap?" has one
 * answer rather than two that can drift apart.
 *
 * Model: a wooden crate lid fills the screen with a seam across the middle.
 * Each player's thumb pushes up through a bottle-hole on their own side —
 * P1's at the bottom, P2's at the top. A thumb leans left and right to aim
 * and lunges across the seam to strike. Everything is a fraction of the
 * DESIGN height so proportions hold on any phone.
 */

/** Reference layout width. All render code works in this space, then scales. */
export const DESIGN_W = 402;
/** Reference layout height (iPhone 15 Pro logical). */
export const DESIGN_H = 874;

/** Bottle-hole radius, as a fraction of height. */
export const HOLE_R = 0.098;
/** Vertical centre of each bottle-hole. */
export const HOLE_Y: Record<PlayerId, number> = { p1: 0.765, p2: 0.235 };
/** How far inside the hole the thumb is anchored (fraction of hole radius). */
export const KNUCKLE_INSET = 0.35;

/**
 * Thumb length at rest, measured from the knuckle. Must comfortably exceed
 * holeRadius * (1 + KNUCKLE_INSET) or the thumb barely clears its own rim and
 * reads as a stub sitting on a hole rather than a thumb coming out of one.
 */
export const THUMB_LENGTH = 0.21;
/** Extra length at full lunge. Tuned so a full reach just crosses the seam. */
export const THUMB_REACH_EXTRA = 0.155;
/** Thumb thickness. */
export const THUMB_WIDTH = 0.048;
/** How far either side of centre a thumb tip can roam. */
export const THUMB_SWING_RANGE = 0.155;
/**
 * Thumbs count as overlapping when their tips are this close, in multiples of
 * thumb width. Derived from the drawn width so the hitbox matches what the
 * player sees.
 */
export const HITBOX_WIDTHS = 1.5;

export function seamY(h: number): number {
  return h / 2;
}

export function holeCenter(player: PlayerId, w: number, h: number): Vec2 {
  return { x: w / 2, y: h * HOLE_Y[player] };
}

export function holeRadius(h: number): number {
  return h * HOLE_R;
}

/** Where a thumb sprouts from inside its bottle-hole. */
export function knuckle(player: PlayerId, w: number, h: number): Vec2 {
  const c = holeCenter(player, w, h);
  const dir = player === 'p1' ? 1 : -1; // anchor toward the player's own edge
  return { x: c.x, y: c.y + dir * holeRadius(h) * KNUCKLE_INSET };
}

/** Limits of lateral thumb movement. */
export function swingBounds(w: number, h: number): { min: number; max: number } {
  const c = w / 2;
  return { min: c - h * THUMB_SWING_RANGE, max: c + h * THUMB_SWING_RANGE };
}

/** Current thumb length in px, grown by reach. */
export function thumbLength(reach: number, h: number): number {
  return h * (THUMB_LENGTH + THUMB_REACH_EXTRA * reach);
}

/** Tip of a thumb: leans toward its aim point, extends with reach. */
export function thumbTip(t: ThumbState, player: PlayerId, w: number, h: number): Vec2 {
  const base = knuckle(player, w, h);
  const dir = player === 'p1' ? -1 : 1; // p1 reaches up the screen
  return { x: t.pos.x, y: base.y + dir * thumbLength(t.reach, h) };
}

/** Distance at which two thumb tips count as overlapping. */
export function hitboxPx(h: number): number {
  return h * THUMB_WIDTH * HITBOX_WIDTHS;
}
