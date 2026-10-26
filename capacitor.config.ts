import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ecommerce360.dashboard',
  appName: 'ecommerce360',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      showSpinner: false,
    },
  },
};

export default config;
