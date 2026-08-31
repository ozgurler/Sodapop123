import { C } from './theme';

/**
 * Gentle particle system: soda-bubble fizz bursts. Deliberately soft and
 * playful — small round bubbles that drift up and fade, never sharp shards.
 * The pool is fixed-size so the battle loop never allocates mid-frame.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number; // 1 → 0
  color: string;
}

const MAX = 160;

export class Effects {
  private pool: Particle[] = [];
  private live = 0;

  constructor() {
    for (let i = 0; i < MAX; i++) {
      this.pool.push({ x: 0, y: 0, vx: 0, vy: 0, r: 0, life: 0, color: C.gold });
    }
  }

  /** Soft fizz burst (strike lands, escape succeeds). */
  fizz(x: number, y: number, count = 14, color: string = C.gold): void {
    for (let i = 0; i < count && this.live < MAX; i++) {
      const p = this.pool[this.live++];
      const a = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 1.4;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed - 0.8; // bubbles drift upward
      p.r = 2 + Math.random() * 5;
      p.life = 1;
      p.color = color;
    }
  }

  /** Bigger, two-tone burst for a clash. */
  clash(x: number, y: number): void {
    this.fizz(x, y, 18, C.cherryLight);
    this.fizz(x, y, 18, C.tealLight);
  }

  update(dt: number): void {
    const k = dt / 16.67;
    for (let i = 0; i < this.live; i++) {
      const p = this.pool[i];
      p.x += p.vx * k * 2;
      p.y += p.vy * k * 2;
      p.vy -= 0.01 * k; // gentle buoyancy
      p.life -= 0.02 * k;
      if (p.life <= 0) {
        // Swap the dead particle to the end of the live range — no allocation.
        this.pool[i] = this.pool[this.live - 1];
        this.pool[this.live - 1] = p;
        this.live -= 1;
        i -= 1;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.live; i++) {
      const p = this.pool[i];
      ctx.globalAlpha = Math.max(0, p.life) * 0.85;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
