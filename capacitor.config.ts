import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native shell template. Set and verify landscape orientation in each generated
 * native project; the web build uses src/ui/OrientationGate.tsx.
 *
 * To generate the native projects:
 *   npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/android @capacitor/ios
 *   npx cap add android && npx cap add ios
 *   npm run cap:sync
 */
const config: CapacitorConfig = {
  appId: 'com.fieldcommand.ageofwar',
  appName: 'Doodlebook Battles',
  webDir: 'dist',
  android: {
    // Release template: keep remote WebView debugging disabled.
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#12100e',
      showSpinner: false,
    },
  },
};

export default config;
