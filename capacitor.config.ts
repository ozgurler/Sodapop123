import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.emre.sodapop123',
  appName: 'Soda Pop 1, 2, 3',
  webDir: 'dist',
  // Fully offline: no server config, all assets bundled.
  ios: {
    contentInset: 'never',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
