import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.locationcircle.app',
  appName: 'LocationCircle',
  webDir: 'dist',
  server: {
    // Use https scheme so that web APIs (geolocation, etc.) work on Android
    androidScheme: 'https',
    // Uncomment the line below during development to load from your dev server:
    // url: 'http://192.168.x.x:5173',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0b141a',
      showSpinner: true,
      spinnerColor: '#14b8a6',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0b141a',
    },
  },
};

export default config;

