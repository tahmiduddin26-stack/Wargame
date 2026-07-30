import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native shell config. Landscape is locked at the OS level here; the web build
 * falls back to the OrientationGate screen (see src/ui/OrientationGate.tsx).
 *
 * To generate the native projects:
 *   npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/android @capacitor/ios
 *   npx cap add android && npx cap add ios
 *   npm run cap:sync
 */
const config: CapacitorConfig = {
  appId: 'com.fieldcommand.ageofwar',
  appName: 'Age of War',
  webDir: 'dist',
  android: {
    // Keeps the GPU-composited canvas from being throttled behind the WebView.
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#12100e',
      showSpinner: false,
    },
  },
};

export default config;
