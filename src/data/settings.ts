import { Preferences } from '@capacitor/preferences';
import type { Settings } from '../types';

const KEY = 'sodapop.settings';

export const DEFAULT_SETTINGS: Settings = {
  chantSpeed: 'normal',
  leftHanded: false,
  colorblindSafe: false,
  hapticsEnabled: true,
  soundEnabled: true,
};

/** Capacitor Preferences works on iOS, Android, and web (localStorage under the hood). */
export async function loadSettings(): Promise<Settings> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(value) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await Preferences.set({ key: KEY, value: JSON.stringify(settings) });
}
