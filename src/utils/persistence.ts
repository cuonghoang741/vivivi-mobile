import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersistKeys } from '../config/supabase';

/**
 * Persistence utilities similar to Swift's UserDefaults
 * Used to store and retrieve persisted selections for VRM models and backgrounds
 */
export class Persistence {
  /**
   * Get persisted model name
   */
  static async getModelName(): Promise<string> {
    return (await AsyncStorage.getItem(PersistKeys.modelName)) || '';
  }

  /**
   * Set persisted model name
   */
  static async setModelName(name: string): Promise<void> {
    await AsyncStorage.setItem(PersistKeys.modelName, name);
  }

  /**
   * Get persisted model URL
   */
  static async getModelURL(): Promise<string> {
    return (await AsyncStorage.getItem(PersistKeys.modelURL)) || '';
  }

  /**
   * Set persisted model URL
   */
  static async setModelURL(url: string): Promise<void> {
    await AsyncStorage.setItem(PersistKeys.modelURL, url);
  }

  /**
   * Get persisted background URL
   */
  static async getBackgroundURL(): Promise<string> {
    return (await AsyncStorage.getItem(PersistKeys.backgroundURL)) || '';
  }

  /**
   * Set persisted background URL
   */
  static async setBackgroundURL(url: string): Promise<void> {
    await AsyncStorage.setItem(PersistKeys.backgroundURL, url);
  }

  /**
   * Get persisted background name
   */
  static async getBackgroundName(): Promise<string> {
    return (await AsyncStorage.getItem(PersistKeys.backgroundName)) || '';
  }

  /**
   * Set persisted background name
   */
  static async setBackgroundName(name: string): Promise<void> {
    await AsyncStorage.setItem(PersistKeys.backgroundName, name);
  }

  /**
   * Generate injection script for persisted selections
   * Similar to Swift version's injection script
   */
  static async generateInjectionScript(): Promise<string> {
    const modelName = await this.getModelName();
    const modelURL = await this.getModelURL();
    const backgroundURL = await this.getBackgroundURL();

    let inject = '';
    
    // Escape strings for JavaScript (similar to Swift's escaping)
    const escapeJS = (str: string): string => {
      return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    };

    if (modelName) {
      inject += `window.nativeSelectedModelName="${escapeJS(modelName)}";\n`;
    }
    if (modelURL) {
      inject += `window.nativeSelectedModelURL="${escapeJS(modelURL)}";\n`;
    }
    if (backgroundURL) {
      inject += `window.initialBackgroundUrl="${escapeJS(backgroundURL)}";\n`;
    }

    return inject;
  }
}

