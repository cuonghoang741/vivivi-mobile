import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersistKeys } from '../config/supabase';

type CharacterBackgroundSelection = {
  backgroundId?: string;
  backgroundURL?: string;
  backgroundName?: string;
};

type CharacterCostumeSelection = {
  costumeId?: string | null;
  modelName?: string;
  modelURL?: string;
};

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
    const globalBackgroundURL = await this.getBackgroundURL();
    const currentCharacterId = await AsyncStorage.getItem(PersistKeys.characterId);
    const backgroundSelection =
      currentCharacterId && (await this.getCharacterBackgroundSelection(currentCharacterId));
    const costumeSelection =
      currentCharacterId && (await this.getCharacterCostumeSelection(currentCharacterId));

    const effectiveModelName = costumeSelection?.modelName || modelName;
    const effectiveModelURL = costumeSelection?.modelURL || modelURL;
    const effectiveBackgroundURL = backgroundSelection?.backgroundURL || globalBackgroundURL;

    let inject = '';
    
    // Escape strings for JavaScript (similar to Swift's escaping)
    const escapeJS = (str: string): string => {
      return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    };

    if (effectiveModelName) {
      inject += `window.nativeSelectedModelName="${escapeJS(effectiveModelName)}";\n`;
    }
    if (effectiveModelURL) {
      inject += `window.nativeSelectedModelURL="${escapeJS(effectiveModelURL)}";\n`;
    }
    if (effectiveBackgroundURL) {
      inject += `window.initialBackgroundUrl="${escapeJS(effectiveBackgroundURL)}";\n`;
    }

    return inject;
  }

  private static async readBackgroundSelectionMap(): Promise<Record<string, CharacterBackgroundSelection>> {
    const raw = await AsyncStorage.getItem(PersistKeys.backgroundSelections);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, CharacterBackgroundSelection>;
      }
      return {};
    } catch {
      return {};
    }
  }

  private static async writeBackgroundSelectionMap(
    map: Record<string, CharacterBackgroundSelection>
  ): Promise<void> {
    const hasEntries = Object.keys(map).length > 0;
    if (hasEntries) {
      await AsyncStorage.setItem(PersistKeys.backgroundSelections, JSON.stringify(map));
    } else {
      await AsyncStorage.removeItem(PersistKeys.backgroundSelections);
    }
  }

  static async setCharacterBackgroundSelection(
    characterId: string,
    selection?: CharacterBackgroundSelection | null
  ): Promise<void> {
    if (!characterId) {
      return;
    }
    const map = await this.readBackgroundSelectionMap();
    if (!selection || (!selection.backgroundId && !selection.backgroundURL)) {
      delete map[characterId];
      await this.writeBackgroundSelectionMap(map);
      return;
    }
    map[characterId] = {
      backgroundId: selection.backgroundId,
      backgroundURL: selection.backgroundURL,
      backgroundName: selection.backgroundName,
    };
    await this.writeBackgroundSelectionMap(map);
  }

  static async getCharacterBackgroundSelection(
    characterId: string
  ): Promise<CharacterBackgroundSelection | null> {
    if (!characterId) {
      return null;
    }
    const map = await this.readBackgroundSelectionMap();
    return map[characterId] ?? null;
  }

  private static async readCostumeSelectionMap(): Promise<Record<string, CharacterCostumeSelection>> {
    const raw = await AsyncStorage.getItem(PersistKeys.costumeSelections);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, CharacterCostumeSelection>;
      }
      return {};
    } catch {
      return {};
    }
  }

  private static async writeCostumeSelectionMap(
    map: Record<string, CharacterCostumeSelection>
  ): Promise<void> {
    const hasEntries = Object.keys(map).length > 0;
    if (hasEntries) {
      await AsyncStorage.setItem(PersistKeys.costumeSelections, JSON.stringify(map));
    } else {
      await AsyncStorage.removeItem(PersistKeys.costumeSelections);
    }
  }

  static async setCharacterCostumeSelection(
    characterId: string | null | undefined,
    selection?: CharacterCostumeSelection | null
  ): Promise<void> {
    if (!characterId) {
      return;
    }
    const map = await this.readCostumeSelectionMap();
    if (!selection || (!selection.costumeId && !selection.modelName && !selection.modelURL)) {
      delete map[characterId];
      await this.writeCostumeSelectionMap(map);
      return;
    }
    map[characterId] = {
      costumeId: selection.costumeId ?? null,
      modelName: selection.modelName,
      modelURL: selection.modelURL,
    };
    await this.writeCostumeSelectionMap(map);
  }

  static async getCharacterCostumeSelection(
    characterId: string
  ): Promise<CharacterCostumeSelection | null> {
    if (!characterId) {
      return null;
    }
    const map = await this.readCostumeSelectionMap();
    return map[characterId] ?? null;
  }
}

