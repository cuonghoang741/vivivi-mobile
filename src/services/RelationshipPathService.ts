import {
  RelationshipStage,
  RelationshipStageReward,
  RelationshipTreePath,
} from '../types/relationship';
import { executeSupabaseRequest } from '../utils/supabaseHelpers';

const STAGE_ENDPOINT = '/rest/v1/relationship_stages';
const PATHS_ENDPOINT = '/rest/v1/relationship_tree_paths';
const REWARDS_ENDPOINT = '/rest/v1/relationship_stage_rewards';

const CACHE_TTL_MS = 5 * 60 * 1000;

class RelationshipPathService {
  private stages: RelationshipStage[] = [];
  private paths: RelationshipTreePath[] = [];
  private rewards: RelationshipStageReward[] = [];
  private lastLoadedAt = 0;
  private inflightPromise: Promise<void> | null = null;

  async ensureDataLoaded(force = false): Promise<void> {
    const isFresh = Date.now() - this.lastLoadedAt < CACHE_TTL_MS && this.stages.length > 0;
    if (!force && isFresh) {
      return;
    }

    if (this.inflightPromise) {
      await this.inflightPromise;
      return;
    }

    this.inflightPromise = this.loadAll();
    try {
      await this.inflightPromise;
    } finally {
      this.inflightPromise = null;
    }
  }

  getStages(): RelationshipStage[] {
    return this.stages;
  }

  getPaths(): RelationshipTreePath[] {
    return this.paths;
  }

  getRewardsForStage(stageKey: string): RelationshipStageReward[] {
    if (!stageKey) {
      return [];
    }
    return this.rewards.filter(reward => reward.stage_key === stageKey);
  }

  getNextStages(stageKey: string): RelationshipStage[] {
    if (!stageKey) {
      return [];
    }
    const nextKeys = this.paths
      .filter(path => path.from_stage_key === stageKey && (path.is_available ?? true))
      .map(path => path.to_stage_key);
    return this.stages.filter(stage => nextKeys.includes(stage.stage_key));
  }

  private async loadAll(): Promise<void> {
    try {
      const [stages, paths, rewards] = await Promise.all([
        this.fetchStages(),
        this.fetchPaths(),
        this.fetchRewards(),
      ]);
      this.stages = stages;
      this.paths = paths;
      this.rewards = rewards;
      this.lastLoadedAt = Date.now();
    } catch (error) {
      console.warn('[RelationshipPathService] Failed to load relationship data', error);
      throw error;
    }
  }

  private async fetchStages(): Promise<RelationshipStage[]> {
    const data = await executeSupabaseRequest<RelationshipStage[]>(
      STAGE_ENDPOINT,
      {
        select: '*',
        order: 'relationship_threshold.asc',
      },
      'GET'
    );
    return data ?? [];
  }

  private async fetchPaths(): Promise<RelationshipTreePath[]> {
    const data = await executeSupabaseRequest<RelationshipTreePath[]>(
      PATHS_ENDPOINT,
      {
        select: '*',
      },
      'GET'
    );
    return data ?? [];
  }

  private async fetchRewards(): Promise<RelationshipStageReward[]> {
    const data = await executeSupabaseRequest<RelationshipStageReward[]>(
      REWARDS_ENDPOINT,
      {
        select: '*',
      },
      'GET'
    );
    return data ?? [];
  }
}

export const relationshipPathService = new RelationshipPathService();

