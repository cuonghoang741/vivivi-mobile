import { getSupabaseClient, getAuthenticatedUserId } from './supabase';

class StreakService {
  private client = getSupabaseClient();

  /**
   * Fetches streak days for a specific character
   * @param characterId The character ID
   * @returns The number of streak days (0 if no streak found)
   */
  async fetchStreakDays(characterId: string): Promise<number> {
    if (!characterId) {
      return 0;
    }

    try {
      const userId = await getAuthenticatedUserId();
      if (!userId) {
        return 0;
      }

      const { data, error } = await this.client
        .from('user_character')
        .select('streak_days')
        .eq('character_id', characterId)
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (error || !data) {
        // No streak data found, return 0
        return 0;
      }

      return data.streak_days ?? 0;
    } catch (error) {
      console.warn('[StreakService] Failed to fetch streak days:', error);
      return 0;
    }
  }
}

export const streakService = new StreakService();

