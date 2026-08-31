/**
 * Splash source (2732x2732 — capacitor-assets downsamples for every device).
 * Deliberately plain: a splash screen is on-screen for a few hundred ms
 * during launch, so it's the logo plate centered on the title gradient with
 * nothing that could look mid-animation.
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { C, chunk, display, tracked, ui, vgrad } from '../src/render/theme';

GlobalFonts.registerFromPath('public/fonts/Baloo2-latin.woff2', 'Baloo 2');
GlobalFonts.registerFromPath('public/fonts/Nunito-latin.woff2', 'Nunito');

const S = 2732;
const canvas = createCanvas(S, S);
const ctx = canvas.getContext('2d');

ctx.fillStyle = vgrad(ctx as any, 0, S, C.cherryLight, C.cherryDeep);
ctx.fillRect(0, 0, S, S);

const plateW = 1180;
const plateH = 610;
ctx.save();
ctx.translate(S / 2, S / 2);
chunk(
  ctx as any,
  { x: -plateW / 2, y: -plateH / 2, w: plateW, h: plateH },
  { fill: C.cream, radius: 90, border: 26, drop: 32, dropColor: 'rgba(0,0,0,.25)' },
);
ctx.textBaseline = 'middle';
ctx.font = ui(70, 800);
ctx.fillStyle = C.cherry;
tracked(ctx as any, 'SODA', 0, -plateH / 2 + 118, 14);
ctx.textAlign = 'center';
ctx.font = display(232);
ctx.fillStyle = C.ink;
ctx.fillText('POP', -244, 14);
const nums: Array<[string, string]> = [
  ['1', C.blue],
  ['2', C.teal],
  ['3', C.gold],
];
ctx.font = display(176);
nums.forEach(([n, col], i) => {
  ctx.fillStyle = col;
  ctx.fillText(n, 92 + i * 148, 14);
});
ctx.font = ui(60, 800);
ctx.fillStyle = C.grey;
tracked(ctx as any, 'THUMB WAR', 0, plateH / 2 - 108, 9);
ctx.restore();

writeFileSync('assets/splash.png', canvas.toBuffer('image/png'));
console.log('wrote assets/splash.png');
