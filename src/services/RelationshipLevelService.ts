import { CurrencyRepository } from '../repositories/CurrencyRepository';
import {
  RelationshipRepository,
  relationshipRepository,
} from '../repositories/RelationshipRepository';
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
    private readonly repository: RelationshipRepository = relationshipRepository,
    private readonly currencyRepository: CurrencyRepository = new CurrencyRepository()
  ) {}

  async loadRelationship(characterId: string): Promise<RelationshipData> {
    const existing = await this.repository.fetchRelationship(characterId);
    if (existing) {
      return existing;
    }
    return this.repository.createDefaultRelationship(characterId);
  }

  async fetchClaimedMilestones(characterId: string): Promise<Set<number>> {
    return this.repository.fetchClaimedMilestones(characterId);
  }

  async claimMilestone(
    characterId: string,
    milestone: number
  ): Promise<ClaimMilestoneResult> {
    try {
      const alreadyClaimed = await this.repository.checkMilestoneClaimed(
        characterId,
        milestone
      );
      if (alreadyClaimed) {
        return { success: false, alreadyClaimed: true };
      }

      const rewards = RelationshipLevelService.getRelationshipRewards(milestone);

      await this.repository.markMilestoneClaimed(characterId, milestone);
      await this.applyCurrencyDelta(rewards.vcoin, rewards.ruby);

      return {
        success: true,
        rewards,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Không thể nhận thưởng milestone',
      };
    }
  }

  async updateRelationshipLevel(characterId: string, level: number): Promise<void> {
    await this.repository.updateRelationshipLevel(characterId, level);
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

