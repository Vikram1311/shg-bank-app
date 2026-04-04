import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shgbank.app',
  appName: 'SHG Bank',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
