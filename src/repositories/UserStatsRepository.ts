import { BaseRepository } from './BaseRepository';

export interface UserStatsRow {
  level: number | null;
  xp: number | null;
  energy: number | null;
  energy_updated_at: string | null;
  login_streak: number | null;
}

const DEFAULT_ROW: Required<UserStatsRow> = {
  level: 1,
  xp: 0,
  energy: 100,
  energy_updated_at: new Date(0).toISOString(),
  login_streak: 0,
};

/**
 * Repository truy cập bảng user_stats – phản chiếu UserStatsRepository bên Swift.
 */
export class UserStatsRepository extends BaseRepository {
  private readonly table = 'user_stats';

  async fetchStats(): Promise<UserStatsRow | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select('level,xp,energy,energy_updated_at,login_streak')
      .limit(1)
      .maybeSingle<UserStatsRow>();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch user stats: ${error.message}`);
    }

    return data ?? null;
  }

  async createDefaultStats(): Promise<UserStatsRow> {
    const userId = this.getUserId();
    if (!userId) {
      throw new Error('User is not authenticated');
    }

    const payload = {
      user_id: userId,
      level: 1,
      xp: 0,
      energy: DEFAULT_ROW.energy,
      energy_updated_at: new Date().toISOString(),
      login_streak: 0,
    };

    const { data, error } = await this.client
      .from(this.table)
      .insert(payload)
      .select('level,xp,energy,energy_updated_at,login_streak')
      .single<UserStatsRow>();

    if (error) {
      throw new Error(`Failed to create default stats: ${error.message}`);
    }

    return data;
  }

  async updateStats(partial: Partial<UserStatsRow>): Promise<void> {
    const userId = this.getUserId();
    if (!userId) {
      throw new Error('User is not authenticated');
    }

    const { error } = await this.client
      .from(this.table)
      .update(partial)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to update user stats: ${error.message}`);
    }
  }
}

export const userStatsRepository = new UserStatsRepository();

