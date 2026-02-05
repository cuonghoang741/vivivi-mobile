import { type UserLevelQuest, type LevelQuest } from '../repositories/QuestRepository';
import { QuestService } from './QuestService';
import { CurrencyRepository } from '../repositories/CurrencyRepository';
import { userStatsRepository } from '../repositories/UserStatsRepository';
import { toastManager, ToastType } from './ToastManager';

function sortLevelQuestsByLevel(quests: UserLevelQuest[]): UserLevelQuest[] {
  return [...quests].sort((a, b) => {
    const leftLevel = a.quest?.level_required ?? 0;
    const rightLevel = b.quest?.level_required ?? 0;
    if (leftLevel === rightLevel) {
      // Same level, sort by completed status
      if (a.completed !== b.completed) {
        return !a.completed && b.completed ? -1 : 1;
      }
      // Both same completion status, sort by progress
      return b.progress - a.progress;
    }
    return rightLevel - leftLevel;
  });
}

class LevelQuestManagerImpl {
  private availableQuests: LevelQuest[] = [];
  private userQuests: UserLevelQuest[] = [];
  private isLoading: boolean = false;
  private errorMessage: string | null = null;
  private currentUserLevel: number = 1;
  private questService = new QuestService();
  private currencyRepository = new CurrencyRepository();

  get quests(): UserLevelQuest[] {
    return this.userQuests;
  }

  get available(): LevelQuest[] {
    return this.availableQuests;
  }

  get loading(): boolean {
    return this.isLoading;
  }

  get error(): string | null {
    return this.errorMessage;
  }

  async loadQuestsForLevel(level: number): Promise<void> {
    console.log(`📋 Loading level quests for level ${level}...`);
    this.isLoading = true;
    this.errorMessage = null;

    try {
      this.currentUserLevel = level;

      // Load available quests
      const available = await this.questService.loadAvailableLevelQuests(level);
      this.availableQuests = available;

      // Load user's quest progress
      const userQuests = await this.questService.loadUserLevelQuests(level);
      this.userQuests = sortLevelQuestsByLevel(userQuests);

      console.log(`✅ Loaded ${available.length} available quests, ${userQuests.length} user quests`);
    } catch (error) {
      console.error('❌ Error loading level quests:', error);
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load level quests';
    } finally {
      this.isLoading = false;
    }
  }

  async unlockQuestsForLevel(level: number): Promise<UserLevelQuest[]> {
    console.log(`🔓 Unlocking quests for level ${level}...`);

    try {
      const unlocked = await this.questService.unlockLevelQuests(level);

      // Reload user quests to include newly unlocked ones
      const userQuests = await this.questService.loadUserLevelQuests(level);
      this.userQuests = sortLevelQuestsByLevel(userQuests);

      console.log(`✅ Unlocked ${unlocked.length} new quests for level ${level}`);
      return unlocked;
    } catch (error) {
      console.error('❌ Error unlocking quests:', error);
      this.errorMessage = error instanceof Error ? error.message : 'Failed to unlock quests';
      return [];
    }
  }

