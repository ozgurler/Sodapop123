import { Preferences } from '@capacitor/preferences';
import type { SaveData } from '../types';
import { DEFAULT_SKIN, SKINS } from '../game/content';

const KEY = 'sodapop.save';

/**
 * Local progression: bottle caps earned by winning matches, spent on cosmetic
 * thumbs. Entirely on-device — no purchases, no currency top-ups, no network.
 * That matters for the under-13 store listing: a closed local economy avoids
 * the in-app-purchase disclosures a real currency would drag in.
 */
export const DEFAULT_SAVE: SaveData = {
  caps: 0,
  unlocked: SKINS.filter((s) => s.cost === 0).map((s) => s.id),
  skin: DEFAULT_SKIN,
  stageIndex: 0,
  cleared: -1,
  wins: 0,
  losses: 0,
};

export class SaveStore {
  data: SaveData = { ...DEFAULT_SAVE, unlocked: [...DEFAULT_SAVE.unlocked] };

  async load(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: KEY });
      if (!value) return;
      const parsed = JSON.parse(value) as Partial<SaveData>;
      this.data = { ...this.data, ...parsed };
      // Free skins are always owned, even if an older save predates them.
      for (const s of SKINS) {
        if (s.cost === 0 && !this.data.unlocked.includes(s.id)) this.data.unlocked.push(s.id);
      }
    } catch {
      /* fresh install — defaults are fine */
    }
  }

  private async flush(): Promise<void> {
    try {
      await Preferences.set({ key: KEY, value: JSON.stringify(this.data) });
    } catch {
      /* storage full or unavailable — play on, just don't persist */
    }
  }

  owns(skinId: string): boolean {
    return this.data.unlocked.includes(skinId);
  }

  /** Buy a skin if there are enough caps. Returns whether it went through. */
  async unlock(skinId: string, cost: number): Promise<boolean> {
    if (this.owns(skinId)) return true;
    if (this.data.caps < cost) return false;
    this.data.caps -= cost;
    this.data.unlocked.push(skinId);
    this.data.skin = skinId;
    await this.flush();
    return true;
  }

  async selectSkin(skinId: string): Promise<void> {
    if (!this.owns(skinId)) return;
    this.data.skin = skinId;
    await this.flush();
  }

  async selectStage(index: number): Promise<void> {
    this.data.stageIndex = index;
    await this.flush();
  }

  async recordMatch(won: boolean, stageIndex: number, reward: number): Promise<void> {
    if (won) {
      this.data.wins += 1;
      this.data.caps += reward;
      this.data.cleared = Math.max(this.data.cleared, stageIndex);
    } else {
      this.data.losses += 1;
    }
    await this.flush();
  }
}
