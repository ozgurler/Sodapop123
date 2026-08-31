/**
 * ═══════════════════ PLACEHOLDER AUDIO ═══════════════════
 * All sounds are synthesized with the Web Audio API so the game
 * is playable with zero asset files. Swap in recorded chant
 * voiceover + foley by replacing the bodies of these methods
 * with buffer playback — the call sites don't change.
 * The audio graph is created lazily on first user gesture
 * (required by iOS WebView autoplay policy).
 * ═════════════════════════════════════════════════════════
 */
export class GameAudio {
  private ctx: AudioContext | null = null;

  constructor(private enabled: () => boolean) {}

  /** Must be called from a user gesture at least once. */
  unlock(): void {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, durMs: number, type: OscillatorType = 'sine', gainPeak = 0.25): void {
    if (!this.enabled() || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.05);
  }

  /** Chant beat: rising notes so "three!" feels like a launch pad. */
  beat(index: number): void {
    const scale = [392, 392, 440, 494, 523, 659]; // G G A B C E — playground singsong
    this.tone(scale[Math.min(index, scale.length - 1)], index === 5 ? 260 : 140, 'triangle');
  }

  /** Rising blips for the "1, 2, 3, 4" declaration before a match. */
  introBeat(index: number): void {
    this.tone([523, 587, 659, 784][Math.min(index, 3)], 170, 'triangle', 0.22);
  }

  strike(): void {
    this.tone(220, 90, 'square', 0.18);
  }

  /** Satisfying pin thud. */
  pinThud(): void {
    this.tone(110, 220, 'sine', 0.4);
    this.tone(80, 300, 'sine', 0.3);
  }

  /** Airy swing-and-miss. */
  whiff(): void {
    this.tone(300, 90, 'sine', 0.07);
    setTimeout(() => this.tone(240, 110, 'sine', 0.05), 60);
  }

  fault(): void {
    this.tone(185, 120, 'sawtooth', 0.12);
    setTimeout(() => this.tone(147, 160, 'sawtooth', 0.12), 110);
  }

  clash(): void {
    this.tone(660, 120, 'square', 0.15);
    this.tone(495, 160, 'square', 0.15);
  }

  escapeTap(): void {
    this.tone(740, 50, 'triangle', 0.1);
  }

  /** Celebratory jingle on match win. */
  jingle(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => this.tone(f, 200, 'triangle', 0.22), i * 130));
  }
}
