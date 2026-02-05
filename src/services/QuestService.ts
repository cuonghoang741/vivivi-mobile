import { QuestRepository, type DailyQuest, type UserDailyQuest, type UserLevelQuest, type LevelQuest } from '../repositories/QuestRepository';
import { CurrencyRepository } from '../repositories/CurrencyRepository';
import { userStatsRepository } from '../repositories/UserStatsRepository';
import { toastManager, CurrencyKind } from './ToastManager';

export type QuestReward = {
  vcoin: number;
  ruby: number;
  xp: number;
};

export type QuestProgressUpdate = {
  id: string;
  scope: 'daily' | 'level';
  progress: number;
  completed: boolean;
};

const shuffle = <T,>(input: T[]): T[] => {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export class QuestService {
  private repository = new QuestRepository();
  private currencyRepository = new CurrencyRepository();

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async loadTodayQuests(): Promise<UserDailyQuest[]> {
    const today = this.formatDate(new Date());
    const quests = await this.repository.fetchTodayQuests(today);
    if (quests.length === 0) {
      return this.generateDailyQuests();
    }
    return this.sortDailyQuests(quests);
  }

  async refreshDailyQuests(): Promise<UserDailyQuest[]> {
    const today = this.formatDate(new Date());
    await this.repository.markAllQuestsAsArchived(today);
    return this.generateDailyQuests();
  }

  private async generateDailyQuests(): Promise<UserDailyQuest[]> {
    const today = this.formatDate(new Date());
    const allQuests = await this.repository.fetchAllActiveQuests();

    if (!allQuests.length) {
      throw new Error('Không tìm thấy daily quest khả dụng');
    }

    const easy = shuffle(allQuests.filter((q) => q.difficulty === 'easy'));
    const medium = shuffle(allQuests.filter((q) => q.difficulty === 'medium'));
    const hard = shuffle(allQuests.filter((q) => q.difficulty === 'hard'));

    const selected: DailyQuest[] = [];
    selected.push(...easy.slice(0, 3));
    selected.push(...medium.slice(0, 2));
    selected.push(...hard.slice(0, 1));

    const picks = selected.length > 0 ? selected : shuffle(allQuests).slice(0, 6);

    await Promise.all(
      picks.map(async (quest) => {
        try {
          await this.repository.createUserDailyQuest(quest.id, today);
        } catch (error) {
          console.warn('[QuestService] Failed to create user quest', quest.id, error);
        }
      })
    );

    const created = await this.repository.fetchTodayQuests(today);
    return this.sortDailyQuests(created);
  }

  private sortDailyQuests(quests: UserDailyQuest[]): UserDailyQuest[] {
    const order: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
    return [...quests].sort((a, b) => {
      const difficultyA = a.quest?.difficulty?.toLowerCase?.() ?? '';
      const difficultyB = b.quest?.difficulty?.toLowerCase?.() ?? '';
      const weightA = order[difficultyA] ?? Number.MAX_SAFE_INTEGER;
      const weightB = order[difficultyB] ?? Number.MAX_SAFE_INTEGER;
      if (weightA === weightB) {
        return (a.quest?.reward_xp ?? 0) - (b.quest?.reward_xp ?? 0);
      }
      return weightA - weightB;
    });
  }

  async claimDailyQuestReward(userQuest: UserDailyQuest): Promise<{
    quest: UserDailyQuest;
    reward: QuestReward;
  }> {
    if (!userQuest.quest) {
      throw new Error('Quest data missing');
    }
    if (!userQuest.completed) {
      throw new Error('Quest chưa hoàn thành');
    }
    if (userQuest.claimed) {
      throw new Error('Quest đã được nhận thưởng');
    }

    const reward: QuestReward = {
      vcoin: userQuest.quest.reward_vcoin ?? 0,
      ruby: userQuest.quest.reward_ruby ?? 0,
      xp: userQuest.quest.reward_xp ?? 0,
    };

    await Promise.all([
      this.awardCurrency(reward.vcoin, reward.ruby),
      this.awardXp(reward.xp),
      this.repository.markQuestClaimed(userQuest.id),
    ]);

    // Show toast notifications for rewards (like swift-version)
    if (reward.vcoin > 0) {
      toastManager.showCurrencyToast(CurrencyKind.VCOIN, reward.vcoin);
    }
    if (reward.ruby > 0) {
      toastManager.showCurrencyToast(CurrencyKind.RUBY, reward.ruby);
    }
    if (reward.xp > 0) {
      toastManager.showXPToast(reward.xp);
    }

    return {
      quest: { ...userQuest, claimed: true },
      reward,
    };
  }

  async loadLevelQuests(): Promise<UserLevelQuest[]> {
    return this.repository.fetchUserLevelQuests();
  }

  async loadAvailableLevelQuests(userLevel: number): Promise<LevelQuest[]> {
    return this.repository.fetchAvailableLevelQuests(userLevel);
  }

  async loadUserLevelQuests(userLevel: number): Promise<UserLevelQuest[]> {
    return this.repository.fetchUserLevelQuests(userLevel);
  }

  async unlockLevelQuests(level: number): Promise<UserLevelQuest[]> {
    // Fetch all quests for this level
    const levelQuests = await this.repository.fetchLevelQuests(level);

    // Fetch existing user quests to avoid duplicates
    const existingQuests = await this.loadUserLevelQuests(level);
    const existingQuestIds = new Set(existingQuests.map((q) => q.quest_id));

    // Create user quest records for new quests
    const unlockedQuests: UserLevelQuest[] = [];
    for (const quest of levelQuests) {
      // Skip if already unlocked
      if (existingQuestIds.has(quest.id)) {
        continue;
      }

      try {
        const userQuest = await this.repository.createUserLevelQuest(quest.id);
        unlockedQuests.push(userQuest);
      } catch (error) {
        console.warn(`⚠️ Failed to unlock quest ${quest.id}:`, error);
      }
    }

    return unlockedQuests;
  }

  async updateLevelQuestProgress(
    questId: string,
    newProgress: number,
    completed: boolean
  ): Promise<void> {
    await this.repository.updateLevelQuestProgress(
      questId,
      newProgress,
      completed,
      completed ? new Date().toISOString() : undefined
    );
  }

  async markLevelQuestClaimed(questId: string): Promise<void> {
    await this.repository.markLevelQuestClaimed(questId);
  }

  async claimLevelQuestReward(userQuest: UserLevelQuest): Promise<{
    quest: UserLevelQuest;
    reward: QuestReward;
  }> {
    if (!userQuest.quest) {
      throw new Error('Quest data missing');
    }
    if (!userQuest.completed) {
      throw new Error('Quest chưa hoàn thành');
    }
    if (userQuest.claimed) {
      throw new Error('Quest đã được nhận thưởng');
    }

    const reward: QuestReward = {
      vcoin: userQuest.quest.reward_vcoin ?? 0,
      ruby: userQuest.quest.reward_ruby ?? 0,
      xp: userQuest.quest.reward_xp ?? 0,
    };

    await Promise.all([
      this.awardCurrency(reward.vcoin, reward.ruby),
      this.awardXp(reward.xp),
      this.repository.markLevelQuestClaimed(userQuest.id),
    ]);

    // Show toast notifications for rewards (like swift-version)
    if (reward.vcoin > 0) {
      toastManager.showCurrencyToast(CurrencyKind.VCOIN, reward.vcoin);
    }
    if (reward.ruby > 0) {
      toastManager.showCurrencyToast(CurrencyKind.RUBY, reward.ruby);
    }
    if (reward.xp > 0) {
      toastManager.showXPToast(reward.xp);
    }

    return {
      quest: { ...userQuest, claimed: true },
      reward,
    };
  }

  private async awardCurrency(vcoin: number, ruby: number) {
    if (!vcoin && !ruby) {
      return;
    }
    const balance = await this.currencyRepository.fetchCurrency();
    const nextVcoin = vcoin > 0 ? (balance.vcoin ?? 0) + vcoin : undefined;
    const nextRuby = ruby > 0 ? (balance.ruby ?? 0) + ruby : undefined;
    await this.currencyRepository.updateCurrency(nextVcoin, nextRuby);
  }

  private async awardXp(amount: number) {
    if (!amount || amount <= 0) {
      return;
    }

    let stats = await userStatsRepository.fetchStats();
    if (!stats) {
      stats = await userStatsRepository.createDefaultStats();
    }

    const currentXp = stats.xp ?? 0;
    const nextXp = currentXp + amount;
    const level = this.calculateLevelFromXp(nextXp);

    await userStatsRepository.updateStats({
      xp: nextXp,
      level,
    });
  }

  private calculateLevelFromXp(xp: number): number {
    const safeXp = Math.max(0, xp);
    return Math.floor(Math.sqrt(safeXp / 100)) + 1;
  }

  async trackQuestProgress(
    questType: string,
    increment = 1
  ): Promise<QuestProgressUpdate[]> {
    if (!questType || increment <= 0) {
      return [];
    }

    try {
      const [dailyUpdates, levelUpdates] = await Promise.all([
        this.incrementDailyQuestProgress(questType, increment),
        this.incrementLevelQuestProgress(questType, increment),
      ]);
      return [...dailyUpdates, ...levelUpdates];
    } catch (error) {
      console.warn('[QuestService] trackQuestProgress failed:', error);
      return [];
    }
  }

  private async incrementDailyQuestProgress(
    questType: string,
    increment: number
  ): Promise<QuestProgressUpdate[]> {
    const today = this.formatDate(new Date());
    const quests = await this.repository.fetchTodayQuests(today);
    const targets = quests.filter(
      quest => quest.quest?.quest_type === questType
    );

    if (!targets.length) {
      return [];
    }

    const updates: QuestProgressUpdate[] = [];
    await Promise.all(
      targets.map(async quest => {
        const targetValue = quest.quest?.target_value ?? 1;
        const currentProgress = quest.progress ?? 0;
        const nextProgress = Math.min(targetValue, currentProgress + increment);
        const completed = nextProgress >= targetValue;

        await this.repository.updateDailyQuestProgress(
          quest.id,
          nextProgress,
          completed,
          quest.completed_at ?? undefined
        );

        updates.push({
          id: quest.id,
          scope: 'daily',
          progress: nextProgress,
          completed,
        });
      })
    );

    return updates;
  }

  private async incrementLevelQuestProgress(
    questType: string,
    increment: number
  ): Promise<QuestProgressUpdate[]> {
    const quests = await this.repository.fetchUserLevelQuests();
    const targets = quests.filter(
      quest => quest.quest?.quest_type === questType
    );

    if (!targets.length) {
      return [];
    }

    const updates: QuestProgressUpdate[] = [];
    await Promise.all(
      targets.map(async quest => {
        const targetValue = quest.quest?.target_value ?? 1;
        const currentProgress = quest.progress ?? 0;
        const nextProgress = Math.min(targetValue, currentProgress + increment);
        const completed = nextProgress >= targetValue;

        await this.repository.updateLevelQuestProgress(
          quest.id,
          nextProgress,
          completed,
          quest.completed_at ?? undefined
        );

        updates.push({
          id: quest.id,
          scope: 'level',
          progress: nextProgress,
          completed,
        });
      })
    );

    return updates;
  }
}


