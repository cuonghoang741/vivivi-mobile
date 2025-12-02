import { QuestRepository, type UserDailyQuest, type DailyQuest } from '../repositories/QuestRepository';
import { getSupabaseClient, getAuthenticatedUserId } from '../services/supabase';
import { CurrencyRepository } from '../repositories/CurrencyRepository';
import { userStatsRepository } from '../repositories/UserStatsRepository';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toastManager, ToastType } from './ToastManager';

const CLIENT_ID_KEY = 'client_id';

function ensureClientId(): string {
  const id = `client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  AsyncStorage.setItem(CLIENT_ID_KEY, id).catch(() => {});
  return id;
}

function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sortQuestsByDifficulty(quests: UserDailyQuest[]): UserDailyQuest[] {
  const order: Record<string, number> = {
    easy: 0,
    medium: 1,
    hard: 2,
  };

  return [...quests].sort((a, b) => {
    const difficultyA = a.quest?.difficulty?.toLowerCase() ?? '';
    const difficultyB = b.quest?.difficulty?.toLowerCase() ?? '';
    const weightA = order[difficultyA] ?? Number.MAX_SAFE_INTEGER;
    const weightB = order[difficultyB] ?? Number.MAX_SAFE_INTEGER;
    if (weightA === weightB) {
      return (a.quest?.reward_xp ?? 0) - (b.quest?.reward_xp ?? 0);
    }
    return weightA - weightB;
  });
}

class DailyQuestManagerImpl {
  private todayQuests: UserDailyQuest[] = [];
  private completedCount: number = 0;
  private isLoading: boolean = false;
  private errorMessage: string | null = null;
  private todayDate: string = getTodayDate();
  private repository = new QuestRepository();
  private currencyRepository = new CurrencyRepository();

  get quests(): UserDailyQuest[] {
    return this.todayQuests;
  }

  get completed(): number {
    return this.completedCount;
  }

  get loading(): boolean {
    return this.isLoading;
  }

  get error(): string | null {
    return this.errorMessage;
  }

  get hasIncompleteQuests(): boolean {
    return this.todayQuests.some((q) => !q.completed);
  }

  async loadTodayQuests(): Promise<void> {
    console.log('📋 Loading today\'s quests...');
    this.isLoading = true;
    this.errorMessage = null;

    try {
      // Update today's date in case day changed
      this.todayDate = getTodayDate();

      const userId = await getAuthenticatedUserId();
      let clientId: string | null = null;

      if (!userId) {
        const stored = await AsyncStorage.getItem(CLIENT_ID_KEY);
        clientId = stored ?? ensureClientId();
      }

      const quests = await this.repository.fetchTodayQuests(this.todayDate);

      if (quests.length === 0) {
        console.log('📋 No quests found for today, generating new quests...');
        await this.generateDailyQuests();
        return;
      }

      this.todayQuests = sortQuestsByDifficulty(quests);
      this.completedCount = this.todayQuests.filter((q) => q.completed).length;
      console.log(`✅ Loaded ${quests.length} quests for today (${this.completedCount} completed)`);
    } catch (error) {
      console.error('❌ Error loading quests:', error);
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load quests';
      await this.generateDailyQuests();
    } finally {
      this.isLoading = false;
    }
  }

  async generateDailyQuests(): Promise<UserDailyQuest[]> {
    console.log(`📋 Generating daily quests for ${this.todayDate}...`);

    try {
      // Step 1: Mark all current quests as archived
      await this.repository.markAllQuestsAsArchived(this.todayDate);
      console.log(`✅ Marked all quests for ${this.todayDate} as archived`);

      // Step 2: Fetch all active quests
      const allQuests = await this.repository.fetchAllActiveQuests();

      if (allQuests.length === 0) {
        console.error('❌ No active quests available');
        return [];
      }

      // Step 3: Filter and randomly select
      const easy = shuffle(allQuests.filter((q) => q.difficulty === 'easy'));
      const medium = shuffle(allQuests.filter((q) => q.difficulty === 'medium'));
      const hard = shuffle(allQuests.filter((q) => q.difficulty === 'hard'));

      const selected: DailyQuest[] = [];
      selected.push(...easy.slice(0, 3));
      selected.push(...medium.slice(0, 2));
      selected.push(...hard.slice(0, 1));

      if (selected.length !== 6) {
        console.warn(`⚠️ Not enough quests available: ${selected.length}/6 (need 3 easy, 2 medium, 1 hard)`);
        if (selected.length === 0) {
          return [];
        }
      }

      console.log(`📋 Selected ${selected.length} quests: ${easy.slice(0, 3).length} easy, ${medium.slice(0, 2).length} medium, ${hard.slice(0, 1).length} hard`);

      // Step 4: Create user_daily_quests records
      const createdQuests: UserDailyQuest[] = [];

      for (const quest of selected) {
        try {
          const userQuest = await this.repository.createUserDailyQuest(quest.id, this.todayDate);
          createdQuests.push(userQuest);
        } catch (error) {
          console.warn(`⚠️ Failed to create quest ${quest.id}:`, error);
        }
      }

      this.todayQuests = sortQuestsByDifficulty(createdQuests);
      this.completedCount = this.todayQuests.filter((q) => q.completed).length;
      console.log(`✅ Generated ${createdQuests.length} daily quests`);

      return createdQuests;
    } catch (error) {
      console.error('❌ Error generating quests:', error);
      this.errorMessage = error instanceof Error ? error.message : 'Failed to generate quests';
      return [];
    }
  }

  async updateProgress(type: string, increment: number = 1): Promise<void> {
    if (this.todayQuests.length === 0) {
      console.warn('⚠️ No quests loaded, loading first...');
      await this.loadTodayQuests();
      if (this.todayQuests.length > 0) {
        await this.updateProgress(type, increment);
      }
      return;
    }

    console.log(`📋 Updating progress for type: ${type}, increment: ${increment}`);

    // Filter quests matching the type that are not archived
    // Archived = completed AND claimed (should not be updated)
    // We update: progressing (not completed) quests only
    const matchingQuests = this.todayQuests.filter((quest) => {
      if (!quest.quest) return false;
      const isArchived = quest.completed && quest.claimed;
      return !isArchived && !quest.completed && quest.quest.quest_type === type;
    });

    if (matchingQuests.length === 0) {
      console.log(`📋 No matching incomplete quests for type: ${type}`);
      return;
    }

    const updatedQuests: Array<{ quest: UserDailyQuest; isCompleted: boolean }> = [];

    for (const userQuest of matchingQuests) {
      if (!userQuest.quest) continue;

      const oldProgress = userQuest.progress;
      const newProgress = Math.min(userQuest.progress + increment, userQuest.quest.target_value);
      const isCompleted = newProgress >= userQuest.quest.target_value && !userQuest.completed;

      // Update in database
      try {
        await this.repository.updateDailyQuestProgress(
          userQuest.id,
          newProgress,
          isCompleted,
          isCompleted ? new Date().toISOString() : userQuest.completed_at ?? undefined
        );
      } catch (error) {
        console.error('❌ Failed to update quest progress:', error);
        continue;
      }

      // Update local state
      const index = this.todayQuests.findIndex((q) => q.id === userQuest.id);
      if (index >= 0) {
        this.todayQuests[index].progress = newProgress;
        if (isCompleted) {
          this.todayQuests[index].completed = true;
          this.todayQuests[index].completed_at = new Date().toISOString();
          console.log(`✅ Quest completed: ${userQuest.quest.description}`);
        }
        updatedQuests.push({ quest: this.todayQuests[index], isCompleted });
      }
    }

    // Show toast notifications for updated quests (like swift-version)
    for (const { quest, isCompleted } of updatedQuests) {
      if (!quest.quest) continue;

      const progress = quest.progress;
      const target = quest.quest.target_value;

      // Show toast with progress bar
      toastManager.showDailyQuestProgress(
        quest.quest.description,
        progress,
        target,
        isCompleted
      );

      // If completed, show completion toast
      if (isCompleted) {
        toastManager.showToast(
          ToastType.QUEST,
          'Daily Quest Completed!',
          quest.quest.description,
          undefined,
          'checkmark-circle',
          undefined,
          3000
        );
      }
    }

    // Recalculate completed count
    this.completedCount = this.todayQuests.filter((q) => q.completed).length;

    console.log(`📋 Updated ${updatedQuests.length} quest(s) for type: ${type}`);
  }

  async claimReward(questId: string): Promise<void> {
    const userQuest = this.todayQuests.find((q) => q.id === questId);
    if (!userQuest) {
      console.error(`❌ Quest not found: ${questId}`);
      return;
    }

    if (!userQuest.quest) {
      console.error('❌ Quest data not available');
      return;
    }

    if (!userQuest.completed) {
      console.warn('⚠️ Quest not completed yet');
      return;
    }

    if (userQuest.claimed) {
      console.warn('⚠️ Quest reward already claimed');
      return;
    }

    console.log(`🎁 Claiming reward for quest: ${userQuest.quest.description}`);

    const questData = userQuest.quest;

    // Award currency
    if (questData.reward_vcoin > 0 || questData.reward_ruby > 0) {
      try {
        const balance = await this.currencyRepository.fetchCurrency();
        const nextVcoin = questData.reward_vcoin > 0 ? (balance.vcoin ?? 0) + questData.reward_vcoin : balance.vcoin;
        const nextRuby = questData.reward_ruby > 0 ? (balance.ruby ?? 0) + questData.reward_ruby : balance.ruby;
        await this.currencyRepository.updateCurrency(nextVcoin, nextRuby);
        console.log(`💰 Quest rewards: ${questData.reward_vcoin} VCoin, ${questData.reward_ruby} Ruby`);
      } catch (error) {
        console.error('❌ Failed to award currency:', error);
      }
    }

    // Award XP
    if (questData.reward_xp > 0) {
      try {
        let stats = await userStatsRepository.fetchStats();
        if (!stats) {
          stats = await userStatsRepository.createDefaultStats();
        }
        const currentXp = stats.xp ?? 0;
        const nextXp = currentXp + questData.reward_xp;
        const level = Math.floor(Math.sqrt(Math.max(0, nextXp) / 100)) + 1;
        await userStatsRepository.updateStats({ xp: nextXp, level });
      } catch (error) {
        console.error('❌ Failed to award XP:', error);
      }
    }

    // Mark as claimed in database
    try {
      await this.repository.markQuestClaimed(questId);
    } catch (error) {
      console.error('❌ Failed to mark quest as claimed:', error);
      return;
    }

    // Update local state
    const index = this.todayQuests.findIndex((q) => q.id === questId);
    if (index >= 0) {
      this.todayQuests[index].claimed = true;
    }

    console.log(`✅ Reward claimed: ${questData.reward_vcoin} VCoin, ${questData.reward_ruby} Ruby, ${questData.reward_xp} XP`);

    // Show reward overlay (like swift-version)
    // Note: This will be handled by App.tsx via notification/event system
    // For now, we'll return the reward info so App.tsx can show the overlay

    // Track meta quest for completing daily quests
    // Note: This would need to be handled by QuestProgressTracker
  }

  // Helper to get reward items for overlay
  getRewardItems(questId: string): Array<{ type: 'vcoin' | 'ruby' | 'xp'; amount: number }> {
    const userQuest = this.todayQuests.find((q) => q.id === questId);
    if (!userQuest?.quest) return [];

    const items: Array<{ type: 'vcoin' | 'ruby' | 'xp'; amount: number }> = [];
    if (userQuest.quest.reward_vcoin > 0) {
      items.push({ type: 'vcoin', amount: userQuest.quest.reward_vcoin });
    }
    if (userQuest.quest.reward_ruby > 0) {
      items.push({ type: 'ruby', amount: userQuest.quest.reward_ruby });
    }
    if (userQuest.quest.reward_xp > 0) {
      items.push({ type: 'xp', amount: userQuest.quest.reward_xp });
    }
    return items;
  }
}

export const DailyQuestManager = new DailyQuestManagerImpl();

