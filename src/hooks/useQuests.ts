import { useCallback, useEffect, useMemo, useState } from 'react';
import { QuestService, type QuestProgressUpdate, type QuestReward } from '../services/QuestService';
import type { UserDailyQuest, UserLevelQuest } from '../repositories/QuestRepository';
import { toastManager } from '../managers/ToastManager';

type DailyState = {
  quests: UserDailyQuest[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
};

type LevelState = {
  quests: UserLevelQuest[];
  loading: boolean;
  error: string | null;
};

const questService = new QuestService();

const INITIAL_DAILY_STATE: DailyState = {
  quests: [],
  loading: true,
  error: null,
  refreshing: false,
};

const RESET_DAILY_STATE: DailyState = {
  quests: [],
  loading: false,
  error: null,
  refreshing: false,
};

const INITIAL_LEVEL_STATE: LevelState = {
  quests: [],
  loading: true,
  error: null,
};

const RESET_LEVEL_STATE: LevelState = {
  quests: [],
  loading: false,
  error: null,
};

export const useQuests = (enabled = true) => {
  const [dailyState, setDailyState] = useState<DailyState>(INITIAL_DAILY_STATE);
  const [levelState, setLevelState] = useState<LevelState>(INITIAL_LEVEL_STATE);

  const loadDaily = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setDailyState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const quests = await questService.loadTodayQuests();
      setDailyState({
        quests,
        loading: false,
        refreshing: false,
        error: null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Không thể tải daily quests';
      setDailyState((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: message,
      }));
    }
  }, [enabled]);

  const refreshDaily = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setDailyState((prev) => ({ ...prev, refreshing: true, error: null }));
    try {
      const quests = await questService.refreshDailyQuests();
      setDailyState({
        quests,
        loading: false,
        refreshing: false,
        error: null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Không thể làm mới daily quests';
      setDailyState((prev) => ({
        ...prev,
        refreshing: false,
        error: message,
      }));
    }
  }, [enabled]);

  const claimDailyQuest = useCallback(
    async (questId: string): Promise<{ quest: UserDailyQuest; reward: QuestReward }> => {
      if (!enabled) {
        throw new Error('Quests chưa sẵn sàng');
      }
      const quest = dailyState.quests.find((item) => item.id === questId);
      if (!quest) {
        throw new Error('Quest không tồn tại');
      }
      const result = await questService.claimDailyQuestReward(quest);
      setDailyState((prev) => ({
        ...prev,
        quests: prev.quests.map((item) =>
          item.id === questId ? result.quest : item
        ),
      }));
      return result;
    },
    [dailyState.quests, enabled]
  );

  const loadLevel = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setLevelState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const quests = await questService.loadLevelQuests();
      setLevelState({ quests, loading: false, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Không thể tải level quests';
      setLevelState({
        quests: [],
        loading: false,
        error: message,
      });
    }
  }, [enabled]);

  const claimLevelQuest = useCallback(
    async (questId: string): Promise<{ quest: UserLevelQuest; reward: QuestReward }> => {
      if (!enabled) {
        throw new Error('Quests chưa sẵn sàng');
      }
      const quest = levelState.quests.find((item) => item.id === questId);
      if (!quest) {
        throw new Error('Quest không tồn tại');
      }
      const result = await questService.claimLevelQuestReward(quest);
      setLevelState((prev) => ({
        ...prev,
        quests: prev.quests.map((item) =>
          item.id === questId ? result.quest : item
        ),
      }));
      return result;
    },
    [enabled, levelState.quests]
  );

  const applyProgressUpdates = useCallback((updates: QuestProgressUpdate[]) => {
    if (!updates.length) {
      return;
    }
    setDailyState(prev => {
      const newQuests = prev.quests.map(quest => {
        const update = updates.find(
          item => item.scope === 'daily' && item.id === quest.id
        );
        if (!update) {
          return quest;
        }
        
        // Check if quest just completed (was not completed, now is completed)
        const wasCompleted = quest.completed;
        const isNowCompleted = update.completed;
        const justCompleted = !wasCompleted && isNowCompleted;
        
        if (justCompleted && quest.quest) {
          // Show toast for completed daily quest
          toastManager.showDailyQuestProgress(
            quest.quest.description || 'Daily Quest Completed!',
            update.progress,
            quest.quest.target_value,
            true
          );
        }
        
        return {
          ...quest,
          progress: update.progress,
          completed: update.completed,
        };
      });
      
      return {
        ...prev,
        quests: newQuests,
      };
    });

    setLevelState(prev => {
      const newQuests = prev.quests.map(quest => {
        const update = updates.find(
          item => item.scope === 'level' && item.id === quest.id
        );
        if (!update) {
          return quest;
        }
        
        // Check if quest just completed (was not completed, now is completed)
        const wasCompleted = quest.completed;
        const isNowCompleted = update.completed;
        const justCompleted = !wasCompleted && isNowCompleted;
        
        if (justCompleted && quest.quest) {
          // Show toast for completed level quest
          toastManager.showLevelQuestProgress(
            quest.quest.description || 'Level Quest Completed!',
            update.progress,
            quest.quest.target_value,
            true
          );
        }
        
        return {
          ...quest,
          progress: update.progress,
          completed: update.completed,
        };
      });
      
      return {
        ...prev,
        quests: newQuests,
      };
    });
  }, []);

  const trackProgress = useCallback(
    async (questType: string, increment = 1) => {
      if (!enabled) {
        return;
      }
      try {
        const updates = await questService.trackQuestProgress(
          questType,
          increment
        );
        applyProgressUpdates(updates);
      } catch (error) {
        console.warn('[useQuests] trackProgress failed:', error);
      }
    },
    [applyProgressUpdates, enabled]
  );

  useEffect(() => {
    if (!enabled) {
      setDailyState(RESET_DAILY_STATE);
      setLevelState(RESET_LEVEL_STATE);
      return;
    }
    loadDaily();
    loadLevel();
  }, [enabled, loadDaily, loadLevel]);

  const visibleDailyQuests = useMemo(
    () => dailyState.quests.filter((quest) => !(quest.completed && quest.claimed)),
    [dailyState.quests]
  );

  const hasIncompleteDaily = useMemo(
    () => visibleDailyQuests.some((quest) => !quest.completed),
    [visibleDailyQuests]
  );

  return {
    daily: {
      ...dailyState,
      visibleQuests: visibleDailyQuests,
      completedCount: visibleDailyQuests.filter((quest) => quest.completed).length,
      totalCount: visibleDailyQuests.length,
    },
    level: {
      ...levelState,
    },
    refreshDaily,
    claimDailyQuest,
    claimLevelQuest,
    hasIncompleteDaily,
    trackProgress,
  };
};

