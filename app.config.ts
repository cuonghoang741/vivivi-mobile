import { ConfigContext, ExpoConfig } from 'expo/config';
import { version } from './package.json';
import './scripts/generateHtmlContent';

// EAS config
const EAS_PROJECT_ID = '05bd0c6c-5433-4468-a849-ccee180ba617'; // Will be set after running 'eas init'
const PROJECT_SLUG = 'vivivi';

// App production config
const APP_NAME = 'Yukie';
const BUNDLE_IDENTIFIER = 'com.vivivi';
const PACKAGE_NAME = 'com.eduto.yukie';
const ICON = './assets/icon.png';
const ANDROID_ICON_FOREGROUND = './assets/adaptive-icon.png';
const SCHEME = 'yukie';

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
    oneSignalAppId: '52139459-74d3-47a7-9f5c-80e07e93265c',
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
      // NSUserTrackingUsageDescription:
      //   'This identifier will be used to deliver personalized ads to you.',
    },
    requireFullScreen: false,
    usesAppleSignIn: true,
    googleServicesFile: './GoogleService-Info.plist',
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
    googleServicesFile: './google-services.json',
  },

  web: {
    output: 'single',
    favicon: './assets/icon.png',
  },

  plugins: [
    [
      'onesignal-expo-plugin',
      {
        mode: 'production',
      },
    ],
    'react-native-appsflyer',
    '@livekit/react-native-expo-plugin',
    './withCustomPodfile',
    'expo-updates',
    [
      './withFacebookConfig',
      {
        appId: '1217703997132677',
        displayName: 'Yukie',
        clientToken: 'bf147c448ca2780663c32b64a6aff490',
      },
    ],
    'expo-web-browser',
    '@react-native-firebase/app',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-screen.png',
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
    'expo-localization',
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

