import { getSupabaseClient } from './supabase';
import { authManager } from './AuthManager';
import { executeSupabaseRequest } from '../utils/supabaseHelpers';
import { Persistence } from '../utils/persistence';

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
      if (!userId) {
        throw new Error('User is not authenticated');
      }
      queryItems.user_id = `eq.${userId.toLowerCase()}`;

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
  static async loadCostumeMetadata(costumeId: string): Promise<{
    costumeName?: string;
    modelURL?: string;
    urlName?: string;
  } | null> {
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
    if (!data || data.length === 0) {
      return null;
    }
    const costume = data[0];
    return {
      costumeName: costume.costume_name ?? undefined,
      modelURL: costume.model_url ?? undefined,
      urlName: costume.url ?? undefined,
    };
  }

  static async applyCostumeById(
    costumeId: string,
    webViewRef: any,
    characterId?: string
  ): Promise<void> {
    try {
      const meta = await this.loadCostumeMetadata(costumeId);
      if (!meta) return;

      const { costumeName, modelURL, urlName } = meta;

      if (webViewRef?.current) {
        if (modelURL && costumeName) {
          const escapedURL = modelURL.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          const escapedName = costumeName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          const js = `window.loadModelByURL("${escapedURL}", "${escapedName}");`;
          webViewRef.current.injectJavaScript(`(async()=>{try{const r=(function(){${js}})(); if(r&&typeof r.then==='function'){await r;} return 'READY';}catch(e){return 'READY';}})();`);
          await Persistence.setModelName(costumeName);
          await Persistence.setModelURL(modelURL);
          if (characterId) {
            await Persistence.setCharacterCostumeSelection(characterId, {
              costumeId,
              modelName: costumeName,
              modelURL,
            });
          }
          console.log('✅ [UserCharacterPreferenceService] Applied costume by URL:', costumeName);
          return;
        }
        if (urlName) {
          const modelName = `${urlName}.vrm`;
          const escaped = modelName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          const js = `window.loadModelByName("${escaped}");`;
          webViewRef.current.injectJavaScript(`(async()=>{try{const r=(function(){${js}})(); if(r&&typeof r.then==='function'){await r;} return 'READY';}catch(e){return 'READY';}})();`);
          await Persistence.setModelName(modelName);
          await Persistence.setModelURL('');
          if (characterId) {
            await Persistence.setCharacterCostumeSelection(characterId, {
              costumeId,
              modelName,
              modelURL: '',
            });
          }
          console.log('✅ [UserCharacterPreferenceService] Applied costume by name:', modelName);
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
        if (background.video_url) {
          const escaped = background.video_url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          // Try setBackgroundVideo, if not falling back to whatever the web might support (e.g. setBackgroundImage might handle it if smart enough)
          // But best to call specific method if we want specific behavior.
          // Assuming the web side is/will be updated to support setBackgroundVideo
          const js = `window.setBackgroundVideo && window.setBackgroundVideo("${escaped}");`;
          webViewRef.current.injectJavaScript(js);
          await Persistence.setBackgroundURL(background.video_url);
          await Persistence.setBackgroundName(background.name || '');
          console.log('✅ [UserCharacterPreferenceService] Applied background video:', background.name);
        } else if (background.image) {
          const escaped = background.image.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          const js = `window.setBackgroundImage&&window.setBackgroundImage("${escaped}");`;
          webViewRef.current.injectJavaScript(js);
          await Persistence.setBackgroundURL(background.image);
          await Persistence.setBackgroundName(background.name || '');
          console.log('✅ [UserCharacterPreferenceService] Applied background image:', background.name);
        } else {
          console.warn('⚠️ [UserCharacterPreferenceService] Background missing image/video:', backgroundId);
        }
      }
    } catch (error) {
      console.error('❌ [UserCharacterPreferenceService] Error applying background:', error);
    }
  }

  /**
   * Load fallback model (character's base model)
   * Matching Swift version's loadFallbackModel
   */
  static async loadFallbackModel(
    modelName: string | null,
    modelURL: string | null,
    webViewRef: any,
    characterId?: string
  ): Promise<void> {
    if (!modelURL || !modelName || !webViewRef?.current) {
      return;
    }

    try {
      const escapedURL = modelURL.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const escapedName = modelName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const js = `window.loadModelByURL("${escapedURL}", "${escapedName}");`;
      webViewRef.current.injectJavaScript(`(async()=>{try{const r=(function(){${js}})(); if(r&&typeof r.then==='function'){await r;} return 'READY';}catch(e){return 'READY';}})();`);
      await Persistence.setModelName(modelName);
      await Persistence.setModelURL(modelURL);
      if (characterId) {
        await Persistence.setCharacterCostumeSelection(characterId, {
          costumeId: null,
          modelName,
          modelURL,
        });
      }
      console.log('✅ [UserCharacterPreferenceService] Loaded fallback model:', modelName);
    } catch (error) {
      console.error('❌ [UserCharacterPreferenceService] Error loading fallback model:', error);
    }
  }

  /**
   * Save user character preference (costume or background)
   */
  static async saveUserCharacterPreference(
    characterId: string,
    updates: { current_costume_id?: string; current_background_id?: string }
  ): Promise<void> {
    try {
      const userId = authManager.user?.id;
      if (!userId) {
        console.warn('⚠️ [UserCharacterPreferenceService] Cannot save preference: User not authenticated');
        return;
      }

      // First try to update existing row
      const queryItems: Record<string, string> = {
        character_id: `eq.${characterId}`,
        user_id: `eq.${userId}`,
      };

      const { error } = await getSupabaseClient()
        .from('user_character')
        .update(updates)
        .match({ character_id: characterId, user_id: userId });

      if (error) {
        // If update failed, it might be because the row doesn't exist. Try insert.
        // Note: Supabase .update() doesn't return error if no rows match, so we might need to check count or just try upsert.
        // Using upsert is safer.
        const { error: upsertError } = await getSupabaseClient()
          .from('user_character')
          .upsert(
            {
              user_id: userId,
              character_id: characterId,
              ...updates,
            },
            { onConflict: 'user_id,character_id' }
          );

        if (upsertError) {
          console.error('❌ [UserCharacterPreferenceService] Error saving preference:', upsertError);
        } else {
          console.log('✅ [UserCharacterPreferenceService] Saved preference:', updates);
        }
      } else {
        console.log('✅ [UserCharacterPreferenceService] Updated preference:', updates);
      }
    } catch (error) {
      console.error('❌ [UserCharacterPreferenceService] Error in saveUserCharacterPreference:', error);
    }
  }
}

