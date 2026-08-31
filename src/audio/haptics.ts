import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

/**
 * Haptics wrapper: Capacitor Haptics on device, navigator.vibrate on web.
 * Each game moment gets a distinct pulse so the chant is feelable, not just audible.
 */
export class GameHaptics {
  constructor(private enabled: () => boolean) {}

  private get native(): boolean {
    return Capacitor.isNativePlatform();
  }

  private webVibrate(pattern: number | number[]): void {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  }

  /** Light tick on each chant beat. */
  async beat(): Promise<void> {
    if (!this.enabled()) return;
    if (this.native) await Haptics.impact({ style: ImpactStyle.Light });
    else this.webVibrate(12);
  }

  /** Heavier pulse on "three!" — the strike window opening. */
  async strikeOpen(): Promise<void> {
    if (!this.enabled()) return;
    if (this.native) await Haptics.impact({ style: ImpactStyle.Heavy });
    else this.webVibrate(40);
  }

  /** Satisfying thud when a strike pins. */
  async pin(): Promise<void> {
    if (!this.enabled()) return;
    if (this.native) await Haptics.notification({ type: NotificationType.Success });
    else this.webVibrate([30, 40, 60]);
  }

  /** Quick double-buzz on a fault. */
  async fault(): Promise<void> {
    if (!this.enabled()) return;
    if (this.native) await Haptics.notification({ type: NotificationType.Warning });
    else this.webVibrate([20, 30, 20]);
  }

  /** Fizzy celebration on match win. */
  async celebrate(): Promise<void> {
    if (!this.enabled()) return;
    if (this.native) {
      await Haptics.impact({ style: ImpactStyle.Medium });
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }), 120);
    } else this.webVibrate([40, 60, 80]);
  }
}
