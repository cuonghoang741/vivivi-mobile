import { getSupabaseClient } from './supabase';

export type UserStats = {
  level: number;
  xp: number;
  nextLevelXp: number;
  energy: number;
  energyMax: number;
};

const DEFAULT_STATS: UserStats = {
  level: 3,
  xp: 420,
  nextLevelXp: 900,
  energy: 72,
  energyMax: 100,
};

type RemoteStatsRow = {
  level?: number | null;
  xp?: number | null;
  next_level_xp?: number | null;
  energy?: number | null;
  energy_max?: number | null;
};

class UserStatsService {
  private client = getSupabaseClient();

  /**
   * Fetches stats from Supabase or falls back to defaults when table is missing.
   */
  async fetchStats(): Promise<UserStats> {
    try {
      const { data, error } = await this.client
        .from('user_stats')
        .select('level,xp,next_level_xp,energy,energy_max')
        .limit(1)
        .maybeSingle<RemoteStatsRow>();

      if (error) {
        // Table may not exist yet while we prototype in native version.
        console.warn('[UserStatsService] Falling back to defaults:', error.message);
        return DEFAULT_STATS;
      }

      if (!data) {
        return DEFAULT_STATS;
      }

      const level = data.level ?? DEFAULT_STATS.level;
      const xp = data.xp ?? DEFAULT_STATS.xp;
      const energy = data.energy ?? DEFAULT_STATS.energy;
      const energyMax = data.energy_max ?? DEFAULT_STATS.energyMax;
      const nextLevelXp =
        data.next_level_xp ??
        Math.max(level * level * 100, (level + 1) * (level + 1) * 100);

      return {
        level,
        xp,
        nextLevelXp,
        energy,
        energyMax,
      };
    } catch (error: any) {
      console.error('[UserStatsService] Unexpected error:', error);
      return DEFAULT_STATS;
    }
  }
}

export const userStatsService = new UserStatsService();

