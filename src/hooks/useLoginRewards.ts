import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LoginRewardService,
  type LoginReward,
  type LoginRewardStatus,
} from '../services/LoginRewardService';

type UseLoginRewardsOptions = {
  autoLoad?: boolean;
  onClaimSuccess?: () => Promise<void> | void;
};

type UseLoginRewardsResult = {
  rewards: LoginReward[];
  status: LoginRewardStatus;
  loading: boolean;
  claiming: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  claimToday: () => Promise<boolean>;
};

const DEFAULT_STATUS: LoginRewardStatus = {
  currentDay: 1,
  canClaimToday: false,
  hasClaimedToday: false,
  lastClaimDate: null,
  totalDaysClaimed: 0,
};

export const useLoginRewards = (
  options: UseLoginRewardsOptions = {}
): UseLoginRewardsResult => {
  const serviceRef = useRef<LoginRewardService | null>(null);
  if (!serviceRef.current) {
    serviceRef.current = new LoginRewardService();
  }

  const [rewards, setRewards] = useState<LoginReward[]>([]);
  const [status, setStatus] = useState<LoginRewardStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await serviceRef.current!.load();
      setRewards(result.rewards);
      setStatus(result.status);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load rewards';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (options.autoLoad === false) {
      return;
    }
    void refresh();
  }, [options.autoLoad, refresh]);

  const claimToday = useCallback(async () => {
    if (!status.canClaimToday || claiming) {
      return false;
    }
    setClaiming(true);
    try {
      const result = await serviceRef.current!.claimReward(status.currentDay);
      setStatus(result);
      await refresh();
      if (options.onClaimSuccess) {
        await Promise.resolve(options.onClaimSuccess());
      }
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to claim reward right now';
      setError(message);
      return false;
    } finally {
      setClaiming(false);
    }
  }, [claiming, options, refresh, status]);

  return {
    rewards,
    status,
    loading,
    claiming,
    error,
    refresh,
    claimToday,
  };
};


