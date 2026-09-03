/**
 * Renders App Store screenshots at native 6.9" resolution (1320x2868).
 * Apple scales this one set down for every smaller device class, so it's the
 * only iPhone set needed. Rendered from the game's own draw code rather than
 * captured and resized, so they're pixel-exact and never blurry.
 *
 * Run: npx tsx scripts/store-screenshots.ts
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { StateMachine } from '../src/game/stateMachine';
import { DESIGN_W, seamY, thumbTip } from '../src/game/geometry';
import { FOE_SKIN, SKINS, STAGES, VERSUS_STAGE, skinById } from '../src/game/content';
import { drawAlignmentGuide, drawCrate, drawHole, drawHoleRim, drawThumb } from '../src/render/crate';
import { BattleHud, drawMatchEnd, type BattleView } from '../src/render/hud';
import { drawStages, drawThumbs, drawTitle, type MenuView } from '../src/render/screens';
import { DEFAULT_SAVE } from '../src/data/save';
import { C, display, ui } from '../src/render/theme';
import type { PlayerId, Settings } from '../src/types';

GlobalFonts.registerFromPath('public/fonts/Baloo2-latin.woff2', 'Baloo 2');
GlobalFonts.registerFromPath('public/fonts/Nunito-latin.woff2', 'Nunito');

const PX_W = 1320;
const PX_H = 2868;
const SCALE = PX_W / DESIGN_W;
const H = PX_H / SCALE; // design-space height for this aspect

const settings: Settings = {
  chantSpeed: 'normal',
  leftHanded: false,
  colorblindSafe: false,
  hapticsEnabled: true,
  soundEnabled: true,
};

const menu = (over: Partial<MenuView> = {}): MenuView => ({
  save: { ...DEFAULT_SAVE, caps: 1240, cleared: 1 },
  skinCursor: 0,
  stageCursor: 1,
  soundOn: true,
  helpOpen: false,
  pressed: null,
  toast: '',
  ...over,
});

/**
 * Caption sits in the empty band between the opponent's hole and the seam —
 * the only part of the arena with no HUD or artwork under it. A dark scrim
 * keeps it legible over the wood grain.
 */
