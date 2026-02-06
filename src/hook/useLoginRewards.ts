import { useCallback, useState } from 'react';
import { LoginRewardService, type LoginRewardClaimResult } from '../services/LoginRewardService';
import type { LoginReward, UserLoginReward } from '../repositories/LoginRewardRepository';

type LoginRewardHookState = {
  rewards: LoginReward[];
  currentDay: number;
  canClaimToday: boolean;
  hasClaimedToday: boolean;
  isLoading: boolean;
  error: string | null;
  loaded: boolean;
};

const INITIAL_STATE: LoginRewardHookState = {
  rewards: [],
  currentDay: 0,
  canClaimToday: false,
  hasClaimedToday: false,
  isLoading: false,
  error: null,
  loaded: false,
};

const loginRewardService = new LoginRewardService();

export type ClaimResult =
  | (LoginRewardClaimResult & { success: true })
  | { success: false; error: string };

export const useLoginRewards = () => {
  const [state, setState] = useState<LoginRewardHookState>(INITIAL_STATE);
  const [record, setRecord] = useState<UserLoginReward | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  const load = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));
    try {
      const { rewards, state: computed } = await loginRewardService.hydrate();
      setRecord(computed.record);
      setState({
        rewards,
        currentDay: computed.currentDay,
        canClaimToday: computed.canClaimToday,
        hasClaimedToday: computed.hasClaimedToday,
        isLoading: false,
        error: null,
        loaded: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load login calendar';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, []);

  const claimToday = useCallback(async (): Promise<ClaimResult> => {
    if (!record) {
      return { success: false, error: 'Reward state is not ready yet' };
    }

    if (!state.canClaimToday) {
      return { success: false, error: 'Not eligible to claim today' };
    }

    setIsClaiming(true);
    try {
      const result = await loginRewardService.claimTodayReward({
        record,
        rewards: state.rewards,
      });
      setRecord(result.updatedRecord);
      setState((prev) => ({
        ...prev,
        canClaimToday: false,
        hasClaimedToday: true,
      }));
      return { ...result, success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to claim reward';
      setState((prev) => ({
        ...prev,
        error: message,
      }));
      return { success: false, error: message };
    } finally {
      setIsClaiming(false);
    }
  }, [record, state.canClaimToday, state.rewards]);

  return {
    state,
    load,
    claimToday,
    isClaiming,
  };
};


