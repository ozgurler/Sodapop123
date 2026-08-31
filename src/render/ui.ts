import type { GameMode, PlayerId, Settings } from '../types';
import { CHANT_BEATS } from '../game/constants';
import type { StateMachine } from '../game/stateMachine';
import { PALETTE, drawPlayerBadge, playerColor } from './thumbArt';

export interface MenuButton {
  label: string;
  sub: string;
  x: number;
  y: number;
  w: number;
  h: number;
  mode: GameMode;
}

/** Lays out the mode-select buttons. Shared by the HUD and the hit test in main.ts. */
export function menuButtons(w: number, h: number): MenuButton[] {
  const bw = Math.min(w * 0.2, 190);
  const bh = h * 0.16;
  const gap = w * 0.025;
  const total = bw * 4 + gap * 3;
  const startX = (w - total) / 2;
  const y = h * 0.56;
  const defs: Array<{ label: string; sub: string; mode: GameMode }> = [
    { label: 'Rookie', sub: 'Computer · easy', mode: { kind: 'solo', difficulty: 'rookie' } },
    { label: 'Contender', sub: 'Computer · medium', mode: { kind: 'solo', difficulty: 'contender' } },
    { label: 'Champ', sub: 'Computer · hard', mode: { kind: 'solo', difficulty: 'champ' } },
    { label: '2 Players', sub: 'Same device', mode: { kind: 'versus' } },
  ];
  return defs.map((d, i) => ({ ...d, x: startX + i * (bw + gap), y, w: bw, h: bh }));
}

/**
 * HUD layer. Split-screen mirrored: everything drawn for P2 (top half) is
 * rotated 180° so both players read it right-side up.
 */
export class Hud {
  draw(
    ctx: CanvasRenderingContext2D,
    sm: StateMachine,
    settings: Settings,
    mode: GameMode,
    w: number,
    h: number,
    now: number,
  ): void {
    if (sm.phase === 'menu') {
      this.drawMenu(ctx, w, h, now);
      return;
    }

    this.drawHalf(ctx, sm, settings, w, h, 'p1', now);
    // In solo mode the opponent's half isn't read by a human, so skip the mirror
    // and label it instead — less clutter, and it reads as "the computer".
    if (mode.kind === 'versus') {
      ctx.save();
      ctx.translate(w, h);
      ctx.rotate(Math.PI);
      this.drawHalf(ctx, sm, settings, w, h, 'p2', now);
      ctx.restore();
    } else {
      this.drawOpponentStrip(ctx, sm, mode, w, h);
    }

    if (sm.phase === 'pin') this.drawPinMeter(ctx, sm, w, h);
  }

