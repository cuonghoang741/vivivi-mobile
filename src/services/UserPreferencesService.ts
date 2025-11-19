import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersistKeys } from '../config/supabase';
import { getSupabaseClient } from './supabase';
import { authManager } from './AuthManager';
import { executeSupabaseRequest } from '../utils/supabaseHelpers';

/**
 * User Preferences Service
 * Matching Swift version's UserPreferencesService
 */
export class UserPreferencesService {
  /**
   * Load current character ID from preferences
   * Matching Swift version's loadCurrentCharacterId
   */
  async loadCurrentCharacterId(): Promise<string | null> {
    try {
      // First try to load from AsyncStorage (local cache)
      const cached = await AsyncStorage.getItem(PersistKeys.characterId);
      if (cached) {
        return cached;
      }

      // Then try to load from Supabase user_preferences table
      const userId = authManager.user?.id;
      if (!userId) {
        return null; // Guest users don't have preferences in DB
      }

      const queryItems: Record<string, string> = {
        select: 'current_character_id',
        user_id: `eq.${userId.toLowerCase()}`,
        limit: '1',
      };

      const data = await executeSupabaseRequest<any[]>(
        '/rest/v1/user_preferences',
        queryItems,
        'GET'
      );

      if (data && data.length > 0 && data[0].current_character_id) {
        const characterId = data[0].current_character_id;
        // Cache in AsyncStorage
        await AsyncStorage.setItem(PersistKeys.characterId, characterId);
        return characterId;
      }

      return null;
    } catch (error) {
      console.error('❌ [UserPreferencesService] Error loading character ID:', error);
      return null;
    }
  }

  /**
   * Save current character ID to preferences
   * Matching Swift version's updateCurrentCharacterId
   */
  async saveCurrentCharacterId(characterId: string): Promise<void> {
    try {
      // Cache in AsyncStorage
      await AsyncStorage.setItem(PersistKeys.characterId, characterId);

      // Save to Supabase if user is authenticated
      const userId = authManager.user?.id;
      if (!userId) {
        return; // Guest users don't save to DB
      }

      const { SUPABASE_URL } = await import('../config/supabase');
      const { getSupabaseAuthHeaders } = await import('../utils/supabaseHelpers');
      const headers = await getSupabaseAuthHeaders();

      const url = `${SUPABASE_URL}/rest/v1/user_preferences?on_conflict=user_id`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal, resolution=merge-duplicates',
        },
        body: JSON.stringify({
          user_id: userId.toLowerCase(),
          current_character_id: characterId,
        }),
      });

      if (!response.ok) {
        console.error('❌ [UserPreferencesService] Failed to save character ID:', response.status);
      }
    } catch (error) {
      console.error('❌ [UserPreferencesService] Error saving character ID:', error);
    }
  }
}

