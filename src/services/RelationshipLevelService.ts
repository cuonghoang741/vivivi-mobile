import { CurrencyRepository } from '../repositories/CurrencyRepository';
import type { RelationshipData } from '../types/relationship';

export const RELATIONSHIP_MILESTONES = [10, 25, 40, 50, 60, 75, 90, 100] as const;

export type MilestoneReward = {
  vcoin: number;
  ruby: number;
};

export type ClaimMilestoneResult =
  | {
      success: true;
      rewards: MilestoneReward;
    }
  | {
      success: false;
      alreadyClaimed?: boolean;
      error?: string;
    };

export class RelationshipLevelService {
  constructor(
    private readonly currencyRepository: CurrencyRepository = new CurrencyRepository()
  ) {}

  /**
   * Load relationship data cho 1 character
   * - Clone logic từ Swift: nếu chưa có thì tạo relationship mặc định
   */
  async loadRelationship(characterId: string): Promise<RelationshipData> {
    const existing = await this.fetchRelationship(characterId);
    if (existing) {
      return existing;
    }
    return this.createDefaultRelationship(characterId);
  }

  /**
   * Lấy danh sách milestone đã claim cho character
   * - Trả về Set<number> milestone_level đã được claimed=true
   */
  async fetchClaimedMilestones(characterId: string): Promise<Set<number>> {
    const { SUPABASE_URL } = await import('../config/supabase');
    const { getSupabaseAuthHeaders } = await import('../utils/supabaseHelpers');

    const params = new URLSearchParams();
    params.append('character_id', `eq.${characterId}`);
    params.append('claimed', 'eq.true');

    const headers = await getSupabaseAuthHeaders();
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/relationship_milestones?${params.toString()}`,
      {
        method: 'GET',
        headers,
      }
    );

    if (!response.ok) {
      console.warn(
        '[RelationshipLevelService] fetchClaimedMilestones failed:',
        response.status,
        await response.text()
      );
      return new Set();
    }

    const rows: any[] = await response.json();
    const levels = rows
      .map(row => row.milestone_level as number | undefined)
      .filter((lvl): lvl is number => typeof lvl === 'number');

    return new Set(levels);
  }

  /**
   * Claim milestone:
   * - Kiểm tra đã claim chưa
   * - Ghi vào bảng relationship_milestones
   * - Cộng tiền vào user_currency
   * Clone logic từ Swift RelationshipRepository + RelationshipLevelService.
   */
  async claimMilestone(
    characterId: string,
    milestone: number
  ): Promise<ClaimMilestoneResult> {
    try {
      const alreadyClaimed = await this.checkMilestoneClaimed(characterId, milestone);
      if (alreadyClaimed) {
        return { success: false, alreadyClaimed: true };
      }

      const rewards = RelationshipLevelService.getRelationshipRewards(milestone);

      await this.markMilestoneClaimed(characterId, milestone);
      await this.applyCurrencyDelta(rewards.vcoin, rewards.ruby);

      return {
        success: true,
        rewards,
      };
    } catch (error: any) {
      console.warn('[RelationshipLevelService] claimMilestone error', error);
      return {
        success: false,
        error: error?.message || 'Không thể nhận thưởng milestone',
      };
    }
  }

  /**
   * Update relationship level cho character (clone Swift)
   */
  async updateRelationshipLevel(characterId: string, level: number): Promise<void> {
    const { SUPABASE_URL } = await import('../config/supabase');
    const { getSupabaseAuthHeaders } = await import('../utils/supabaseHelpers');

    const params = new URLSearchParams();
    params.append('character_id', `eq.${characterId}`);

    const headers = await getSupabaseAuthHeaders();
    headers['Prefer'] = 'return=minimal';

    const now = new Date().toISOString();

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/character_relationship?${params.toString()}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          relationship_level: level,
          last_interaction_at: now,
        }),
      }
    );

    if (!response.ok) {
      console.error(
        '[RelationshipLevelService] updateRelationshipLevel failed:',
        response.status,
        await response.text()
      );
    }
  }

  /**
   * Update relationship interaction timestamp
   * Matching Swift version's updateRelationshipInteraction
   */
  async updateRelationshipInteraction(characterId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      const { SUPABASE_URL } = await import('../config/supabase');
      const { getSupabaseAuthHeaders } = await import('../utils/supabaseHelpers');
      
      const headers = await getSupabaseAuthHeaders();
      
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/character_relationship?character_id=eq.${characterId}`,
        {
          method: 'PATCH',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            last_interaction_at: now,
          }),
        }
      );

      if (!response.ok) {
        console.error('[RelationshipLevelService] Failed to update interaction:', response.status);
      }
    } catch (error) {
      console.error('[RelationshipLevelService] Error updating interaction:', error);
    }
  }

  // --------- Private helpers (clone từ Swift RelationshipRepository) ----------

  private async fetchRelationship(characterId: string): Promise<RelationshipData | null> {
    const { SUPABASE_URL } = await import('../config/supabase');
    const { getSupabaseAuthHeaders } = await import('../utils/supabaseHelpers');

    const params = new URLSearchParams();
    params.append('character_id', `eq.${characterId}`);
    params.append('limit', '1');

    const headers = await getSupabaseAuthHeaders();

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/character_relationship?${params.toString()}`,
      {
        method: 'GET',
        headers,
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.warn(
        '[RelationshipLevelService] fetchRelationship failed:',
        response.status,
        await response.text()
      );
      return null;
    }

    const rows: any[] = await response.json();
    if (!rows.length) {
      return null;
    }
    return rows[0] as RelationshipData;
  }

  private async createDefaultRelationship(characterId: string): Promise<RelationshipData> {
    const { SUPABASE_URL } = await import('../config/supabase');
    const { getSupabaseAuthHeaders } = await import('../utils/supabaseHelpers');
    const { ensureClientId } = await import('../utils/clientId');
    const { authManager } = await import('./AuthManager');

    const headers = await getSupabaseAuthHeaders();
    headers['Prefer'] = 'return=representation';

    const userId = authManager.user?.id?.toLowerCase() ?? null;
    const clientId = userId ? null : await ensureClientId();

    const now = new Date().toISOString();

    const body: any = {
      character_id: characterId,
      relationship_level: 0,
      relationship_xp: 0,
      total_chats: 0,
      total_voice_calls: 0,
      total_video_calls: 0,
      current_stage_key: 'stranger',
      relationship_path_history: [
        {
          stage_key: 'stranger',
          chosen_at: now,
        },
      ],
    };

    if (userId) {
      body.user_id = userId;
    } else if (clientId) {
      body.client_id = clientId;
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/character_relationship`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `[RelationshipLevelService] createDefaultRelationship failed: ${response.status} ${text}`
      );
    }

    const row: any = await response.json();
    // REST insert with return=representation có thể trả object hoặc array
    const data = Array.isArray(row) ? row[0] : row;
    return data as RelationshipData;
  }

  private async checkMilestoneClaimed(
    characterId: string,
    milestone: number
  ): Promise<boolean> {
    const { SUPABASE_URL } = await import('../config/supabase');
    const { getSupabaseAuthHeaders } = await import('../utils/supabaseHelpers');

    const params = new URLSearchParams();
    params.append('character_id', `eq.${characterId}`);
    params.append('milestone_level', `eq.${milestone}`);
    params.append('limit', '1');

    const headers = await getSupabaseAuthHeaders();

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/relationship_milestones?${params.toString()}`,
      {
        method: 'GET',
        headers,
      }
    );

    if (!response.ok) {
      console.warn(
        '[RelationshipLevelService] checkMilestoneClaimed failed:',
        response.status,
        await response.text()
      );
      return false;
    }

    const rows: any[] = await response.json();
    if (!rows.length) {
      return false;
    }
    return !!rows[0].claimed;
  }

  private async markMilestoneClaimed(characterId: string, milestone: number): Promise<void> {
    const exists = await this.checkMilestoneClaimed(characterId, milestone);
    const { SUPABASE_URL } = await import('../config/supabase');
    const { getSupabaseAuthHeaders } = await import('../utils/supabaseHelpers');
    const { ensureClientId } = await import('../utils/clientId');
    const { authManager } = await import('./AuthManager');

    const headers = await getSupabaseAuthHeaders();
    headers['Prefer'] = 'return=minimal';

    const now = new Date().toISOString();
    const userId = authManager.user?.id?.toLowerCase() ?? null;
    const clientId = userId ? null : await ensureClientId();

    const body: any = {
      character_id: characterId,
      milestone_level: milestone,
      claimed: true,
      claimed_at: now,
    };

    if (userId) {
      body.user_id = userId;
    } else if (clientId) {
      body.client_id = clientId;
    }

    const method = exists ? 'PATCH' : 'POST';
    const url =
      method === 'PATCH'
        ? `${SUPABASE_URL}/rest/v1/relationship_milestones?character_id=eq.${characterId}&milestone_level=eq.${milestone}`
        : `${SUPABASE_URL}/rest/v1/relationship_milestones`;

    const response = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(
        '[RelationshipLevelService] markMilestoneClaimed failed:',
        response.status,
        await response.text()
      );
    }
  }

  private async applyCurrencyDelta(vcoin: number, ruby: number) {
    if (!vcoin && !ruby) {
      return;
    }
    const balance = await this.currencyRepository.fetchCurrency();
    const nextVcoin = vcoin > 0 ? (balance.vcoin ?? 0) + vcoin : undefined;
    const nextRuby = ruby > 0 ? (balance.ruby ?? 0) + ruby : undefined;
    await this.currencyRepository.updateCurrency(
      nextVcoin === undefined ? undefined : nextVcoin,
      nextRuby === undefined ? undefined : nextRuby
    );
  }

  static getRelationshipLevelName(level: number): string {
    if (level >= 90) return 'Soulmate';
    if (level >= 75) return 'Lover';
    if (level >= 60) return 'Crush';
    if (level >= 50) return 'Best Friend';
    if (level >= 40) return 'Close Friend';
    if (level >= 25) return 'Friend';
    if (level >= 10) return 'Acquaintance';
    return 'Stranger';
  }

  static getRelationshipDescription(levelName: string): string {
    switch (levelName) {
      case 'Stranger':
        return "You're just getting started. Spend more time chatting to build your connection.";
      case 'Acquaintance':
        return "You're warming up. Keep the conversations going to become closer friends.";
      case 'Friend':
        return "You're officially friends! Meaningful chats will deepen the bond even more.";
      case 'Close Friend':
        return "You're close friends now. Sharing more moments together will unlock new memories.";
      case 'Best Friend':
        return 'Best friends forever! Keep interacting to see what surprises await.';
      case 'Crush':
        return "There's a spark between you two. Keep the momentum and see where it goes.";
      case 'Lover':
        return "It's true love. Continue to show care to keep the relationship glowing.";
      case 'Soulmate':
        return 'A soulmate connection this strong is rare. Cherish every conversation.';
      default:
        return 'Build your bond through daily chats, calls, and shared experiences.';
    }
  }

  static getRelationshipRewards(level: number): MilestoneReward {
    switch (level) {
      case 10:
        return { vcoin: 200, ruby: 5 };
      case 25:
        return { vcoin: 500, ruby: 10 };
      case 40:
        return { vcoin: 1000, ruby: 20 };
      case 50:
        return { vcoin: 2000, ruby: 50 };
      case 60:
        return { vcoin: 3000, ruby: 75 };
      case 75:
        return { vcoin: 5000, ruby: 100 };
      case 90:
        return { vcoin: 8000, ruby: 150 };
      case 100:
        return { vcoin: 10000, ruby: 300 };
      default:
        return { vcoin: 0, ruby: 0 };
    }
  }
}

export const relationshipLevelService = new RelationshipLevelService();

