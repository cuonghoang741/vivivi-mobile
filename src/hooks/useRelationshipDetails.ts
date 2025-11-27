import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RelationshipData, RelationshipStage } from '../types/relationship';
import {
  relationshipLevelService,
  RELATIONSHIP_MILESTONES,
  RelationshipLevelService,
  type ClaimMilestoneResult,
} from '../services/RelationshipLevelService';
import { relationshipPathService } from '../services/RelationshipPathService';

export type StageRewardSummary = {
  vcoin: number;
  ruby: number;
  xp: number;
};

type UseRelationshipDetailsOptions = {
  enabled?: boolean;
};

type ClaimHandler = (stage: RelationshipStage) => Promise<ClaimMilestoneResult>;

export type UseRelationshipDetailsResult = {
  relationship: RelationshipData | null;
  levelName: string;
  levelDescription: string;
  loading: boolean;
  error: Error | null;
  claimedMilestones: Set<number>;
  stages: RelationshipStage[];
  milestones: readonly number[];
  refresh: () => Promise<void>;
  getStageRewards: (stageKey: string) => StageRewardSummary;
  isMilestoneClaimed: (milestone: number) => boolean;
  canClaimMilestone: (stage: RelationshipStage) => boolean;
  claimMilestone: ClaimHandler;
  claimingMilestone: number | null;
};

export const useRelationshipDetails = (
  characterId?: string,
  options: UseRelationshipDetailsOptions = {}
): UseRelationshipDetailsResult => {
  const { enabled = true } = options;
  const [relationship, setRelationship] = useState<RelationshipData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [claimedMilestones, setClaimedMilestones] = useState<Set<number>>(new Set());
  const [claimingMilestone, setClaimingMilestone] = useState<number | null>(null);
  const [stageVersion, setStageVersion] = useState(0);

  const refresh = useCallback(async () => {
    if (!characterId || !enabled) {
      return;
    }
    setLoading(true);
    try {
      await relationshipPathService.ensureDataLoaded();
      setStageVersion(Date.now());

      const [data, claimed] = await Promise.all([
        relationshipLevelService.loadRelationship(characterId),
        relationshipLevelService.fetchClaimedMilestones(characterId),
      ]);
      setRelationship(data);
      setClaimedMilestones(claimed);
      setError(null);
    } catch (err: any) {
      const message = err?.message ?? 'Không thể tải dữ liệu quan hệ';
      setError(err instanceof Error ? err : new Error(message));
    } finally {
      setLoading(false);
    }
  }, [characterId, enabled]);

  const stages = useMemo(
    () => relationshipPathService.getStages(),
    [stageVersion]
  );

  const getStageRewards = useCallback(
    (stageKey: string): StageRewardSummary => {
      const rewards = relationshipPathService.getRewardsForStage(stageKey);
      return rewards.reduce<StageRewardSummary>(
        (acc, reward) => {
          const value = reward.reward_value ?? 0;
          if (reward.reward_type === 'vcoin') {
            acc.vcoin += value;
          } else if (reward.reward_type === 'ruby') {
            acc.ruby += value;
          } else if (reward.reward_type === 'xp') {
            acc.xp += value;
          }
          return acc;
        },
        { vcoin: 0, ruby: 0, xp: 0 }
      );
    },
    [stageVersion]
  );

  const levelName = useMemo(
    () => RelationshipLevelService.getRelationshipLevelName(relationship?.relationshipLevel ?? 0),
    [relationship?.relationshipLevel]
  );

  const levelDescription = useMemo(
    () => RelationshipLevelService.getRelationshipDescription(levelName),
    [levelName]
  );

  const isMilestoneClaimed = useCallback(
    (milestone: number) => claimedMilestones.has(milestone),
    [claimedMilestones]
  );

  const canClaimMilestone = useCallback(
    (stage: RelationshipStage) =>
      (relationship?.relationshipLevel ?? 0) >= stage.relationship_threshold &&
      !claimedMilestones.has(stage.relationship_threshold),
    [relationship?.relationshipLevel, claimedMilestones]
  );

  const claimMilestone = useCallback<ClaimHandler>(
    async stage => {
      if (!characterId) {
        return {
          success: false,
          error: 'Không tìm thấy nhân vật hiện tại',
        };
      }

      const milestone = stage.relationship_threshold;
      if (claimedMilestones.has(milestone)) {
        return {
          success: false,
          alreadyClaimed: true,
        };
      }

      setClaimingMilestone(milestone);
      try {
        const result = await relationshipLevelService.claimMilestone(characterId, milestone);
        if (result.success) {
          setClaimedMilestones(prev => {
            const next = new Set(prev);
            next.add(milestone);
            return next;
          });
        }
        return result;
      } finally {
        setClaimingMilestone(null);
      }
    },
    [characterId, claimedMilestones]
  );

  useEffect(() => {
    if (!characterId || !enabled) {
      return;
    }
    refresh();
  }, [characterId, enabled, refresh]);

  return {
    relationship,
    levelName,
    levelDescription,
    loading,
    error,
    claimedMilestones,
    stages,
    milestones: RELATIONSHIP_MILESTONES,
    refresh,
    getStageRewards,
    isMilestoneClaimed,
    canClaimMilestone,
    claimMilestone,
    claimingMilestone,
  };
};

