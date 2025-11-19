import { useCallback, useEffect, useState } from 'react';
import { userStatsService, type UserStats } from '../services/UserStatsService';

type UseUserStatsResult = {
  stats: UserStats;
  loading: boolean;
  refresh: () => Promise<void>;
};

const DEFAULT_STATE: UserStats = {
  level: 3,
  xp: 420,
  nextLevelXp: 900,
  energy: 72,
  energyMax: 100,
};

export const useUserStats = (): UseUserStatsResult => {
  const [stats, setStats] = useState<UserStats>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await userStatsService.fetchStats();
      setStats(fresh);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    refresh: fetchStats,
  };
};

