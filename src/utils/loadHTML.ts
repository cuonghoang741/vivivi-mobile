import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
// Import HTML content directly
import { HTML_CONTENT as IMPORTED_HTML } from '../assets/html/htmlContent';

/**
 * Load HTML content from bundled assets
 * Similar to Swift version's VRMWebView which loads from Bundle.main
 * 
 * Strategy:
 * 1. Try to read from bundle directory (production builds)
 * 2. In development, read directly from the source file using require/import
 * 3. Fallback: Use fetch to load from Metro bundler (development)
 */
export const loadHTMLContent = async (): Promise<string> => {
  try {
    // Method 1: Use directly imported HTML content (PRIORITY - most reliable)
    if (IMPORTED_HTML && IMPORTED_HTML.length > 10000) {
      console.log(`✅ Loaded HTML from direct import, length: ${IMPORTED_HTML.length} chars`);
      return IMPORTED_HTML;
    } else if (IMPORTED_HTML) {
      console.error('❌ WARNING: HTML content too short!', IMPORTED_HTML.length, 'chars (should be ~60KB)');
    }
    
    // Method 1b: Fallback to require (in case import doesn't work)
    try {
      const { HTML_CONTENT } = require('../assets/html/htmlContent');
      if (HTML_CONTENT && HTML_CONTENT.length > 10000) {
        console.log(`✅ Loaded HTML from require, length: ${HTML_CONTENT.length} chars`);
        return HTML_CONTENT;
      }
    } catch (e) {
      console.log('⚠️ Could not load HTML from require:', e instanceof Error ? e.message : String(e));
    }

    // Method 2: Try to read from bundle directory (production builds)
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const bundleDir = (FileSystem as any).bundleDirectory || '';
      const possiblePaths = [
        `${bundleDir}assets/html/index.html`,
        `${bundleDir}html/index.html`,
        `${bundleDir}index.html`,
      ];

      for (const path of possiblePaths) {
        try {
          const content = await FileSystem.readAsStringAsync(path);
          console.log(`✅ Loaded HTML from bundle: ${path}, length: ${content.length} chars`);
          if (content.length > 10000) {
            return content; // Only return if it's the real file
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    // Method 3: For development, embed HTML content directly
    // Since React Native doesn't have __dirname, we'll use a workaround
    // Import the HTML file as a string constant
    // Note: This requires the HTML to be imported/required, which we'll handle differently
    
    // Method 3a: Try to use expo-asset to load the HTML file
    if (__DEV__) {
      try {
        // Try to load as an asset using expo-asset
        // First, we need to ensure the file is in the assets folder
        const asset = Asset.fromModule(require('../../assets/html/index.html'));
        await asset.downloadAsync();
        if (asset.localUri) {
          const content = await FileSystem.readAsStringAsync(asset.localUri);
          console.log('✅ Loaded HTML via expo-asset');
          return content;
        }
      } catch (e) {
        console.log('Could not load via expo-asset:', e instanceof Error ? e.message : String(e));
      }
    }
    
    
    // If all methods fail, provide helpful error
    throw new Error(
      'HTML file not found.\n\n' +
      'Tried:\n' +
      '1. File system (development)\n' +
      '2. Bundle directory (production)\n' +
      '3. Expo asset\n\n' +
      'Solutions:\n' +
      '1. Ensure src/assets/html/index.html exists (should be ~60KB, not 3KB)\n' +
      '2. For development: Check file path and permissions\n' +
      '3. For production: Run "npx expo prebuild" and ensure file is bundled\n' +
      '4. Check that file is not the placeholder (index.html.ts)'
    );
  } catch (error) {
    console.error('❌ Error loading HTML:', error);
    throw error;
  }
};