  async updateProgress(type: string, increment: number = 1): Promise<void> {
    if (this.userQuests.length === 0) {
      // Load quests first if not loaded
      await this.loadQuestsForLevel(this.currentUserLevel);
      if (this.userQuests.length > 0) {
        await this.updateProgress(type, increment);
      }
      return;
    }

    console.log(`📋 Updating progress for type: ${type}, increment: ${increment}`);

    // Filter incomplete quests matching the type
    const matchingQuests = this.userQuests.filter((quest) => {
      if (!quest.quest) return false;
      return !quest.completed && quest.quest.quest_type === type;
    });

    if (matchingQuests.length === 0) {
      console.log(`📋 No matching incomplete level quests for type: ${type}`);
      return;
    }

    const updatedQuests: Array<{ quest: UserLevelQuest; isCompleted: boolean }> = [];

    for (const userQuest of matchingQuests) {
      if (!userQuest.quest) continue;

      const oldProgress = userQuest.progress;
      const newProgress = Math.min(userQuest.progress + increment, userQuest.quest.target_value);
      const isCompleted = newProgress >= userQuest.quest.target_value && !userQuest.completed;

      // Update in database
      try {
        await this.questService.updateLevelQuestProgress(
          userQuest.id,
          newProgress,
          isCompleted
        );
      } catch (error) {
        console.error('❌ Failed to update level quest progress:', error);
        continue;
      }

      // Update local state
      const index = this.userQuests.findIndex((q) => q.id === userQuest.id);
      if (index >= 0) {
        this.userQuests[index].progress = newProgress;
        if (isCompleted) {
          this.userQuests[index].completed = true;
          this.userQuests[index].completed_at = new Date().toISOString();
          console.log(`✅ Level quest completed: ${userQuest.quest.description}`);
        }
        updatedQuests.push({ quest: this.userQuests[index], isCompleted });
      }
    }

    // Show toast notifications for updated quests (like swift-version)
    // for (const { quest, isCompleted } of updatedQuests) {
    //   if (!quest.quest) continue;

    //   const progress = quest.progress;
    //   const target = quest.quest.target_value;

    //   // Show toast with progress bar
    //   toastManager.showLevelQuestProgress(
    //     quest.quest.description,
    //     progress,
    //     target,
    //     isCompleted
    //   );

    //   // If completed, show completion toast
    //   if (isCompleted) {
    //     toastManager.showToast(
    //       ToastType.QUEST,
    //       'Quest Completed!',
    //       quest.quest.description,
    //       undefined,
    //       'checkmark-circle',
    //       undefined,
    //       3000
    //     );
    //   }
    // }

    console.log(`📋 Updated ${updatedQuests.length} level quest(s) for type: ${type}`);
  }

  async claimReward(questId: string): Promise<void> {
    const userQuest = this.userQuests.find((q) => q.id === questId);
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

    console.log(`🎁 Claiming level quest reward: ${userQuest.quest.description}`);

    const questData = userQuest.quest;

    // Award currency
    if (questData.reward_vcoin > 0 || questData.reward_ruby > 0) {
      try {
        const balance = await this.currencyRepository.fetchCurrency();
        const nextVcoin = questData.reward_vcoin > 0 ? (balance.vcoin ?? 0) + questData.reward_vcoin : balance.vcoin;
        const nextRuby = questData.reward_ruby > 0 ? (balance.ruby ?? 0) + questData.reward_ruby : balance.ruby;
        await this.currencyRepository.updateCurrency(nextVcoin, nextRuby);
        console.log(`💰 Level quest rewards: ${questData.reward_vcoin} VCoin, ${questData.reward_ruby} Ruby`);
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
      await this.questService.markLevelQuestClaimed(questId);
    } catch (error) {
      console.error('❌ Failed to mark quest as claimed:', error);
      return;
    }

    // Update local state
    const index = this.userQuests.findIndex((q) => q.id === questId);
    if (index >= 0) {
      this.userQuests[index].claimed = true;
      this.userQuests[index].claimed_at = new Date().toISOString();
    }

    console.log(`✅ Level quest reward claimed: ${questData.reward_vcoin} VCoin, ${questData.reward_ruby} Ruby, ${questData.reward_xp} XP`);

    // Show reward overlay (like swift-version)
    // Note: This will be handled by App.tsx via notification/event system
  }

  // Helper to get reward items for overlay
  getRewardItems(questId: string): Array<{ type: 'vcoin' | 'ruby' | 'xp'; amount: number }> {
    const userQuest = this.userQuests.find((q) => q.id === questId);
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

  async checkAndUnlockNewQuests(userLevel: number): Promise<void> {
    if (userLevel <= this.currentUserLevel) {
      return;
    }

    this.currentUserLevel = userLevel;

    // Unlock quests for all levels up to current level
    for (let level = 1; level <= userLevel; level++) {
      const unlocked = await this.unlockQuestsForLevel(level);
      if (unlocked.length > 0) {
        console.log(`🔓 Unlocked ${unlocked.length} quests for level ${level}`);
      }
    }
  }
}

export const LevelQuestManager = new LevelQuestManagerImpl();

