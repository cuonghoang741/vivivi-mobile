import { getSupabaseClient } from './supabase';
import { authManager } from './AuthManager';
import { CurrencyRepository } from '../repositories/CurrencyRepository';
import { userStatsRepository } from '../repositories/UserStatsRepository';

export type LoginReward = {
  id: string;
  day_number: number;
  reward_vcoin: number;
  reward_ruby: number;
  reward_energy: number;
};

export type LoginRewardStatus = {
  currentDay: number;
  canClaimToday: boolean;
  hasClaimedToday: boolean;
  lastClaimDate: string | null;
  totalDaysClaimed: number;
};

type UserLoginRewardRecord = {
  id?: string;
  current_day: number | null;
  last_claim_date: string | null;
  total_days_claimed: number | null;
};

const TABLE_REWARDS = 'login_rewards';
const TABLE_USER = 'user_login_rewards';
const MAX_DAYS = 30;
const ENERGY_MAX = 100;

export class LoginRewardService {
  private client = getSupabaseClient();
  private currencyRepository = new CurrencyRepository();

  private requireUserId(): string {
    const userId = authManager.user?.id?.toLowerCase();
    if (!userId) {
      throw new Error('User is not authenticated');
    }
    return userId;
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0] ?? '';
  }

  private diffDays(from: string, to: string): number {
    if (!from || !to) return 999;
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return 999;
    }
    const diff = toDate.getTime() - fromDate.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  async fetchRewards(): Promise<LoginReward[]> {
    const { data, error } = await this.client
      .from(TABLE_REWARDS)
      .select('id,day_number,reward_vcoin,reward_ruby,reward_energy')
      .order('day_number', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch login rewards: ${error.message}`);
    }

    return (data || []) as LoginReward[];
  }

  private async fetchUserRecord(): Promise<UserLoginRewardRecord | null> {
    const userId = this.requireUserId();
    const { data, error } = await this.client
      .from(TABLE_USER)
      .select('id,current_day,last_claim_date,total_days_claimed')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch login reward record: ${error.message}`);
    }

    return (data as UserLoginRewardRecord | null) ?? null;
  }

  private async createUserRecord(): Promise<UserLoginRewardRecord> {
    const userId = this.requireUserId();
    const payload = {
      user_id: userId,
      current_day: 1,
      total_days_claimed: 0,
      last_claim_date: null,
    };

    const { data, error } = await this.client
      .from(TABLE_USER)
      .insert(payload)
      .select('id,current_day,last_claim_date,total_days_claimed')
      .single<UserLoginRewardRecord>();

    if (error) {
      throw new Error(`Failed to create login reward record: ${error.message}`);
    }

    return data;
  }

  private async ensureUserRecord(): Promise<UserLoginRewardRecord> {
    const record = await this.fetchUserRecord();
    if (record) {
      return record;
    }
    return this.createUserRecord();
  }

  private calculateStatus(record: UserLoginRewardRecord): LoginRewardStatus {
    const baseDay = Math.max(1, record.current_day ?? 1);
    const today = this.getTodayDate();
    const lastClaim = record.last_claim_date ?? '';

    if (!lastClaim) {
      return {
        currentDay: baseDay,
        canClaimToday: true,
        hasClaimedToday: false,
        lastClaimDate: null,
        totalDaysClaimed: record.total_days_claimed ?? 0,
      };
    }

    const daysApart = this.diffDays(lastClaim, today);
    if (daysApart === 0) {
      return {
        currentDay: baseDay,
        canClaimToday: false,
        hasClaimedToday: true,
        lastClaimDate: lastClaim,
        totalDaysClaimed: record.total_days_claimed ?? 0,
      };
    }

    if (daysApart === 1) {
      let nextDay = baseDay + 1;
      if (nextDay > MAX_DAYS) {
        nextDay = 1;
      }
      return {
        currentDay: nextDay,
        canClaimToday: true,
        hasClaimedToday: false,
        lastClaimDate: lastClaim,
        totalDaysClaimed: record.total_days_claimed ?? 0,
      };
    }

    return {
      currentDay: 1,
      canClaimToday: true,
      hasClaimedToday: false,
      lastClaimDate: lastClaim,
      totalDaysClaimed: record.total_days_claimed ?? 0,
    };
  }

  async load(): Promise<{ rewards: LoginReward[]; status: LoginRewardStatus }> {
    const [rewards, record] = await Promise.all([
      this.fetchRewards(),
      this.ensureUserRecord(),
    ]);
    const status = this.calculateStatus(record);
    return { rewards, status };
  }

  private async awardReward(reward: LoginReward): Promise<void> {
    const currentBalance = await this.currencyRepository.fetchCurrency();
    const newVcoin = currentBalance.vcoin + (reward.reward_vcoin ?? 0);
    const newRuby = currentBalance.ruby + (reward.reward_ruby ?? 0);
    await this.currencyRepository.updateCurrency(newVcoin, newRuby);

    if (reward.reward_energy > 0) {
      let statsRow = await userStatsRepository.fetchStats();
      if (!statsRow) {
        statsRow = await userStatsRepository.createDefaultStats();
      }
      const currentEnergy = Math.min(
        ENERGY_MAX,
        Math.max(0, statsRow.energy ?? ENERGY_MAX)
      );
      const newEnergy = Math.min(ENERGY_MAX, currentEnergy + reward.reward_energy);
      await userStatsRepository.updateStats({
        energy: newEnergy,
        energy_updated_at: new Date().toISOString(),
      });
    }
  }

  private async updateUserRecord(payload: {
    currentDay: number;
    lastClaimDate: string;
    totalDaysClaimed: number;
  }): Promise<void> {
    const userId = this.requireUserId();
    const { error } = await this.client.from(TABLE_USER).upsert(
      {
        user_id: userId,
        current_day: payload.currentDay,
        last_claim_date: payload.lastClaimDate,
        total_days_claimed: payload.totalDaysClaimed,
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      throw new Error(`Failed to update login reward record: ${error.message}`);
    }
  }

  async claimReward(currentDay: number): Promise<LoginRewardStatus> {
    if (currentDay < 1 || currentDay > MAX_DAYS) {
      throw new Error('Invalid day selected');
    }

    const [rewards, record] = await Promise.all([
      this.fetchRewards(),
      this.ensureUserRecord(),
    ]);
    const reward = rewards.find(r => r.day_number === currentDay);
    if (!reward) {
      throw new Error('Reward not found for this day');
    }

    const status = this.calculateStatus(record);
    if (!status.canClaimToday || status.currentDay !== currentDay) {
      throw new Error('Cannot claim reward today');
    }

    await this.awardReward(reward);

    const today = this.getTodayDate();
    await this.updateUserRecord({
      currentDay,
      lastClaimDate: today,
      totalDaysClaimed: (record.total_days_claimed ?? 0) + 1,
    });

    return {
      currentDay,
      canClaimToday: false,
      hasClaimedToday: true,
      lastClaimDate: today,
      totalDaysClaimed: (record.total_days_claimed ?? 0) + 1,
    };
  }
}


