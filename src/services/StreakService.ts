import { getSupabaseClient, getAuthenticatedUserId } from './supabase';
import { CostumeRepository, type CostumeItem } from '../repositories/CostumeRepository';
import AssetRepository from '../repositories/AssetRepository';

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
  /**
   * Performs a daily check-in for a specific character.
   * Updates the streak count and last check-in date.
   * Grants a random costume reward if a 7-day streak is achieved.
   * @param characterId The character ID
   * @returns An object containing the new streak days and any reward granted.
   */
  async checkIn(characterId: string): Promise<{ streakDays: number; reward: CostumeItem | null }> {
    if (!characterId) {
      throw new Error('Character ID is required');
    }

    const userId = await getAuthenticatedUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // 1. Fetch current streak info
    const { data: currentData, error: fetchError } = await this.client
      .from('user_character')
      .select('streak_days, last_checkin_date')
      .eq('character_id', characterId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      // If code is PGRST116, it means 0 rows => no previous checkin record
      if (fetchError.code !== 'PGRST116') {
         console.error('[StreakService] Failed to fetch current streak info:', fetchError);
         throw new Error('Failed to fetch character data');
      }
      // If PGRST116, we just proceed with defaults (currentStreak = 0, lastCheckinStr = null)
    }

    const today = new Date();
    const todayStr = this.formatDate(today);
    // If we had a fetch error (PGRST116), data is undefined, so use defaults
    const lastCheckinStr = currentData?.last_checkin_date;
    let currentStreak = currentData?.streak_days || 0;

    // 2. Calculate new streak
    if (lastCheckinStr === todayStr) {
      // Already checked in today, do nothing but return current state
      console.log('[StreakService] Already checked in today');
      return { streakDays: currentStreak, reward: null };
    }

    if (lastCheckinStr) {
      const lastCheckinDate = new Date(lastCheckinStr);
      const diffTime = Math.abs(today.getTime() - lastCheckinDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      // Note: This simple diff calculation might be off by one depending on time of day vs date string handling.
      // Better to compare date strings or normalized dates.
      // Let's use the helper method logic for strict day comparison.
      const daysApart = this.daysBetween(lastCheckinStr, todayStr);

      if (daysApart === 1) {
        // Consecutive day
        currentStreak += 1;
      } else if (daysApart > 1) {
        // Missed a day (or more), reset to 1
        currentStreak = 1;
      } else {
        // daysApart <= 0, should be covered by the initial check, but just in case
        currentStreak = currentStreak; // No change
      }
    } else {
      // First time checking in
      currentStreak = 1;
    }

    // 3. Check for 7-day milestone reward
    let reward: CostumeItem | null = null;
    if (currentStreak > 0 && currentStreak % 7 === 0) {
      reward = await this.grantRandomCostume(characterId);
    }

    // 4. Update database (Upsert to handle missing rows)
    const { error: updateError } = await this.client
      .from('user_character')
      .upsert({
        user_id: userId,
        character_id: characterId,
        streak_days: currentStreak,
        last_checkin_date: todayStr,
      }, { onConflict: 'user_id, character_id' });

    if (updateError) {
      console.error('[StreakService] Failed to update streak:', updateError);
      throw new Error('Failed to update streak');
    }

    return { streakDays: currentStreak, reward };
  }

  private async grantRandomCostume(characterId: string): Promise<CostumeItem | null> {
    try {
      const costumeRepo = new CostumeRepository();
      const assetRepo = new AssetRepository();

      // Fetch all costumes for the character
      const allCostumes = await costumeRepo.fetchCostumes(characterId);
      
      // Fetch owned costumes
      const ownedCostumeIds = await assetRepo.fetchOwnedAssets('costume');

      // Filter for unowned costumes
      const unownedCostumes = allCostumes.filter(c => !ownedCostumeIds.has(c.id));

      if (unownedCostumes.length === 0) {
        console.log('[StreakService] No unowned costumes available for reward.');
        return null;
      }

      // Pick a random costume
      const randomIndex = Math.floor(Math.random() * unownedCostumes.length);
      const selectedCostume = unownedCostumes[randomIndex];

      // Grant the costume
      const success = await assetRepo.createAsset(selectedCostume.id, 'costume');
      
      if (success) {
        console.log(`[StreakService] Granted costume reward: ${selectedCostume.costume_name}`);
        return selectedCostume;
      } else {
        console.error('[StreakService] Failed to create asset record for reward.');
        return null;
      }
    } catch (error) {
      console.error('[StreakService] Error granting random costume:', error);
      return null;
    }
  }


  /**
   * Checks the status of the streak for a character.
   */
  async getStreakStatus(characterId: string): Promise<{ streakDays: number; canCheckIn: boolean; lastCheckInDate: string | null }> {
    if (!characterId) return { streakDays: 0, canCheckIn: false, lastCheckInDate: null };

    const userId = await getAuthenticatedUserId();
    if (!userId) return { streakDays: 0, canCheckIn: false, lastCheckInDate: null };

    const { data, error } = await this.client
      .from('user_character')
      .select('streak_days, last_checkin_date')
      .eq('character_id', characterId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
        // If no record, we can check in (it will initialize the record)
        // Check if user_character record exists strictly? usually assumption is yes if in app.
        // If error is code PGRST116 (0 rows), it might mean no user_character row?
        // But assuming user owns character, row exists.
        return { streakDays: 0, canCheckIn: true, lastCheckInDate: null };
    }

    const today = this.formatDate(new Date());
    const lastCheckinStr = data.last_checkin_date;
    const canCheckIn = lastCheckinStr !== today;

    return { 
      streakDays: data.streak_days || 0,
      canCheckIn,
      lastCheckInDate: lastCheckinStr 
    };
  }

  private daysBetween(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    // Reset hours to avoid timezone issues affecting day difference
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    const diffTime = d2.getTime() - d1.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

export const streakService = new StreakService();

