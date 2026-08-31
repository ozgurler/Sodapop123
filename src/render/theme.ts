/**
 * Design tokens lifted from the mockup, plus the handful of primitives every
 * screen is built from. The look is "chunky sticker": a thick ink outline, a
 * hard offset shadow with no blur, and generous corner radii.
 */

export const C = {
  ink: '#221d2b',
  cream: '#fff6e8',
  creamDim: '#e6dfd2',
  grey: '#8b8394',
  greyDim: '#b3aa9c',
  white: '#ffffff',

  cherry: '#e23b33',
  cherryLight: '#ff6b52',
  cherryDeep: '#a82722',
  cherryShadow: '#7d1c18',

  gold: '#ffc53d',
  goldShadow: '#b98a1e',
  orange: '#ff8a5c',

  teal: '#35c3a3',
  tealLight: '#7bf0cd',
  tealDeep: '#1fa88a',
  tealShadow: '#12876d',

  blue: '#2a5bd7',
  blueDeep: '#1b3f9e',

  walnut: '#8a5a3b',
  walnutDark: '#3b2a1d',

  shadowSoft: 'rgba(0,0,0,.28)',
  shadowHard: 'rgba(0,0,0,.35)',
  scrim: 'rgba(34,29,43,.72)',
} as const;

export const DISPLAY = "'Baloo 2', Nunito, system-ui, sans-serif";
export const UI = 'Nunito, system-ui, sans-serif';

export function display(size: number, weight = 800): string {
  return `${weight} ${size}px ${DISPLAY}`;
}
export function ui(size: number, weight = 800): string {
  return `${weight} ${size}px ${UI}`;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function hit(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export interface ChunkStyle {
  fill: string | CanvasGradient;
  radius?: number;
  /** Ink outline width. 0 to skip. */
  border?: number;
  borderColor?: string;
  /** Hard offset shadow, no blur. */
  drop?: number;
  dropColor?: string;
  /** Pressed state sinks the block into its own shadow. */
  pressed?: boolean;
  alpha?: number;
}

/** The mockup's signature block: hard shadow, ink outline, fat radius. */
export function chunk(ctx: CanvasRenderingContext2D, r: Rect, s: ChunkStyle): void {
  const radius = s.radius ?? 20;
  const border = s.border ?? 5;
  const drop = s.drop ?? 0;
  const sink = s.pressed ? Math.min(drop, 4) : 0;
  ctx.save();
  if (s.alpha !== undefined) ctx.globalAlpha = s.alpha;
  if (drop > 0 && !s.pressed) {
    ctx.fillStyle = s.dropColor ?? C.shadowSoft;
    roundRectPath(ctx, r.x, r.y + drop, r.w, r.h, radius);
    ctx.fill();
  }
  roundRectPath(ctx, r.x, r.y + sink, r.w, r.h, radius);
  ctx.fillStyle = s.fill;
  ctx.fill();
  if (border > 0) {
    ctx.lineWidth = border;
    ctx.strokeStyle = s.borderColor ?? C.ink;
    ctx.stroke();
  }
  ctx.restore();
}

/** Draws text with manual letter tracking — ctx.letterSpacing is patchy in WKWebView. */
export function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: CanvasTextAlign = 'center',
): void {
  if (spacing <= 0) {
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    return;
  }
  const chars = [...text];
  const total = chars.reduce((sum, c) => sum + ctx.measureText(c).width, 0) + spacing * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.textAlign = 'left';
  for (const c of chars) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + spacing;
  }
}

/** Text with a chunky ink outline behind it, for anything over busy art. */
export function outlined(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  fill: string,
  width = 6,
  stroke = 'rgba(0,0,0,.45)',
): void {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** Vertical linear gradient helper. */
export function vgrad(
  ctx: CanvasRenderingContext2D,
  y0: number,
  y1: number,
  from: string,
  to: string,
): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  return g;
}

/** Horizontal barrel gradient: edge → centre → edge. Used for every thumb. */
export function barrel(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  deep: string,
  base: string,
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, deep);
  g.addColorStop(0.42, base);
  g.addColorStop(1, deep);
  return g;
}

export interface ButtonStyle {
  fill: string;
  text: string;
  borderColor?: string;
  shadow?: string;
  radius?: number;
  border?: number;
  font?: string;
  drop?: number;
  pressed?: boolean;
  alpha?: number;
}

/** A tappable block with its label. Every one is 48px+ tall by construction. */
export function button(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  label: string,
  s: ButtonStyle,
): void {
  const drop = s.drop ?? 7;
  chunk(ctx, r, {
    fill: s.fill,
    radius: s.radius ?? 24,
    border: s.border ?? 5,
    borderColor: s.borderColor,
    drop,
    dropColor: s.shadow ?? C.shadowSoft,
    pressed: s.pressed,
    alpha: s.alpha,
  });
  ctx.save();
  if (s.alpha !== undefined) ctx.globalAlpha = s.alpha;
  ctx.font = s.font ?? display(24);
  ctx.fillStyle = s.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + (s.pressed ? Math.min(drop, 4) : 0) + 1);
  ctx.restore();
}

/* --------------------------------------------------------------- icon paths

   Drawn rather than typed. The bundled Baloo 2 / Nunito subsets only cover
   Latin, so glyphs like ★ and ♪ would silently fall back to the system face
   and look pasted in from another app.                                      */

export function star(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string,
  stroke?: string,
): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.44;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = Math.max(2, r * 0.22);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

/** Eighth note. `muted` adds the slash used for sound-off. */
export function note(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  muted = false,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.28, cy + r * 0.52, r * 0.42, r * 0.32, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = r * 0.22;
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.12, cy + r * 0.56);
  ctx.lineTo(cx + r * 0.12, cy - r * 0.85);
  ctx.stroke();
  ctx.lineWidth = r * 0.3;
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.12, cy - r * 0.82);
  ctx.quadraticCurveTo(cx + r * 0.85, cy - r * 0.6, cx + r * 0.7, cy - r * 0.1);
  ctx.stroke();
  if (muted) {
    ctx.lineWidth = r * 0.26;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.9, cy - r * 0.9);
    ctx.lineTo(cx + r * 0.9, cy + r * 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

/** Carousel / back arrow. `dir` is -1 for left, +1 for right. */
export function chevron(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  dir: -1 | 1,
  color: string,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, size * 0.32);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  // The vertex points the way `dir` says, so the two arms fold back the other way.
  ctx.moveTo(cx - (dir * size) / 2, cy - size);
  ctx.lineTo(cx + (dir * size) / 2, cy);
  ctx.lineTo(cx - (dir * size) / 2, cy + size);
  ctx.stroke();
  ctx.restore();
}
