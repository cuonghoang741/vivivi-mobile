import { BaseRepository } from './BaseRepository';
import { getAuthIdentifier } from '../services/authIdentifier';

export interface LoginReward {
  id: string;
  day_number: number;
  reward_vcoin: number;
  reward_ruby: number;
  reward_energy: number;
  created_at?: string | null;
}

export interface UserLoginReward {
  id: string;
  user_id?: string | null;
  client_id?: string | null;
  current_day: number;
  last_claim_date?: string | null;
  total_days_claimed: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export class LoginRewardRepository extends BaseRepository {
  private readonly loginRewardsTable = 'login_rewards';
  private readonly userLoginRewardsTable = 'user_login_rewards';

  async fetchRewards(): Promise<LoginReward[]> {
    const { data, error } = await this.client
      .from(this.loginRewardsTable)
      .select('id,day_number,reward_vcoin,reward_ruby,reward_energy,created_at')
      .order('day_number', { ascending: true });

    if (error) {
      throw new Error(`[LoginRewardRepository] Failed to fetch rewards: ${error.message}`);
    }

    return data ?? [];
  }

  async fetchUserRecord(): Promise<UserLoginReward | null> {
    let query = this.client
      .from(this.userLoginRewardsTable)
      .select('id,user_id,client_id,current_day,last_claim_date,total_days_claimed,created_at,updated_at')
      .limit(1);

    query = await this.withOwnerFilter(query);

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`[LoginRewardRepository] Failed to fetch user record: ${error.message}`);
    }

    if (Array.isArray(data)) {
      return data[0] ?? null;
    }

    return data;
  }

  async createDefaultUserRecord(): Promise<UserLoginReward> {
    const { userId, clientId } = await getAuthIdentifier();
    if (!userId && !clientId) {
      throw new Error('[LoginRewardRepository] Missing auth identifier');
    }

    const payload: Record<string, any> = {
      current_day: 0,
      total_days_claimed: 0,
    };

    if (userId) {
      payload.user_id = userId;
      payload.client_id = null;
    } else if (clientId) {
      payload.client_id = clientId;
      payload.user_id = null;
    }

    const { data, error } = await this.client
      .from(this.userLoginRewardsTable)
      .insert(payload)
      .select('id,user_id,client_id,current_day,last_claim_date,total_days_claimed,created_at,updated_at')
      .single<UserLoginReward>();

    if (error) {
      throw new Error(`[LoginRewardRepository] Failed to create user record: ${error.message}`);
    }

    return data;
  }

  async updateUserRecord(partial: Partial<UserLoginReward>): Promise<void> {
    const updateData = {
      ...partial,
      updated_at: new Date().toISOString(),
    };

    let query = this.client.from(this.userLoginRewardsTable).update(updateData);
    query = await this.withOwnerFilter(query);

    const { error } = await query;

    if (error) {
      throw new Error(`[LoginRewardRepository] Failed to update user record: ${error.message}`);
    }
  }

  private async withOwnerFilter(query: any): Promise<any> {
    const { userId, clientId } = await getAuthIdentifier();

    if (userId) {
      return query.eq('user_id', userId).is('client_id', null);
    }

    if (clientId) {
      return query.eq('client_id', clientId).is('user_id', null);
    }

    throw new Error('[LoginRewardRepository] Missing auth identifier');
  }
}


