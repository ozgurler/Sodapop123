import type { GameMode, PlayerId, Vec2 } from '../types';
import { STRIKE_SWIPE_FRACTION } from './constants';
import type { StateMachine } from './stateMachine';

/**
 * Multi-touch adapter with zone ownership as palm rejection:
 * - The crate splits into two half-screen zones (P1 bottom, P2 top).
 * - The FIRST touch in a zone claims it; extra touches in the same zone are
 *   ignored until the claiming touch lifts, so two thumbs never conflict.
 * - Each pointer stays bound to its player for its whole lifetime, even if the
 *   finger crosses the seam mid-swipe.
 * - In solo mode the whole screen belongs to P1; the computer owns P2.
 *
 * Pointer coordinates are converted to DESIGN space by the callback the
 * renderer supplies, so game logic never sees device pixels.
 */
export class TouchInput {
  private owners = new Map<number, PlayerId>();
  private claimed: Partial<Record<PlayerId, number>> = {};
  private mode: GameMode = { kind: 'versus' };
  /** Battle screen only — menus route their own taps. */
  private live = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private sm: StateMachine,
    private toDesign: (x: number, y: number) => Vec2,
  ) {
    canvas.addEventListener('pointerdown', this.onDown, { passive: false });
    canvas.addEventListener('pointermove', this.onMove, { passive: false });
    canvas.addEventListener('pointerup', this.onUp, { passive: false });
    canvas.addEventListener('pointercancel', this.onUp, { passive: false });
  }

  setMode(mode: GameMode): void {
    this.mode = mode;
    this.reset();
  }

  setLive(live: boolean): void {
    if (this.live === live) return;
    this.live = live;
    this.reset();
  }

  private reset(): void {
    this.owners.clear();
    this.claimed = {};
    this.sm.release('p1');
    this.sm.release('p2');
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
  }

  private zoneOf(y: number): PlayerId {
    if (this.mode.kind === 'solo') return 'p1'; // whole crate is yours
    return y > this.sm.height / 2 ? 'p1' : 'p2';
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.live) return;
    e.preventDefault();
    const p = this.toDesign(e.offsetX, e.offsetY);
    const player = this.zoneOf(p.y);
    if (this.claimed[player] !== undefined) return; // palm rejection
    this.claimed[player] = e.pointerId;
    this.owners.set(e.pointerId, player);
    this.canvas.setPointerCapture(e.pointerId);
    // Timestamp from the event, not the next frame — the 80ms clash window
    // is only honest if input time is the time the finger actually landed.
    this.sm.press(player, p, e.timeStamp);
  };

  private onMove = (e: PointerEvent): void => {
    const player = this.owners.get(e.pointerId);
    if (!player) return;
    e.preventDefault();
    const threshold = this.sm.height * STRIKE_SWIPE_FRACTION;
    this.sm.move(player, this.toDesign(e.offsetX, e.offsetY), e.timeStamp, threshold);
  };

  private onUp = (e: PointerEvent): void => {
    const player = this.owners.get(e.pointerId);
    if (!player) return;
    this.owners.delete(e.pointerId);
    if (this.claimed[player] === e.pointerId) delete this.claimed[player];
    this.sm.release(player);
  };
}
