/**
 * Renders the 1024x1024 App Store icon straight from the game's own art
 * primitives, so it's never out of sync with what the app looks like.
 * Run: npx tsx scripts/make-icon.ts, then npx capacitor-assets generate.
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { skinById, DEFAULT_SKIN } from '../src/game/content';
import { drawThumbPortrait } from '../src/render/crate';
import { C, vgrad } from '../src/render/theme';

GlobalFonts.registerFromPath('public/fonts/Baloo2-latin.woff2', 'Baloo 2');

const S = 1024;
const canvas = createCanvas(S, S);
const ctx = canvas.getContext('2d');

// iOS masks its own rounded corners — a FULL BLEED square is required, no
// transparency and no corner radius baked in, or the mask clips into it.
ctx.fillStyle = vgrad(ctx as any, 0, S, C.cherryLight, C.cherryDeep);
ctx.fillRect(0, 0, S, S);

ctx.save();
ctx.globalAlpha = 0.08;
ctx.fillStyle = '#ffffff';
ctx.translate(S / 2, S / 2);
ctx.rotate(0.42);
for (let x = -S; x < S; x += 74) ctx.fillRect(x, -S, 37, S * 2);
ctx.restore();

drawThumbPortrait(ctx as any, skinById(DEFAULT_SKIN), S / 2, S * 0.58, 300, 620, 0);

writeFileSync('assets/icon-only.png', canvas.toBuffer('image/png'));
console.log('wrote assets/icon-only.png');
