import { Preferences } from '@capacitor/preferences';
import type { PlayerId, Profile } from '../types';

const KEY = 'sodapop.profiles';

/**
 * On-device player profiles. Two default seats ("Orange" / "Blue") so the
 * game works instantly; players can rename in a future profile screen.
 * Fully offline — nothing ever leaves the device.
 */
export class ProfileStore {
  private profiles: Record<PlayerId, Profile> = {
    p1: { id: 'p1', name: 'Orange', wins: 0, losses: 0 },
    p2: { id: 'p2', name: 'Blue', wins: 0, losses: 0 },
  };

  async load(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: KEY });
      if (value) this.profiles = { ...this.profiles, ...(JSON.parse(value) as typeof this.profiles) };
    } catch {
      /* fresh install — defaults are fine */
    }
  }

  get(player: PlayerId): Profile {
    return this.profiles[player];
  }

  async recordMatch(winner: PlayerId): Promise<void> {
    const loser: PlayerId = winner === 'p1' ? 'p2' : 'p1';
    this.profiles[winner].wins += 1;
    this.profiles[loser].losses += 1;
    await Preferences.set({ key: KEY, value: JSON.stringify(this.profiles) });
  }

  async rename(player: PlayerId, name: string): Promise<void> {
    this.profiles[player].name = name.slice(0, 16);
    await Preferences.set({ key: KEY, value: JSON.stringify(this.profiles) });
  }
}