  private drawMenu(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void {
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.cream;
    ctx.font = `800 ${Math.round(h * 0.11)}px system-ui, sans-serif`;
    ctx.fillText('Soda Pop 1, 2, 3', w / 2, h * 0.26);
    ctx.font = `500 ${Math.round(h * 0.042)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(253,243,227,0.75)';
    ctx.fillText('Thumb War Version', w / 2, h * 0.35);
    ctx.font = `500 ${Math.round(h * 0.033)}px system-ui, sans-serif`;
    const pulse = 0.6 + 0.25 * Math.sin(now / 500);
    ctx.fillStyle = `rgba(253,243,227,${pulse.toFixed(2)})`;
    ctx.fillText('Slide to line up your thumb · swipe up on "GO!"', w / 2, h * 0.45);

    for (const b of menuButtons(w, h)) {
      ctx.fillStyle = 'rgba(253,243,227,0.10)';
      this.roundRect(ctx, b.x, b.y, b.w, b.h, 14);
      ctx.fill();
      ctx.strokeStyle = b.mode.kind === 'versus' ? PALETTE.p1 : PALETTE.p2;
      ctx.lineWidth = 2;
      this.roundRect(ctx, b.x, b.y, b.w, b.h, 14);
      ctx.stroke();
      ctx.fillStyle = PALETTE.cream;
      ctx.font = `700 ${Math.round(h * 0.042)}px system-ui, sans-serif`;
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h * 0.45);
      ctx.fillStyle = 'rgba(253,243,227,0.6)';
      ctx.font = `500 ${Math.round(h * 0.028)}px system-ui, sans-serif`;
      ctx.fillText(b.sub, b.x + b.w / 2, b.y + b.h * 0.75);
    }
  }

  /** Compact opponent readout for solo mode (top edge, unmirrored). */
  private drawOpponentStrip(
    ctx: CanvasRenderingContext2D,
    sm: StateMachine,
    mode: GameMode,
    w: number,
    h: number,
  ): void {
    const label = mode.kind === 'solo' ? `Computer · ${mode.difficulty}` : 'Blue';
    ctx.textAlign = 'left';
    ctx.font = `600 ${Math.round(h * 0.032)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(253,243,227,0.7)';
    ctx.fillText(label, w * 0.04, h * 0.08);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(w * 0.04 + 10 + i * 24, h * 0.13, 7, 0, Math.PI * 2);
      ctx.fillStyle = i < sm.match.roundsWon.p2 ? PALETTE.p2 : 'rgba(253,243,227,0.2)';
      ctx.fill();
    }
    for (let i = 0; i < sm.thumbs.p2.faults; i++) {
      ctx.beginPath();
      ctx.arc(w * 0.04 + 10 + i * 20, h * 0.19, 5, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.fault;
      ctx.fill();
    }
  }

  /** Draws one player's HUD in "bottom half" coordinates. */
  private drawHalf(
    ctx: CanvasRenderingContext2D,
    sm: StateMachine,
    settings: Settings,
    w: number,
    h: number,
    player: PlayerId,
    now: number,
  ): void {
    const mirror = settings.leftHanded ? -1 : 1;
    const edgeX = settings.leftHanded ? w * 0.06 : w * 0.94;

    ctx.textAlign = 'center';
    const wins = sm.match.roundsWon[player];
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(edgeX - mirror * i * 26, h * 0.93, 8, 0, Math.PI * 2);
      ctx.fillStyle = i < wins ? playerColor(player) : 'rgba(253,243,227,0.2)';
      ctx.fill();
    }

    for (let i = 0; i < sm.thumbs[player].faults; i++) {
      ctx.beginPath();
      ctx.arc(edgeX - mirror * i * 22, h * 0.86, 6, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.fault;
      ctx.fill();
    }

    if (settings.colorblindSafe) {
      drawPlayerBadge(ctx, player, settings.leftHanded ? w * 0.94 : w * 0.06, h * 0.93, 9);
    }

    if (sm.phase === 'chant' || sm.phase === 'strike') {
      const totalBeats = CHANT_BEATS.length;
      const spacing = Math.min(52, (w * 0.42) / totalBeats);
      const startX = w / 2 - ((totalBeats - 1) / 2) * spacing;
      for (let i = 0; i < totalBeats; i++) {
        const lit = i <= sm.round.beat || sm.phase === 'strike';
        const isGo = i === totalBeats - 1;
        ctx.beginPath();
        ctx.arc(startX + i * spacing, h * 0.68, isGo ? 11 : 7, 0, Math.PI * 2);
        ctx.fillStyle = lit ? (isGo ? PALETTE.cream : playerColor(player)) : 'rgba(253,243,227,0.15)';
        ctx.fill();
      }
      const label =
        sm.phase === 'strike' ? 'GO!' : sm.round.beat >= 0 ? CHANT_BEATS[sm.round.beat] : '';
      if (label) {
        const pulse = 1 + 0.06 * Math.sin(now / 90);
        ctx.font = `700 ${Math.round(h * 0.055 * pulse)}px system-ui, sans-serif`;
        ctx.fillStyle = PALETTE.cream;
        ctx.fillText(label, w / 2, h * 0.79);
      }
    }
  }

  /**
   * Two bars: the pin timer closing in, and the trapped player's escape
   * progress. Seeing the escape bar respond to each tap is what makes the
   * mechanic legible — without it, tapping feels like it does nothing.
   */
  private drawPinMeter(ctx: CanvasRenderingContext2D, sm: StateMachine, w: number, h: number): void {
    const barW = w * 0.34;
    const barH = 14;
    const x = (w - barW) / 2;
    const pinY = h * 0.13;
    const escY = h * 0.83;

    const bar = (y: number, frac: number, color: string, label: string): void => {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      this.roundRect(ctx, x - 4, y - 4, barW + 8, barH + 8, 11);
      ctx.fill();
      ctx.fillStyle = color;
      this.roundRect(ctx, x, y, Math.max(2, barW * frac), barH, 7);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.font = `600 ${Math.round(h * 0.028)}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(253,243,227,0.85)';
      ctx.fillText(label, w / 2, y - 10);
    };

    bar(pinY, sm.round.pinMeter, sm.round.pinner ? playerColor(sm.round.pinner) : PALETTE.cream, 'PIN');
    bar(escY, sm.escapeProgress, PALETTE.fizz, 'ESCAPE');

    // Prompt for whoever is trapped (P1 is always the human in solo mode).
    if (sm.round.pinner === 'p2') {
      ctx.textAlign = 'center';
      ctx.font = `800 ${Math.round(h * 0.05)}px system-ui, sans-serif`;
      ctx.fillStyle = PALETTE.cream;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 5;
      ctx.strokeText('TAP FAST!', w / 2, h * 0.72);
      ctx.fillText('TAP FAST!', w / 2, h * 0.72);
    }
  }

  private roundRect(
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
}
