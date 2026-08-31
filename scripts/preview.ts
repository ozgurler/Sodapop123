/**
 * Renders every screen to a PNG so layout can be eyeballed without a device.
 * Dev tooling only — never imported by the app. Run: npx tsx scripts/preview.ts
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { StateMachine } from '../src/game/stateMachine';
import { DESIGN_H, DESIGN_W, seamY } from '../src/game/geometry';
import { FOE_SKIN, SKINS, STAGES, VERSUS_STAGE, skinById } from '../src/game/content';
import { drawCrate, drawHole, drawHoleRim, drawThumb, drawAlignmentGuide } from '../src/render/crate';
import { BattleHud, drawMatchEnd, type BattleView } from '../src/render/hud';
import { drawHelp, drawStages, drawThumbs, drawTitle, type MenuView } from '../src/render/screens';
import { thumbTip } from '../src/game/geometry';
import { DEFAULT_SAVE } from '../src/data/save';
import type { PlayerId, Settings } from '../src/types';

GlobalFonts.registerFromPath('public/fonts/Baloo2-latin.woff2', 'Baloo 2');
GlobalFonts.registerFromPath('public/fonts/Nunito-latin.woff2', 'Nunito');

const W = DESIGN_W;
const H = DESIGN_H;

const settings: Settings = {
  chantSpeed: 'normal',
  leftHanded: false,
  colorblindSafe: true,
  hapticsEnabled: true,
  soundEnabled: true,
};

function frame(name: string, draw: (ctx: any) => void, h: number = H): void {
  const canvas = createCanvas(W * 2, h * 2);
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  writeFileSync(`preview/${name}.png`, canvas.toBuffer('image/png'));
  console.log(`  wrote preview/${name}.png`);
}

const menu = (over: Partial<MenuView> = {}): MenuView => ({
  save: { ...DEFAULT_SAVE, caps: 2400, cleared: 1 },
  skinCursor: 0,
  stageCursor: 1,
  soundOn: true,
  helpOpen: false,
  pressed: null,
  toast: '',
  ...over,
});

/** Drives a real match forward until it reaches the phase we want to shoot. */
function smAt(phase: string, versus = false): StateMachine {
  const sm = new StateMachine('normal', 0);
  sm.setLayout(W, H);
  sm.startMatch(0);
  let now = 0;
  const cx = W / 2;
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
  // Let the reach animation settle so thumbs are where they belong.
  for (let i = 0; i < 30; i++) sm.update(now + i);
  if (versus) sm.match.roundsWon.p2 = 1;
  return sm;
}

function battleView(sm: StateMachine, over: Partial<BattleView> = {}): BattleView {
  return {
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
  };
}

function arena(ctx: any, v: BattleView, now: number): void {
  const { sm } = v;
  drawCrate(ctx, v.stage, W, H);
  drawHole(ctx, 'p2', v.stage, W, H);
  drawHole(ctx, 'p1', v.stage, W, H);
  if (sm.phase === 'chant' || sm.phase === 'strike') {
    drawAlignmentGuide(ctx, thumbTip(sm.thumbs.p1, 'p1', W, H), thumbTip(sm.thumbs.p2, 'p2', W, H), sm.aligned);
  }
  const order: PlayerId[] =
    sm.phase === 'pin' && sm.round.pinner
      ? [sm.round.pinner === 'p1' ? 'p2' : 'p1', sm.round.pinner]
      : ['p2', 'p1'];
  for (const id of order) {
    const t = sm.thumbs[id];
    const pinned = sm.phase === 'pin' && sm.round.pinner !== null && sm.round.pinner !== id;
    const tipX =
      sm.phase === 'pin' && sm.round.pinner === id ? sm.thumbs[id === 'p1' ? 'p2' : 'p1'].pos.x : t.pos.x;
    drawThumb(ctx, { player: id, skin: id === 'p1' ? v.skin : v.foeSkin, tipX, reach: t.reach, squash: t.squash, pinned, w: W, h: H });
  }
  drawHoleRim(ctx, 'p2', v.stage, W, H);
  drawHoleRim(ctx, 'p1', v.stage, W, H);
  new BattleHud().draw(ctx, v, W, H, now);
}

frame('1-title', (ctx) => drawTitle(ctx, menu(), W, H, 1200));
frame('2-thumbs', (ctx) => drawThumbs(ctx, menu({ skinCursor: 5 }), W, H));
frame('3-stages', (ctx) => drawStages(ctx, menu(), W, H));

frame('4-intro', (ctx) => {
  const sm = new StateMachine('normal', 0);
  sm.setLayout(W, H);
  sm.startMatch(0);
  sm.update(900);
  arena(ctx, battleView(sm), 900);
});

frame('5-chant', (ctx) => {
  const sm = smAt('chant');
  sm.round.beat = 3;
  arena(ctx, battleView(sm), 2000);
});

frame('6-pin', (ctx) => {
  const sm = smAt('pin');
  arena(ctx, battleView(sm, { shout: 'POW!', shoutUntil: 1e9 }), 3000);
});

frame('7-matchend', (ctx) => {
  const sm = smAt('pin');
  sm.match.roundsWon.p1 = 3;
  sm.match.roundsWon.p2 = 1;
  sm.match.matchWinner = 'p1';
  sm.round.phase = 'matchEnd';
  const v = battleView(sm);
  arena(ctx, v, 4000);
  drawMatchEnd(ctx, v, W, H, true, null);
});

frame('8-versus', (ctx) => {
  const sm = smAt('strike');
  arena(ctx, battleView(sm, { mode: { kind: 'versus' }, stage: VERSUS_STAGE, foeSkin: SKINS[1] }), 5000);
});


// Shortest and tallest design boxes the renderer will ever hand a screen.
// Anything that collides here collides on a real device at that aspect.
frame('13-help', (ctx) => {
  drawTitle(ctx, menu(), W, H, 1200);
  drawHelp(ctx, menu({ helpOpen: true }), W, H);
});
frame('14-versus-end', (ctx) => {
  const sm = smAt('pin');
  sm.match.roundsWon.p1 = 3;
  sm.match.roundsWon.p2 = 2;
  sm.match.matchWinner = 'p1';
  sm.round.phase = 'matchEnd';
  const v = battleView(sm, {
    mode: { kind: 'versus' },
    stage: VERSUS_STAGE,
    skin: SKINS[5],
    foeSkin: SKINS[1],
    capsEarned: 0,
  });
  arena(ctx, v, 4000);
  drawMatchEnd(ctx, v, W, H, false, null);
});

frame('9-title-short', (ctx) => drawTitle(ctx, menu(), W, 760, 1200), 760);
frame('10-stages-short', (ctx) => drawStages(ctx, menu(), W, 760), 760);
frame('11-thumbs-short', (ctx) => drawThumbs(ctx, menu({ skinCursor: 5 }), W, 760), 760);
frame('12-title-tall', (ctx) => drawTitle(ctx, menu(), W, 1010, 1200), 1010);
