import { LoginRewardRepository, type LoginReward, type UserLoginReward } from '../repositories/LoginRewardRepository';
import { CurrencyRepository } from '../repositories/CurrencyRepository';
import { userStatsRepository } from '../repositories/UserStatsRepository';

export type LoginRewardComputedState = {
  record: UserLoginReward;
  currentDay: number;
  canClaimToday: boolean;
  hasClaimedToday: boolean;
};

export type LoginRewardClaimResult = {
  updatedRecord: UserLoginReward;
  reward: LoginReward;
};

export class LoginRewardService {
  private repository = new LoginRewardRepository();
  private currencyRepository = new CurrencyRepository();

  async hydrate(): Promise<{
    rewards: LoginReward[];
    state: LoginRewardComputedState;
  }> {
    const [rewards, record] = await Promise.all([
      this.repository.fetchRewards(),
      this.loadOrCreateUserRecord(),
    ]);

    const state = this.evaluateDailyState(record);

    return { rewards, state };
  }

  async loadOrCreateUserRecord(): Promise<UserLoginReward> {
    const existing = await this.repository.fetchUserRecord();
    if (existing) {
      return existing;
    }
    return this.repository.createDefaultUserRecord();
  }

  evaluateDailyState(record: UserLoginReward): LoginRewardComputedState {
    const today = this.formatDate(new Date());
    const lastClaimDate = record.last_claim_date ?? '';
    let currentDay = record.current_day ?? 0;
    let canClaimToday = false;
    let hasClaimedToday = false;

    if (!lastClaimDate) {
      currentDay = currentDay > 0 ? currentDay : 1;
      canClaimToday = true;
      hasClaimedToday = false;
    } else {
      const daysApart = this.daysBetween(lastClaimDate, today);
      if (daysApart === 0) {
        canClaimToday = false;
        hasClaimedToday = true;
      } else if (daysApart === 1) {
        currentDay = currentDay + 1;
        if (currentDay > 30) {
          currentDay = 1;
        }
        canClaimToday = true;
        hasClaimedToday = false;
      } else if (daysApart > 1) {
        currentDay = 1;
        canClaimToday = true;
        hasClaimedToday = false;
      } else {
        canClaimToday = false;
        hasClaimedToday = false;
      }
    }

    return {
      record: {
        ...record,
        current_day: currentDay,
      },
      currentDay,
      canClaimToday,
      hasClaimedToday,
    };
  }

  async claimTodayReward(args: {
    record: UserLoginReward;
    rewards: LoginReward[];
  }): Promise<LoginRewardClaimResult> {
    const { record, rewards } = args;

    const reward = rewards.find((r) => r.day_number === record.current_day);
    if (!reward) {
      throw new Error('Không tìm thấy phần thưởng cho ngày hiện tại');
    }

    await Promise.all([
      this.awardCurrency(reward.reward_vcoin, reward.reward_ruby),
      this.awardEnergy(reward.reward_energy),
    ]);

    const today = this.formatDate(new Date());
    const totalDaysClaimed = (record.total_days_claimed ?? 0) + 1;

    await this.repository.updateUserRecord({
      last_claim_date: today,
      total_days_claimed: totalDaysClaimed,
      current_day: record.current_day,
    });

    const updatedRecord: UserLoginReward = {
      ...record,
      last_claim_date: today,
      total_days_claimed: totalDaysClaimed,
    };

    return {
      updatedRecord,
      reward,
    };
  }

  private async awardCurrency(vcoin: number, ruby: number): Promise<void> {
    if ((vcoin ?? 0) <= 0 && (ruby ?? 0) <= 0) {
      return;
    }

    const currentBalance = await this.currencyRepository.fetchCurrency();

    const nextVcoin =
      vcoin > 0 ? (currentBalance.vcoin || 0) + vcoin : undefined;
    const nextRuby =
      ruby > 0 ? (currentBalance.ruby || 0) + ruby : undefined;

    await this.currencyRepository.updateCurrency(nextVcoin, nextRuby);
  }

  private async awardEnergy(amount: number): Promise<void> {
    if (!amount || amount <= 0) {
      return;
    }

    let stats = await userStatsRepository.fetchStats();
    if (!stats) {
      stats = await userStatsRepository.createDefaultStats();
    }

    const currentEnergy = this.clamp(stats.energy ?? 100, 0, 100);
    const newEnergy = this.clamp(currentEnergy + amount, 0, 100);

    if (newEnergy !== currentEnergy) {
      await userStatsRepository.updateStats({
        energy: newEnergy,
        energy_updated_at: new Date().toISOString(),
      });
    }
  }

  private daysBetween(from: string, to: string): number {
    const fromDate = this.parseDate(from);
    const toDate = this.parseDate(to);

    if (!fromDate || !toDate) {
      return 999;
    }

    const diff = toDate.getTime() - fromDate.getTime();
    return Math.round(diff / 86400000);
  }

  private parseDate(input: string): Date | null {
    if (!input) {
      return null;
    }
    const parts = input.split('-').map((part) => Number.parseInt(part, 10));
    if (parts.length !== 3 || parts.some((value) => Number.isNaN(value))) {
      return null;
    }
    const [year, month, day] = parts;
    return new Date(year, month - 1, day);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}


