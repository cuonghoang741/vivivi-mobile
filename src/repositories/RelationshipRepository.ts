import { BaseRepository } from './BaseRepository';
import { getAuthIdentifier } from '../services/authIdentifier';
import type {
  RelationshipData,
  RelationshipPathHistoryEntry,
} from '../types/relationship';

type RelationshipRow = {
  character_id: string;
  relationship_level: number | null;
  relationship_xp: number | null;
  total_chats: number | null;
  total_voice_calls: number | null;
  total_video_calls: number | null;
  current_stage_key: string | null;
  relationship_path_history?: RelationshipPathHistoryEntry[] | null;
  last_interaction?: string | null;
};

type MilestoneRow = {
  milestone_level: number;
  claimed: boolean;
};

const RELATIONSHIP_TABLE = 'character_relationship';
const MILESTONES_TABLE = 'relationship_milestones';

export class RelationshipRepository extends BaseRepository {
  async fetchRelationship(characterId: string): Promise<RelationshipData | null> {
    let query = this.client
      .from(RELATIONSHIP_TABLE)
      .select(
        'character_id,relationship_level,relationship_xp,total_chats,total_voice_calls,total_video_calls,current_stage_key,relationship_path_history,last_interaction'
      )
      .eq('character_id', characterId)
      .limit(1)
      .maybeSingle<RelationshipRow>();

    query = await this.addAuthFilters(query);

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`[RelationshipRepository] Failed to fetch relationship: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return this.mapRowToRelationship(data);
  }

  async createDefaultRelationship(characterId: string): Promise<RelationshipData> {
    const { userId, clientId } = await getAuthIdentifier();
    if (!userId && !clientId) {
      throw new Error('[RelationshipRepository] Missing auth identifier');
    }

    const now = new Date().toISOString();
    const history: RelationshipPathHistoryEntry[] = [
      {
        stage_key: 'stranger',
        chosen_at: now,
      },
    ];

    const payload: Record<string, any> = {
      character_id: characterId,
      relationship_level: 0,
      relationship_xp: 0,
      total_chats: 0,
      total_voice_calls: 0,
      total_video_calls: 0,
      current_stage_key: 'stranger',
      relationship_path_history: history,
      last_interaction: now,
    };

    if (userId) {
      payload.user_id = userId;
    } else if (clientId) {
      payload.client_id = clientId;
    }

    const { data, error } = await this.client
      .from(RELATIONSHIP_TABLE)
      .insert(payload)
      .select(
        'character_id,relationship_level,relationship_xp,total_chats,total_voice_calls,total_video_calls,current_stage_key,relationship_path_history,last_interaction'
      )
      .single<RelationshipRow>();

    if (error || !data) {
      throw new Error(`[RelationshipRepository] Failed to create relationship: ${error?.message}`);
    }

    return this.mapRowToRelationship(data);
  }

  async updateRelationshipLevel(characterId: string, level: number): Promise<void> {
    let query = this.client
      .from(RELATIONSHIP_TABLE)
      .update({
        relationship_level: level,
        last_interaction: new Date().toISOString(),
      })
      .eq('character_id', characterId);

    query = await this.addAuthFilters(query);

    const { error } = await query;
    if (error) {
      throw new Error(`[RelationshipRepository] Failed to update level: ${error.message}`);
    }
  }

  async fetchClaimedMilestones(characterId: string): Promise<Set<number>> {
    let query = this.client
      .from(MILESTONES_TABLE)
      .select('milestone_level,claimed')
      .eq('character_id', characterId);

    query = await this.addAuthFilters(query);

    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST116') {
        return new Set();
      }
      throw new Error(`[RelationshipRepository] Failed to fetch milestones: ${error.message}`);
    }

    const claimed = (data as MilestoneRow[] | null)?.filter(row => row.claimed) ?? [];
    return new Set(claimed.map(row => row.milestone_level));
  }

  async checkMilestoneClaimed(characterId: string, milestone: number): Promise<boolean> {
    let query = this.client
      .from(MILESTONES_TABLE)
      .select('claimed')
      .eq('character_id', characterId)
      .eq('milestone_level', milestone)
      .limit(1)
      .maybeSingle<MilestoneRow>();

    query = await this.addAuthFilters(query);

    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST116') {
        return false;
      }
      throw new Error(`[RelationshipRepository] Failed to check milestone: ${error.message}`);
    }

    return data?.claimed ?? false;
  }

  async markMilestoneClaimed(characterId: string, milestone: number): Promise<void> {
    const { userId, clientId } = await getAuthIdentifier();
    if (!userId && !clientId) {
      throw new Error('[RelationshipRepository] Missing auth identifier');
    }

    const exists = await this.checkMilestoneClaimed(characterId, milestone);
    const now = new Date().toISOString();

    if (exists) {
      let query = this.client
        .from(MILESTONES_TABLE)
        .update({
          claimed: true,
          claimed_at: now,
        })
        .eq('character_id', characterId)
        .eq('milestone_level', milestone);

      query = await this.addAuthFilters(query);

      const { error } = await query;
      if (error) {
        throw new Error(`[RelationshipRepository] Failed to update milestone: ${error.message}`);
      }
      return;
    }

    const payload: Record<string, any> = {
      character_id: characterId,
      milestone_level: milestone,
      claimed: true,
      claimed_at: now,
    };

    if (userId) {
      payload.user_id = userId;
    } else if (clientId) {
      payload.client_id = clientId;
    }

    const { error } = await this.client.from(MILESTONES_TABLE).insert(payload);
    if (error) {
      throw new Error(`[RelationshipRepository] Failed to insert milestone: ${error.message}`);
    }
  }

  private mapRowToRelationship(row: RelationshipRow): RelationshipData {
    const history = Array.isArray(row.relationship_path_history)
      ? row.relationship_path_history
      : [];

    return {
      characterId: row.character_id,
      relationshipLevel: row.relationship_level ?? 0,
      relationshipXP: row.relationship_xp ?? 0,
      totalChats: row.total_chats ?? 0,
      totalVoiceCalls: row.total_voice_calls ?? 0,
      totalVideoCalls: row.total_video_calls ?? 0,
      currentStageKey: row.current_stage_key ?? 'stranger',
      relationshipPathHistory: history,
      lastInteraction: row.last_interaction ?? null,
    };
  }
}

export const relationshipRepository = new RelationshipRepository();

