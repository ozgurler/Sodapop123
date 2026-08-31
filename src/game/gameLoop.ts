/**
 * requestAnimationFrame loop targeting 60fps.
 * Logic updates and rendering are passed in as callbacks so the loop
 * stays reusable and testable.
 */
export class GameLoop {
  private rafId = 0;
  private running = false;

  constructor(
    private update: (now: number, dt: number) => void,
    private render: (now: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const tick = (now: number): void => {
      if (!this.running) return;
      const dt = Math.min(now - last, 50); // clamp long frames (tab switch, etc.)
      last = now;
      this.update(now, dt);
      this.render(now);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
