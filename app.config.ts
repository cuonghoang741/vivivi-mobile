import { ConfigContext, ExpoConfig } from 'expo/config';
import { version } from './package.json';
import './scripts/generateHtmlContent';

// EAS config
const EAS_PROJECT_ID = '05bd0c6c-5433-4468-a849-ccee180ba617'; // Will be set after running 'eas init'
const PROJECT_SLUG = 'vivivi';

// App production config
const APP_NAME = 'Roxie - Digital AI Girlfriend';
const BUNDLE_IDENTIFIER = 'com.vivivi';
const PACKAGE_NAME = 'com.eduto.roxie';
const ICON = './assets/icon.png';
const ANDROID_ICON_FOREGROUND = './assets/adaptive-icon.png';
const SCHEME = 'roxie';

export default ({ config }: ConfigContext): ExpoConfig => ({
  name: APP_NAME,
  icon: ICON,
  scheme: SCHEME,
  version,
  slug: PROJECT_SLUG,
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  
  extra: {
    eas: {
      projectId: EAS_PROJECT_ID,
    },
  },

  ios: {
    supportsTablet: true,
    bundleIdentifier: BUNDLE_IDENTIFIER,
    buildNumber: '1', // Will be auto-incremented by EAS
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        'We need access to your Camera to capture photos and videos for VRM interactions.',
      NSPhotoLibraryUsageDescription:
        'We need access to your Photo Library to save and load media files.',
      NSPhotoLibraryAddUsageDescription:
        'We need permission to add media files to your Photo Library when you save them.',
      NSMicrophoneUsageDescription:
        'We need access to your Microphone for voice conversations with VRM characters.',
    },
    requireFullScreen: false,
    usesAppleSignIn: true,
  },

  android: {
    adaptiveIcon: {
      backgroundColor: '#000000',
      foregroundImage: ANDROID_ICON_FOREGROUND,
    },
    package: PACKAGE_NAME,
    versionCode: 1, // Will be auto-incremented by EAS
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        data: [
          {
            scheme: SCHEME,
            host: 'auth',
            pathPrefix: '/callback',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },

  web: {
    output: 'single',
    favicon: './assets/favicon.png',
  },

  plugins: [
    'expo-updates',
    'expo-web-browser',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#000000',
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission:
          'We need access to your Photo Library to save and load media files.',
        savePhotosPermission:
          'We need permission to add media files to your Photo Library when you save them.',
        isAccessMediaLocationEnabled: true,
      },
    ],
  ],

  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
  },

  runtimeVersion: version,

  experiments: {
    typedRoutes: false,
    reactCompiler: false,
  },
});

