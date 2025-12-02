import { BaseRepository } from './BaseRepository';
import { getAuthIdentifier } from '../services/authIdentifier';

export type Difficulty = 'easy' | 'medium' | 'hard' | string;

export interface DailyQuest {
  id: string;
  quest_type: string;
  quest_category?: string | null;
  difficulty: Difficulty;
  description: string;
  target_value: number;
  reward_vcoin: number;
  reward_ruby: number;
  reward_xp: number;
  reward_character_id?: string | null;
  reward_background_id?: string | null;
  reward_costume_id?: string | null;
  reward_item_rarity?: string | null;
  is_repeatable?: boolean | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UserDailyQuest {
  id: string;
  user_id?: string | null;
  client_id?: string | null;
  quest_id?: string | null;
  progress: number;
  completed: boolean;
  claimed: boolean;
  quest_date?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  quest?: DailyQuest | null;
}

export interface LevelQuest {
  id: string;
  level_required: number;
  quest_type: string;
  quest_category: string;
  description: string;
  target_value: number;
  reward_vcoin: number;
  reward_ruby: number;
  reward_xp: number;
  reward_character_id?: string | null;
  reward_background_id?: string | null;
  reward_costume_id?: string | null;
  reward_item_rarity?: string | null;
  difficulty?: Difficulty;
  is_repeatable?: boolean | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UserLevelQuest {
  id: string;
  user_id?: string | null;
  client_id?: string | null;
  quest_id: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
  unlocked_at?: string | null;
  completed_at?: string | null;
  claimed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  quest?: LevelQuest | null;
}

const DAILY_SELECT =
  'id,user_id,client_id,quest_id,progress,completed,claimed,quest_date,created_at,completed_at,quest:daily_quests(*)';

const LEVEL_SELECT =
  'id,user_id,client_id,quest_id,progress,completed,claimed,unlocked_at,completed_at,claimed_at,created_at,updated_at,quest:level_quests(*)';

export class QuestRepository extends BaseRepository {
  async fetchTodayQuests(date: string): Promise<UserDailyQuest[]> {
    let query = this.client
      .from('user_daily_quests')
      .select(DAILY_SELECT)
      .eq('quest_date', date)
      .order('created_at', { ascending: true });

    query = await this.addAuthFilters(query);

    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST116') {
        return [];
      }
      throw new Error(`Failed to fetch quests: ${error.message}`);
    }

    return (data as UserDailyQuest[]) ?? [];
  }

  async fetchAllActiveQuests(): Promise<DailyQuest[]> {
    const { data, error } = await this.client
      .from<DailyQuest>('daily_quests')
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to fetch daily quests: ${error.message}`);
    }

    return data ?? [];
  }

  async createUserDailyQuest(questId: string, date: string): Promise<UserDailyQuest> {
    const { userId, clientId } = await getAuthIdentifier();
    if (!userId && !clientId) {
      throw new Error('User is not authenticated');
    }

    const payload: Record<string, any> = {
      quest_id: questId,
      quest_date: date,
      progress: 0,
      completed: false,
      claimed: false,
    };

    if (userId) {
      payload.user_id = userId;
    } else if (clientId) {
      payload.client_id = clientId;
    }

    const { data, error } = await this.client
      .from<UserDailyQuest>('user_daily_quests')
      .insert(payload)
      .select(DAILY_SELECT)
      .single();

    if (error) {
      throw new Error(`Failed to create user quest: ${error.message}`);
    }

    return data;
  }

  async markAllQuestsAsArchived(date: string): Promise<void> {
    let query = this.client
      .from('user_daily_quests')
      .update({
        completed: true,
        claimed: true,
        completed_at: new Date().toISOString(),
      })
      .eq('quest_date', date);

    query = await this.addAuthFilters(query);

    const { error } = await query;
    if (error) {
      throw new Error(`Failed to archive quests: ${error.message}`);
    }
  }

  async markQuestClaimed(id: string): Promise<void> {
    let query = this.client
      .from('user_daily_quests')
      .update({
        claimed: true,
      })
      .eq('id', id);

    query = await this.addAuthFilters(query);

    const { error } = await query;
    if (error) {
      throw new Error(`Failed to mark quest claimed: ${error.message}`);
    }
  }

  async updateDailyQuestProgress(
    id: string,
    progress: number,
    completed: boolean,
    completedAt?: string | null
  ): Promise<void> {
    let query = this.client
      .from('user_daily_quests')
      .update({
        progress,
        completed,
        completed_at: completed
          ? completedAt ?? new Date().toISOString()
          : completedAt ?? null,
      })
      .eq('id', id);

    query = await this.addAuthFilters(query);

    const { error } = await query;
    if (error) {
      throw new Error(`Failed to update quest progress: ${error.message}`);
    }
  }

  async fetchUserLevelQuests(userLevel?: number): Promise<UserLevelQuest[]> {
    let query = this.client
      .from('user_level_quests')
      .select(LEVEL_SELECT)
      .order('created_at', { ascending: false });

    query = await this.addAuthFilters(query);

    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST116') {
        return [];
      }
      throw new Error(`Failed to fetch level quests: ${error.message}`);
    }

    return (data as UserLevelQuest[]) ?? [];
  }

  async fetchAvailableLevelQuests(userLevel: number): Promise<LevelQuest[]> {
    const { data, error } = await this.client
      .from<LevelQuest>('level_quests')
      .select('*')
      .lte('level_required', userLevel)
      .eq('is_active', true)
      .order('level_required', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch available level quests: ${error.message}`);
    }

    return data ?? [];
  }

  async fetchLevelQuests(level: number): Promise<LevelQuest[]> {
    const { data, error } = await this.client
      .from<LevelQuest>('level_quests')
      .select('*')
      .eq('level_required', level)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to fetch level quests: ${error.message}`);
    }

    return data ?? [];
  }

  async createUserLevelQuest(questId: string): Promise<UserLevelQuest> {
    const { userId, clientId } = await getAuthIdentifier();
    if (!userId && !clientId) {
      throw new Error('User is not authenticated');
    }

    const payload: Record<string, any> = {
      quest_id: questId,
      progress: 0,
      completed: false,
      claimed: false,
      unlocked_at: new Date().toISOString(),
    };

    if (userId) {
      payload.user_id = userId;
    } else if (clientId) {
      payload.client_id = clientId;
    }

    const { data, error } = await this.client
      .from<UserLevelQuest>('user_level_quests')
      .insert(payload)
      .select(LEVEL_SELECT)
      .single();

    if (error) {
      throw new Error(`Failed to create user level quest: ${error.message}`);
    }

    return data;
  }

  async markLevelQuestClaimed(id: string): Promise<void> {
    let query = this.client
      .from('user_level_quests')
      .update({
        claimed: true,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', id);

    query = await this.addAuthFilters(query);

    const { error } = await query;
    if (error) {
      throw new Error(`Failed to mark level quest claimed: ${error.message}`);
    }
  }

  async updateLevelQuestProgress(
    id: string,
    progress: number,
    completed: boolean,
    completedAt?: string | null
  ): Promise<void> {
    let query = this.client
      .from('user_level_quests')
      .update({
        progress,
        completed,
        completed_at: completed
          ? completedAt ?? new Date().toISOString()
          : completedAt ?? null,
      })
      .eq('id', id);

    query = await this.addAuthFilters(query);

    const { error } = await query;
    if (error) {
      throw new Error(`Failed to update level quest progress: ${error.message}`);
    }
  }
}


