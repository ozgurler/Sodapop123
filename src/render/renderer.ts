import type { GameMode, PlayerId, Screen, Settings, Skin, Stage, Vec2 } from '../types';
import type { StateMachine } from '../game/stateMachine';
import { DESIGN_W, thumbTip } from '../game/geometry';
import { C } from './theme';
import { FOE_SKIN } from '../game/content';
import { Effects } from './effects';
import { BattleHud, drawMatchEnd, type BattleView } from './hud';
import { drawHelp, drawStages, drawThumbs, drawTitle, type MenuView } from './screens';
import { drawAlignmentGuide, drawCrate, drawHole, drawHoleRim, drawThumb } from './crate';

/**
 * Canvas orchestrator. Everything is drawn in a fixed DESIGN space 402px wide
 * and then uniformly scaled to the device, so the mockup's spacing survives
 * every screen size.
 *
 * Vertical layout stretches, but only within MIN/MAX_DESIGN_H. Scaling off the
 * viewport WIDTH alone works on a phone and falls apart anywhere else: a
 * 1400x900 desktop window gives a scale of 3.5, which leaves ~257px of design
 * height for a layout that assumes ~874, so everything anchored to the bottom
 * lands off-canvas. Taking the smaller of the two fits and letterboxing the
 * remainder keeps the play area phone-shaped on any display.
 */
/** Shortest design height the screens are laid out to survive. */
const MIN_DESIGN_H = 760;
/** Tallest — past this the crate stretches into a corridor. */
const MAX_DESIGN_H = 1010;
export class Renderer {
  readonly effects = new Effects();
  private hud = new BattleHud();
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private scale = 1;
  private designH = MIN_DESIGN_H;
  /** Letterbox offsets, in CSS px. */
  private offX = 0;
  private offY = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = this.canvas.clientWidth || window.innerWidth;
    const ch = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(cw * this.dpr);
    this.canvas.height = Math.round(ch * this.dpr);

    const s = Math.min(cw / DESIGN_W, ch / MIN_DESIGN_H);
    this.scale = s;
    this.designH = Math.max(MIN_DESIGN_H, Math.min(MAX_DESIGN_H, ch / s));
    this.offX = (cw - DESIGN_W * s) / 2;
    this.offY = (ch - this.designH * s) / 2;
  }

  /** Design-space width — always DESIGN_W. */
  get width(): number {
    return DESIGN_W;
  }

  /** Design-space height for the current viewport, clamped to a playable range. */
  get height(): number {
    return this.designH;
  }

  /** Convert CSS pixels from a pointer event into design space. */
  toDesign = (x: number, y: number): Vec2 => ({
    x: (x - this.offX) / this.scale,
    y: (y - this.offY) / this.scale,
  });

  private begin(): void {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Paint the letterbox before transforming, so the bars are a deliberate
    // surround rather than whatever was in the buffer last frame.
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.offX, this.offY);
    ctx.scale(this.scale, this.scale);
    // Clip so nothing bleeds into the bars — screens draw full-bleed backgrounds.
    ctx.beginPath();
    ctx.rect(0, 0, DESIGN_W, this.designH);
    ctx.clip();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }

  drawMenu(screen: Exclude<Screen, 'battle'>, v: MenuView, now: number): void {
    this.begin();
    const w = this.width;
    const h = this.height;
    if (screen === 'title') {
      drawTitle(this.ctx, v, w, h, now);
      if (v.helpOpen) drawHelp(this.ctx, v, w, h);
    } else if (screen === 'thumbs') {
      drawThumbs(this.ctx, v, w, h);
    } else {
      drawStages(this.ctx, v, w, h);
    }
  }

  drawBattle(v: BattleView, now: number, dt: number, canAdvance: boolean, pressed: string | null): void {
    this.begin();
    const { ctx } = this;
    const w = this.width;
    const h = this.height;
    const { sm, stage } = v;

    drawCrate(ctx, stage, w, h);
    drawHole(ctx, 'p2', stage, w, h);
    drawHole(ctx, 'p1', stage, w, h);
    this.drawThumbs(ctx, sm, v.skin, v.foeSkin, w, h);
    drawHoleRim(ctx, 'p2', stage, w, h);
    drawHoleRim(ctx, 'p1', stage, w, h);

    this.effects.update(dt);
    this.effects.draw(ctx);

    this.hud.draw(ctx, v, w, h, now);
    if (sm.phase === 'matchEnd') drawMatchEnd(ctx, v, w, h, canAdvance, pressed);
  }

  /**
   * Only the thumbs move. Each rises from its bottle-hole; aiming leans it
   * sideways, striking lunges it across the seam. During a pin the winner's
   * thumb is drawn last so it sits visibly on top of the loser's.
   */
  private drawThumbs(
    ctx: CanvasRenderingContext2D,
    sm: StateMachine,
    skin: Skin,
    foeSkin: Skin,
    w: number,
    h: number,
  ): void {
    if (sm.phase === 'chant' || sm.phase === 'strike') {
      drawAlignmentGuide(
        ctx,
        thumbTip(sm.thumbs.p1, 'p1', w, h),
        thumbTip(sm.thumbs.p2, 'p2', w, h),
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
      // The winning thumb slides over onto its opponent's.
      const tipX =
        sm.phase === 'pin' && sm.round.pinner === id
          ? sm.thumbs[id === 'p1' ? 'p2' : 'p1'].pos.x
          : t.pos.x;
      drawThumb(ctx, {
        player: id,
        skin: id === 'p1' ? skin : foeSkin,
        tipX,
        reach: t.reach,
        squash: t.squash,
        pinned,
        w,
        h,
      });
    }
  }
}

export { FOE_SKIN };
export type { BattleView, MenuView, GameMode, Settings, Stage };
