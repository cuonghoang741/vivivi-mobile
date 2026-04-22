import { registerRootComponent } from 'expo';
import { registerGlobals } from '@livekit/react-native';
import { LogBox } from 'react-native';

// Ignore all log notifications in the UI
LogBox.ignoreAllLogs();

import App from './App';

// Initialize WebRTC globals required by LiveKit
registerGlobals();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
