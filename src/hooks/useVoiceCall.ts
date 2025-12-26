import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceCallService } from '../services/VoiceCallService';
import { QuestProgressTracker } from '../utils/QuestProgressTracker';
import { userStatsService } from '../services/UserStatsService';
import { relationshipLevelService } from '../services/RelationshipLevelService';

const COST_PER_SECOND = 50; // 50 vcoin per second
const CURRENCY_SYNC_INTERVAL = 5000; // 5 seconds

type UseVoiceCallOptions = {
  characterId: string | null;
  agentId: string | null;
  getVcoinBalance: () => number; // Use callback to get latest balance
  onVcoinChange: (newBalance: number) => void;
  onOutOfFunds: () => void;
  onQuestUpdate?: (questType: string, seconds: number, minutes: number) => Promise<void>;
  questTypeResolver?: () => 'voice_call' | 'video_call';
};

export const useVoiceCall = (options: UseVoiceCallOptions) => {
  const {
    characterId,
    agentId,
    getVcoinBalance,
    onVcoinChange,
    onOutOfFunds,
    onQuestUpdate,
    questTypeResolver,
  } = options;

  const [callElapsedSeconds, setCallElapsedSeconds] = useState(0);
  const [callVcoinSpent, setCallVcoinSpent] = useState(0);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);

  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callStartedAtRef = useRef<number | null>(null);
  const lastCurrencySyncDateRef = useRef<number | null>(null);
  const currencySyncTaskRef = useRef<Promise<void> | null>(null);
  const pendingCurrencyBalanceRef = useRef<number | null>(null);


  // MARK: - Call Metering

  const startCallMetering = useCallback(async () => {
    if (!characterId || !agentId) {
      return;
    }

    // Clear any existing timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }

    callStartedAtRef.current = Date.now();
    setCallElapsedSeconds(0);
    setCallVcoinSpent(0);
    setIsCallActive(true);

    // Create call row in database
    try {
      const callId = await voiceCallService.createCallRow(characterId, agentId);
      if (callId) {
        setCurrentCallId(callId);
      }
    } catch (error) {
      console.error('[useVoiceCall] Failed to create call row:', error);
    }

    // Start timer to deduct vcoin every second
    const timerId = setInterval(() => {
      const currentBalance = getVcoinBalance();
      
      if (currentBalance < COST_PER_SECOND) {
        // Out of funds: end call, show alert
        clearInterval(timerId);
        callTimerRef.current = null;
        setIsCallActive(false);
        onOutOfFunds();
        // Note: stopCallMetering will be called from App.tsx when call ends
        return;
      }

      const newBalance = Math.max(0, currentBalance - COST_PER_SECOND);
      onVcoinChange(newBalance);
      setCallVcoinSpent((prev) => prev + COST_PER_SECOND);
      setCallElapsedSeconds((prev) => prev + 1);
      
      // Queue currency sync
      queueCurrencySync(newBalance);
    }, 1000);
    
    callTimerRef.current = timerId;
  }, [characterId, agentId, getVcoinBalance, onVcoinChange, onOutOfFunds]);

  const stopCallMetering = useCallback(
    async (finalize: boolean) => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      setIsCallActive(false);
      finalizeCurrencySync();

      if (finalize && callVcoinSpent > 0 && characterId) {
        const callSeconds = callElapsedSeconds;
        const callMinutes = Math.floor(callSeconds / 60);

        if (callSeconds > 0) {
          // Track voice/video quest progress
          const questType = questTypeResolver ? questTypeResolver() : 'voice_call';
          if (onQuestUpdate) {
            await onQuestUpdate(questType, callSeconds, callMinutes);
          } else {
            await QuestProgressTracker.track(questType);
          }

          // Award relationship (update interaction timestamp)
          if (characterId) {
            try {
              await relationshipLevelService.updateRelationshipInteraction(characterId);
            } catch (error) {
              console.error('[useVoiceCall] Failed to update relationship:', error);
            }
          }

          // Award XP (5 per minute)
          const xpAmount = callMinutes * 5;
          if (xpAmount > 0) {
            await userStatsService.addXP(xpAmount, 'voice_call');
          }
        }

        // Create transaction
        try {
          await voiceCallService.createVoiceCallTransaction(callVcoinSpent, characterId);
        } catch (error) {
          console.error('[useVoiceCall] Failed to create transaction:', error);
        }

        // Finalize call row
        if (currentCallId) {
          try {
            await voiceCallService.finalizeCallRow(
              currentCallId,
              callElapsedSeconds,
              callVcoinSpent
            );
            setCurrentCallId(null);
          } catch (error) {
            console.error('[useVoiceCall] Failed to finalize call row:', error);
          }
        }
      }

      // Reset state
      setCallElapsedSeconds(0);
      setCallVcoinSpent(0);
      callStartedAtRef.current = null;
    },
    [
      callElapsedSeconds,
      callVcoinSpent,
      characterId,
      currentCallId,
      onQuestUpdate,
    ]
  );

  const reset = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallElapsedSeconds(0);
    setCallVcoinSpent(0);
    callStartedAtRef.current = null;
    setCurrentCallId(null);
    setIsCallActive(false);
    currencySyncTaskRef.current = null;
    pendingCurrencyBalanceRef.current = null;
    lastCurrencySyncDateRef.current = null;
  }, []);

  // MARK: - Currency Sync

  const queueCurrencySync = useCallback((balance: number) => {
    pendingCurrencyBalanceRef.current = balance;

    if (currencySyncTaskRef.current) {
      return;
    }

    const now = Date.now();
    const lastSync = lastCurrencySyncDateRef.current ?? 0;
    const elapsed = now - lastSync;

    if (elapsed >= CURRENCY_SYNC_INTERVAL) {
      startCurrencySyncTask();
    } else {
      const delay = Math.max(0, CURRENCY_SYNC_INTERVAL - elapsed);
      currencySyncTaskRef.current = (async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        await startCurrencySyncTask();
      })();
    }
  }, []);

  const startCurrencySyncTask = useCallback(async () => {
    currencySyncTaskRef.current = null;
    const balance = pendingCurrencyBalanceRef.current;
    if (balance === null) {
      return;
    }

    pendingCurrencyBalanceRef.current = null;
    lastCurrencySyncDateRef.current = Date.now();

    try {
      await voiceCallService.updateCurrencyBalance(balance);
    } catch (error) {
      console.error('[useVoiceCall] Failed to sync currency:', error);
    }
  }, []);

  const finalizeCurrencySync = useCallback(async () => {
    currencySyncTaskRef.current = null;
    const pending = pendingCurrencyBalanceRef.current;
    if (pending !== null) {
      pendingCurrencyBalanceRef.current = null;
      try {
        await voiceCallService.updateCurrencyBalance(pending);
      } catch (error) {
        console.error('[useVoiceCall] Failed to finalize currency sync:', error);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);

  return {
    callElapsedSeconds,
    callVcoinSpent,
    currentCallId,
    isCallActive,
    startCallMetering,
    stopCallMetering,
    reset,
  };
};

