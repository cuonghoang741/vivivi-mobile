import { getSupabaseClient } from './supabase';
import { authManager } from './AuthManager';
import { executeSupabaseRequest } from '../utils/supabaseHelpers';

export interface UserCharacterPreference {
  character_id: string;
  current_costume_id?: string;
  current_background_id?: string;
}

/**
 * Service to load and apply user character preferences (costume and background)
 * Matching Swift version's loadUserCharacterPreference function
 */
export class UserCharacterPreferenceService {
  /**
   * Load user character preferences for a specific character
   * Returns costume_id and background_id if available
   */
  static async loadUserCharacterPreference(characterId: string): Promise<{
    costumeId?: string;
    backgroundId?: string;
  }> {
    try {
      const queryItems: Record<string, string> = {
        select: 'current_costume_id,current_background_id',
        character_id: `eq.${characterId}`,
      };

      // Add auth filters
      const userId = authManager.user?.id;
      if (userId) {
        queryItems.user_id = `eq.${userId.toLowerCase()}`;
      } else {
        const clientId = await authManager.getClientId();
        if (clientId) {
          queryItems.client_id = `eq.${clientId}`;
        }
      }

      const data = await executeSupabaseRequest<UserCharacterPreference[]>(
        '/rest/v1/user_character',
        queryItems,
        'GET'
      );

      if (data && data.length > 0) {
        const row = data[0];
        return {
          costumeId: row.current_costume_id || undefined,
          backgroundId: row.current_background_id || undefined,
        };
      }

      return {};
    } catch (error) {
      console.error('❌ [UserCharacterPreferenceService] Error loading preferences:', error);
      return {};
    }
  }

  /**
   * Apply costume by ID (load costume details and apply to WebView)
   * Matching Swift version's applyCostumeById
   */
  static async applyCostumeById(
    costumeId: string,
    webViewRef: any
  ): Promise<void> {
    try {
      const queryItems: Record<string, string> = {
        select: 'costume_name,model_url,url',
        id: `eq.${costumeId}`,
        limit: '1',
      };

      const data = await executeSupabaseRequest<any[]>(
        '/rest/v1/character_costumes',
        queryItems,
        'GET'
      );

      if (data && data.length > 0) {
        const costume = data[0];
        const modelURL = costume.model_url;
        const urlName = costume.url;
        const costumeName = costume.costume_name;

        if (webViewRef?.current) {
          if (modelURL && costumeName) {
            // Load by URL
            const escapedURL = modelURL.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            const escapedName = costumeName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            const js = `window.loadModelByURL("${escapedURL}", "${escapedName}");`;
            webViewRef.current.injectJavaScript(`(async()=>{try{const r=(function(){${js}})(); if(r&&typeof r.then==='function'){await r;} return 'READY';}catch(e){return 'READY';}})();`);
            console.log('✅ [UserCharacterPreferenceService] Applied costume by URL:', costumeName);
          } else if (urlName) {
            // Load by name
            const modelName = `${urlName}.vrm`;
            const escaped = modelName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            const js = `window.loadModelByName("${escaped}");`;
            webViewRef.current.injectJavaScript(`(async()=>{try{const r=(function(){${js}})(); if(r&&typeof r.then==='function'){await r;} return 'READY';}catch(e){return 'READY';}})();`);
            console.log('✅ [UserCharacterPreferenceService] Applied costume by name:', modelName);
          }
        }
      }
    } catch (error) {
      console.error('❌ [UserCharacterPreferenceService] Error applying costume:', error);
    }
  }

  /**
   * Apply background by ID (load background details and apply to WebView)
   * Matching Swift version's applyBackgroundById
   */
  static async applyBackgroundById(
    backgroundId: string,
    webViewRef: any,
    ownedBackgroundIds: Set<string>
  ): Promise<void> {
    // Only apply backgrounds the user owns
    if (!ownedBackgroundIds.has(backgroundId)) {
      console.warn('⚠️ [UserCharacterPreferenceService] User does not own background:', backgroundId);
      return;
    }

    try {
      const { BackgroundRepository } = await import('../repositories/BackgroundRepository');
      const backgroundRepo = new BackgroundRepository();
      const background = await backgroundRepo.fetchBackground(backgroundId);

      if (background && webViewRef?.current) {
        const escaped = background.image.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const js = `window.setBackgroundImage&&window.setBackgroundImage("${escaped}");`;
        webViewRef.current.injectJavaScript(js);
        console.log('✅ [UserCharacterPreferenceService] Applied background:', background.name);
      }
    } catch (error) {
      console.error('❌ [UserCharacterPreferenceService] Error applying background:', error);
    }
  }

  /**
   * Load fallback model (character's base model)
   * Matching Swift version's loadFallbackModel
   */
  static loadFallbackModel(
    modelName: string | null,
    modelURL: string | null,
    webViewRef: any
  ): void {
    if (!modelURL || !modelName || !webViewRef?.current) {
      return;
    }

    try {
      const escapedURL = modelURL.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const escapedName = modelName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const js = `window.loadModelByURL("${escapedURL}", "${escapedName}");`;
      webViewRef.current.injectJavaScript(`(async()=>{try{const r=(function(){${js}})(); if(r&&typeof r.then==='function'){await r;} return 'READY';}catch(e){return 'READY';}})();`);
      console.log('✅ [UserCharacterPreferenceService] Loaded fallback model:', modelName);
    } catch (error) {
      console.error('❌ [UserCharacterPreferenceService] Error loading fallback model:', error);
    }
  }
}

