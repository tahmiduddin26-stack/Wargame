import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native shell config. Landscape is locked in the Android manifest
 * (android:screenOrientation on MainActivity); the web build falls back to the
 * OrientationGate screen (see src/ui/OrientationGate.tsx).
 *
 * The Android project is committed under android/. To build it:
 *   npm install
 *   npm run cap:sync:android   # builds the web app and copies it in
 *   open the android/ folder in Android Studio, or: cd android && ./gradlew assembleDebug
 *
 * android/ carries only the scaffold; its .gitignore excludes the copied web
 * assets and generated config, so cap:sync must run once after a fresh clone.
 *
 * iOS is not committed (it needs macOS). To add it:
 *   npm i @capacitor/ios && npx cap add ios && npx cap sync ios
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
