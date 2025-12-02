import { useCallback, useEffect, useState } from 'react';
import { userStatsService, type UserStats } from '../services/UserStatsService';

type UseUserStatsResult = {
  stats: UserStats;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  consumeEnergy: (amount: number) => Promise<boolean>;
  refillEnergy: (amount: number) => Promise<void>;
};

const DEFAULT_STATE: UserStats = {
  level: 1,
  xp: 0,
  nextLevelXp: 100,
  energy: 100,
  energyMax: 100,
  loginStreak: 0,
};

export const useUserStats = (): UseUserStatsResult => {
  const [stats, setStats] = useState<UserStats>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await userStatsService.fetchStats();
      setStats(fresh);
      setError(null);
    } catch (err) {
      const normalizedError =
        err instanceof Error ? err : new Error('Failed to load user stats');
      setError(normalizedError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const consumeEnergy = useCallback(async (amount: number): Promise<boolean> => {
    const success = await userStatsService.consumeEnergy(amount);
    if (success) {
      await fetchStats();
    }
    return success;
  }, [fetchStats]);

  const refillEnergy = useCallback(async (amount: number): Promise<void> => {
    await userStatsService.refillEnergy(amount);
    await fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
    consumeEnergy,
    refillEnergy,
  };
};