function caption(ctx: any, headline: string, sub: string): void {
  const y = H * 0.375;
  ctx.save();
  const g = ctx.createLinearGradient(0, y - 90, 0, y + 90);
  g.addColorStop(0, 'rgba(24,16,10,0)');
  g.addColorStop(0.5, 'rgba(24,16,10,.72)');
  g.addColorStop(1, 'rgba(24,16,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y - 90, DESIGN_W, 180);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = display(38);
  ctx.strokeStyle = 'rgba(0,0,0,.55)';
  ctx.lineWidth = 9;
  ctx.lineJoin = 'round';
  ctx.strokeText(headline, DESIGN_W / 2, y - 16);
  ctx.fillStyle = C.white;
  ctx.fillText(headline, DESIGN_W / 2, y - 16);
  ctx.font = ui(16, 800);
  ctx.lineWidth = 6;
  ctx.strokeText(sub, DESIGN_W / 2, y + 22);
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.fillText(sub, DESIGN_W / 2, y + 22);
  ctx.restore();
}

function shot(name: string, draw: (ctx: any) => void): void {
  const canvas = createCanvas(PX_W, PX_H);
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  mkdirSync('store/screenshots', { recursive: true });
  writeFileSync(`store/screenshots/${name}.png`, canvas.toBuffer('image/png'));
  console.log(`  store/screenshots/${name}.png  ${PX_W}x${PX_H}`);
}

function smAt(phase: string): StateMachine {
  const sm = new StateMachine('normal', 0);
  sm.setLayout(DESIGN_W, H);
  sm.startMatch(0);
  let now = 0;
  const cx = DESIGN_W / 2;
  while (now < 60000) {
    now += 16;
    sm.aim('p1', cx);
    sm.aim('p2', cx);
    sm.update(now);
    if (sm.phase === phase) break;
    if (sm.phase === 'strike') {
      sm.press('p1', { x: cx, y: H * 0.78 }, now);
      sm.move('p1', { x: cx, y: H * 0.78 - 80 }, now, 24);
      sm.release('p1');
    }
  }
  for (let i = 0; i < 30; i++) sm.update(now + i);
  return sm;
}

function arena(ctx: any, v: BattleView, now: number): void {
  const { sm } = v;
  drawCrate(ctx, v.stage, DESIGN_W, H);
  drawHole(ctx, 'p2', v.stage, DESIGN_W, H);
  drawHole(ctx, 'p1', v.stage, DESIGN_W, H);
  if (sm.phase === 'chant' || sm.phase === 'strike') {
    drawAlignmentGuide(
      ctx,
      thumbTip(sm.thumbs.p1, 'p1', DESIGN_W, H),
      thumbTip(sm.thumbs.p2, 'p2', DESIGN_W, H),
      sm.aligned,
    );
  }
  const order: PlayerId[] =
    sm.phase === 'pin' && sm.round.pinner
      ? [sm.round.pinner === 'p1' ? 'p2' : 'p1', sm.round.pinner]
      : ['p2', 'p1'];
  for (const id of order) {
    const t = sm.thumbs[id];
    const pinned = sm.phase === 'pin' && sm.round.pinner !== null && sm.round.pinner !== id;
    const tipX =
      sm.phase === 'pin' && sm.round.pinner === id
        ? sm.thumbs[id === 'p1' ? 'p2' : 'p1'].pos.x
        : t.pos.x;
    drawThumb(ctx, {
      player: id,
      skin: id === 'p1' ? v.skin : v.foeSkin,
      tipX,
      reach: t.reach,
      squash: t.squash,
      pinned,
      w: DESIGN_W,
      h: H,
    });
  }
  drawHoleRim(ctx, 'p2', v.stage, DESIGN_W, H);
  drawHoleRim(ctx, 'p1', v.stage, DESIGN_W, H);
  new BattleHud().draw(ctx, v, DESIGN_W, H, now);
}

const battleView = (sm: StateMachine, over: Partial<BattleView> = {}): BattleView => ({
  sm,
  settings,
  mode: { kind: 'solo', difficulty: 'contender' },
  stage: STAGES[1],
  skin: skinById(DEFAULT_SAVE.skin),
  foeSkin: FOE_SKIN,
  shout: '',
  shoutUntil: 0,
  capsEarned: 180,
  ...over,
});

console.log('Rendering 6.9" App Store screenshots:');

shot('1-title', (ctx) => drawTitle(ctx, menu(), DESIGN_W, H, 1200));

shot('2-chant', (ctx) => {
  const sm = smAt('chant');
  sm.round.beat = 3;
  arena(ctx, battleView(sm), 2000);
  caption(ctx, 'So-da Pop, 1, 2, 3!', 'Line up your thumb while the chant runs');
});

shot('3-pin', (ctx) => {
  const sm = smAt('pin');
  arena(ctx, battleView(sm), 3000);
  caption(ctx, 'Pin them to win', 'Trapped? Tap fast to break free');
});

shot('4-versus', (ctx) => {
  const sm = smAt('strike');
  arena(
    ctx,
    battleView(sm, { mode: { kind: 'versus' }, stage: VERSUS_STAGE, foeSkin: SKINS[1] }),
    5000,
  );
  caption(ctx, 'Two players, one phone', 'Share the crate and settle it');
});

shot('5-thumbs', (ctx) => {
  drawThumbs(ctx, menu({ skinCursor: 5 }), DESIGN_W, H);
});

shot('6-stages', (ctx) => {
  drawStages(ctx, menu(), DESIGN_W, H);
});

shot('7-win', (ctx) => {
  const sm = smAt('pin');
  sm.match.roundsWon.p1 = 3;
  sm.match.roundsWon.p2 = 1;
  sm.match.matchWinner = 'p1';
  sm.round.phase = 'matchEnd';
  const v = battleView(sm);
  arena(ctx, v, 4000);
  drawMatchEnd(ctx, v, DESIGN_W, H, true, null);
});
