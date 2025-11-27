import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { CharacterRepository, type CharacterItem } from '../../repositories/CharacterRepository';
import { CostumeRepository, type CostumeItem } from '../../repositories/CostumeRepository';
import AssetRepository from '../../repositories/AssetRepository';
import { usePurchaseContext } from '../../context/PurchaseContext';
import { useRelationshipDetails, type StageRewardSummary } from '../../hooks/useRelationshipDetails';
import type { RelationshipStage } from '../../types/relationship';
import { RewardClaimModal, type RewardDescriptor } from '../relationship/RewardClaimModal';

type CharacterDetailSheetProps = {
  isOpened: boolean;
  onIsOpenedChange: (opened: boolean) => void;
  characterId: string;
  characterName: string;
  characterAvatarURL?: string | null;
  characterDescription?: string | null;
  onPurchaseCostume?: (costume: CostumeItem) => void;
  onSelectCostume?: (costume: CostumeItem) => void;
};

type IoniconName = keyof typeof Ionicons.glyphMap;

type RewardModalState = {
  stageName: string;
  milestone: number;
  rewards: RewardDescriptor[];
};

export const CharacterDetailSheet: React.FC<CharacterDetailSheetProps> = ({
  isOpened,
  onIsOpenedChange,
  characterId,
  characterName,
  characterAvatarURL,
  characterDescription,
  onPurchaseCostume,
  onSelectCostume,
}) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [showRelationshipTreeInfo, setShowRelationshipTreeInfo] = useState(false);
  
  // Relationship data
  const [rewardModal, setRewardModal] = useState<RewardModalState | null>(null);
  
  // Character data
  const [character, setCharacter] = useState<CharacterItem | null>(null);
  
  // Costume data
  const [costumes, setCostumes] = useState<CostumeItem[]>([]);
  const [ownedCostumeIds, setOwnedCostumeIds] = useState<Set<string>>(new Set());
  const [isLoadingCostumes, setIsLoadingCostumes] = useState(false);
  const { animateIncrease } = usePurchaseContext();
  const {
    relationship,
    levelName,
    levelDescription,
    loading: relationshipLoading,
    stages,
    refresh: refreshRelationship,
    getStageRewards,
    isMilestoneClaimed,
    canClaimMilestone,
    claimMilestone,
    claimingMilestone,
  } = useRelationshipDetails(characterId, { enabled: isOpened });
  const currentRelationshipLevel = relationship?.relationshipLevel ?? 0;
  const relationshipLevelName = levelName;
  const relationshipDescription = levelDescription;
  const totalChats = relationship?.totalChats ?? 0;
  const totalVoiceCalls = relationship?.totalVoiceCalls ?? 0;
  const totalVideoCalls = relationship?.totalVideoCalls ?? 0;
  const currentStageKey = relationship?.currentStageKey ?? 'stranger';
  const relationshipPathHistory = relationship?.relationshipPathHistory ?? [];

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.relationship_threshold - b.relationship_threshold),
    [stages]
  );

  const journeyStages = useMemo(() => {
    if (!relationship) {
      return [];
    }
    const visitedKeys = new Set(relationshipPathHistory.map(entry => entry.stage_key));
    if (currentStageKey) {
      visitedKeys.add(currentStageKey);
    }
    return sortedStages.filter(stage => visitedKeys.has(stage.stage_key));
  }, [relationship, relationshipPathHistory, currentStageKey, sortedStages]);

  useEffect(() => {
    if (!isOpened) {
      setRewardModal(null);
    }
  }, [isOpened]);

  const handleClaimStage = useCallback(
    async (stage: RelationshipStage) => {
      const result = await claimMilestone(stage);
      if (result.success) {
        if (result.rewards.vcoin || result.rewards.ruby) {
          animateIncrease({
            vcoin: result.rewards.vcoin,
            ruby: result.rewards.ruby,
          });
        }
        const rewardDescriptors: RewardDescriptor[] = [
          { type: 'vcoin', amount: result.rewards.vcoin },
          { type: 'ruby', amount: result.rewards.ruby },
        ].filter((item): item is RewardDescriptor => item.amount > 0);
        setRewardModal({
          stageName: stage.display_name,
          milestone: stage.relationship_threshold,
          rewards: rewardDescriptors,
        });
      } else if (result.alreadyClaimed) {
        Alert.alert('Đã nhận', 'Bạn đã nhận thưởng milestone này rồi.');
      } else if (result.error) {
        Alert.alert('Không thể nhận thưởng', result.error);
      }
    },
    [claimMilestone, animateIncrease]
  );

  const closeSheet = () => onIsOpenedChange(false);

  const loadCharacter = useCallback(async () => {
    try {
      const characterRepo = new CharacterRepository();
      const loaded = await characterRepo.fetchCharacter(characterId);
      setCharacter(loaded);
    } catch (error) {
      console.warn('[CharacterDetailSheet] Failed to load character', error);
    }
  }, [characterId]);

  const loadCostumes = useCallback(async () => {
    setIsLoadingCostumes(true);
    try {
      const assetRepo = new AssetRepository();
      const owned = await assetRepo.fetchOwnedAssets('character_costume');
      setOwnedCostumeIds(owned);

      const costumeRepo = new CostumeRepository();
      let fetched = await costumeRepo.fetchCostumes(characterId);
      fetched = fetched.filter(c => c.available !== false);

      // Sort: Owned first, then by price
      const sorted = fetched.sort((c1, c2) => {
        const isOwned1 = owned.has(c1.id);
        const isOwned2 = owned.has(c2.id);
        if (isOwned1 !== isOwned2) return isOwned1 ? -1 : 1;
        const price1 = (c1.price_vcoin ?? 0) + (c1.price_ruby ?? 0);
        const price2 = (c2.price_vcoin ?? 0) + (c2.price_ruby ?? 0);
        return price1 - price2;
      });

      setCostumes(sorted);
    } catch (error) {
      console.warn('[CharacterDetailSheet] Failed to load costumes', error);
    } finally {
      setIsLoadingCostumes(false);
    }
  }, [characterId]);

  useEffect(() => {
    if (isOpened) {
      refreshRelationship();
      loadCharacter();
      loadCostumes();
    }
  }, [isOpened, refreshRelationship, loadCharacter, loadCostumes]);

  const relationshipIconName: keyof typeof Ionicons.glyphMap =
    currentRelationshipLevel >= 60 ? 'heart-circle' : 'heart-circle-outline';

  return (
    <>
      <Modal
        visible={isOpened}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={closeSheet}
      >
        <LinearGradient
          style={styles.gradient}
          colors={['#E2005A', '#FF3888', '#FFFFFF']}
          start={{ x: 0.5, y: -0.1 }}
          end={{ x: 0.1, y: 1 }}
        >
          <View style={styles.header}>
            <Pressable style={styles.headerButton} onPress={() => setShowRelationshipTreeInfo(true)}>
              <Ionicons name="information-circle-outline" size={20} color="#fff" />
            </Pressable>

            <View style={styles.tabSelector}>
              <Pressable
                style={[styles.tabButton, selectedTab === 0 && styles.tabButtonActive]}
                onPress={() => setSelectedTab(0)}
              >
                <Text style={[styles.tabText, selectedTab === 0 && styles.tabTextActive]}>
                  Status
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tabButton, selectedTab === 1 && styles.tabButtonActive]}
                onPress={() => setSelectedTab(1)}
              >
                <Text style={[styles.tabText, selectedTab === 1 && styles.tabTextActive]}>
                  Character
                </Text>
              </Pressable>
            </View>

            <Pressable style={styles.headerButton} onPress={closeSheet}>
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>
          </View>

          {selectedTab === 0 ? (
            <RelationshipTab
              characterName={characterName}
              characterAvatarURL={characterAvatarURL}
              currentRelationshipLevel={currentRelationshipLevel}
              relationshipLevelName={relationshipLevelName}
              relationshipDescription={relationshipDescription}
              relationshipIconName={relationshipIconName}
              totalChats={totalChats}
              totalVoiceCalls={totalVoiceCalls}
              totalVideoCalls={totalVideoCalls}
              relationshipLoading={relationshipLoading}
              journeyStages={journeyStages}
              allStages={sortedStages}
              currentStageKey={currentStageKey}
              getStageRewards={getStageRewards}
              isMilestoneClaimed={isMilestoneClaimed}
              canClaimMilestone={canClaimMilestone}
              onClaimMilestone={handleClaimStage}
              claimingMilestone={claimingMilestone}
            />
          ) : (
            <CharacterTab
              characterName={characterName}
              characterAvatarURL={characterAvatarURL}
              character={character}
              characterDescription={characterDescription}
              costumes={costumes}
              ownedCostumeIds={ownedCostumeIds}
              isLoadingCostumes={isLoadingCostumes}
              currentRelationshipLevel={currentRelationshipLevel}
              relationshipLevelName={relationshipLevelName}
              relationshipDescription={relationshipDescription}
              relationshipIconName={relationshipIconName}
              onPurchaseCostume={onPurchaseCostume}
              onSelectCostume={onSelectCostume}
            />
          )}
        </LinearGradient>
      </Modal>

      <RewardClaimModal
        visible={!!rewardModal}
        title="Milestone reward unlocked!"
        subtitle={
          rewardModal ? `You reached level ${rewardModal.milestone} with ${characterName}` : undefined
        }
        rewards={rewardModal?.rewards ?? []}
        onClose={() => setRewardModal(null)}
      />
    </>
  );
};

// Relationship Tab Component
type RelationshipTabProps = {
  characterName: string;
  characterAvatarURL?: string | null;
  currentRelationshipLevel: number;
  relationshipLevelName: string;
  relationshipDescription: string;
  relationshipIconName: IoniconName;
  totalChats: number;
  totalVoiceCalls: number;
  totalVideoCalls: number;
  journeyStages: RelationshipStage[];
  allStages: RelationshipStage[];
  currentStageKey: string;
  relationshipLoading: boolean;
  getStageRewards: (stageKey: string) => StageRewardSummary;
  isMilestoneClaimed: (milestone: number) => boolean;
  canClaimMilestone: (stage: RelationshipStage) => boolean;
  onClaimMilestone: (stage: RelationshipStage) => void;
  claimingMilestone: number | null;
};

const RelationshipTab: React.FC<RelationshipTabProps> = ({
  characterName,
  characterAvatarURL,
  currentRelationshipLevel,
  relationshipLevelName,
  relationshipDescription,
  relationshipIconName,
  totalChats,
  totalVoiceCalls,
  totalVideoCalls,
  journeyStages,
  allStages,
  currentStageKey,
  relationshipLoading,
  getStageRewards,
  isMilestoneClaimed,
  canClaimMilestone,
  onClaimMilestone,
  claimingMilestone,
}) => {
  const progress = Math.min(currentRelationshipLevel / 100, 1);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <CharacterHeader name={characterName} avatarURL={characterAvatarURL} />

      <RelationshipStatusCard
        relationshipLevelName={relationshipLevelName}
        relationshipDescription={relationshipDescription}
        relationshipIconName={relationshipIconName}
      />

      <RelationshipProgressCard currentLevel={currentRelationshipLevel} progress={progress} />

      <InteractionStatsCard
        totalChats={totalChats}
        totalVoiceCalls={totalVoiceCalls}
        totalVideoCalls={totalVideoCalls}
        currentRelationshipLevel={currentRelationshipLevel}
      />

      {relationshipLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#FF247C" />
          <Text style={styles.loadingText}>Loading your journey...</Text>
        </View>
      ) : (
        <>
          <RelationshipSection
            title="Your Journey"
            subtitle={`See how you and ${characterName} are bonding`}
            stages={journeyStages}
            currentRelationshipLevel={currentRelationshipLevel}
            currentStageKey={currentStageKey}
            getStageRewards={getStageRewards}
            isMilestoneClaimed={isMilestoneClaimed}
            canClaimMilestone={canClaimMilestone}
            onClaimMilestone={onClaimMilestone}
            claimingMilestone={claimingMilestone}
          />

          <RelationshipSection
            title="All Stages"
            subtitle="See how you can progress"
            stages={allStages}
            currentRelationshipLevel={currentRelationshipLevel}
            currentStageKey={currentStageKey}
            getStageRewards={getStageRewards}
            isMilestoneClaimed={isMilestoneClaimed}
            canClaimMilestone={canClaimMilestone}
            onClaimMilestone={onClaimMilestone}
            claimingMilestone={claimingMilestone}
          />
        </>
      )}
    </ScrollView>
  );
};

type RelationshipSectionProps = {
  title: string;
  subtitle: string;
  stages: RelationshipStage[];
  currentRelationshipLevel: number;
  currentStageKey: string;
  getStageRewards: (stageKey: string) => StageRewardSummary;
  isMilestoneClaimed: (milestone: number) => boolean;
  canClaimMilestone: (stage: RelationshipStage) => boolean;
  onClaimMilestone: (stage: RelationshipStage) => void;
  claimingMilestone: number | null;
};

const RelationshipSection: React.FC<RelationshipSectionProps> = ({
  title,
  subtitle,
  stages,
  currentRelationshipLevel,
  currentStageKey,
  getStageRewards,
  isMilestoneClaimed,
  canClaimMilestone,
  onClaimMilestone,
  claimingMilestone,
}) => {
  if (!stages.length) {
    return null;
  }

  return (
    <View style={styles.relationshipSection}>
      <View style={styles.relationshipSectionHeader}>
        <Text style={styles.relationshipSectionTitle}>{title}</Text>
        <Text style={styles.relationshipSectionSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.relationshipStageList}>
        {stages.map(stage => (
          <StageCard
            key={stage.stage_key}
            stage={stage}
            currentRelationshipLevel={currentRelationshipLevel}
            currentStageKey={currentStageKey}
            rewards={getStageRewards(stage.stage_key)}
            isClaimed={isMilestoneClaimed(stage.relationship_threshold)}
            canClaim={canClaimMilestone(stage)}
            claiming={claimingMilestone === stage.relationship_threshold}
            onClaim={() => onClaimMilestone(stage)}
          />
        ))}
      </View>
    </View>
  );
};

type StageCardProps = {
  stage: RelationshipStage;
  currentRelationshipLevel: number;
  currentStageKey: string;
  rewards: StageRewardSummary;
  isClaimed: boolean;
  canClaim: boolean;
  claiming: boolean;
  onClaim: () => void;
};

const StageCard: React.FC<StageCardProps> = ({
  stage,
  currentRelationshipLevel,
  currentStageKey,
  rewards,
  isClaimed,
  canClaim,
  claiming,
  onClaim,
}) => {
  const progress = computeStageProgress(stage, currentRelationshipLevel);
  const isCurrent = stage.stage_key === currentStageKey;
  const isReached = currentRelationshipLevel >= stage.relationship_threshold;

  return (
    <View style={styles.stageCard}>
      <View style={styles.stageCardHeader}>
        <View style={styles.stageTitleColumn}>
          <Text style={styles.stageName}>{stage.display_name}</Text>
          <Text style={styles.stageThreshold}>Lvl {stage.relationship_threshold}</Text>
        </View>
        {isCurrent ? <Text style={styles.stageCurrentBadge}>Current path</Text> : null}
      </View>
      {stage.description ? <Text style={styles.stageDescription}>{stage.description}</Text> : null}
      <View style={styles.stageProgressTrack}>
        <View style={[styles.stageProgressFill, { width: `${Math.min(1, progress) * 100}%` }]} />
      </View>
      <View style={styles.stageMetaRow}>
        <StageRewardPills rewards={rewards} />
        {isClaimed ? (
          <View style={styles.stageClaimedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.stageClaimedText}>Claimed</Text>
          </View>
        ) : canClaim ? (
          <Pressable
            style={[styles.stageClaimButton, claiming && styles.stageClaimButtonDisabled]}
            onPress={onClaim}
            disabled={claiming}
          >
            <Text style={styles.stageClaimLabel}>{claiming ? 'Claiming...' : 'Claim reward'}</Text>
          </Pressable>
        ) : (
          <Text style={styles.stageStatusText}>
            {isReached ? 'Reached' : `Need ${stage.relationship_threshold}`}
          </Text>
        )}
      </View>
    </View>
  );
};

const StageRewardPills: React.FC<{ rewards: StageRewardSummary }> = ({ rewards }) => {
  const pills = [
    { label: 'VCoin', amount: rewards.vcoin },
    { label: 'Ruby', amount: rewards.ruby },
    { label: 'XP', amount: rewards.xp },
  ].filter(pill => pill.amount > 0);

  if (!pills.length) {
    return <Text style={styles.stageNoRewards}>No rewards</Text>;
  }

  return (
    <View style={styles.stageRewardsRow}>
      {pills.map(pill => (
        <View key={pill.label} style={styles.rewardPill}>
          <Text style={styles.rewardPillLabel}>{pill.label}</Text>
          <Text style={styles.rewardPillAmount}>+{pill.amount}</Text>
        </View>
      ))}
    </View>
  );
};

const computeStageProgress = (stage: RelationshipStage, currentLevel: number): number => {
  if (stage.relationship_max && currentLevel >= stage.relationship_max) {
    return 1;
  }
  if (currentLevel < stage.relationship_threshold) {
    return 0;
  }
  if (!stage.relationship_max) {
    return 1;
  }
  const span = stage.relationship_max - stage.relationship_threshold;
  if (span <= 0) {
    return 1;
  }
  return Math.min(1, (currentLevel - stage.relationship_threshold) / span);
};

// Character Tab Component
const CharacterTab: React.FC<{
  characterName: string;
  characterAvatarURL?: string | null;
  character: CharacterItem | null;
  characterDescription?: string | null;
  costumes: CostumeItem[];
  ownedCostumeIds: Set<string>;
  isLoadingCostumes: boolean;
  currentRelationshipLevel: number;
  relationshipLevelName: string;
  relationshipDescription: string;
  relationshipIconName: IoniconName;
  onPurchaseCostume?: (costume: CostumeItem) => void;
  onSelectCostume?: (costume: CostumeItem) => void;
}> = ({
  characterName,
  characterAvatarURL,
  character,
  characterDescription,
  costumes,
  ownedCostumeIds,
  isLoadingCostumes,
  currentRelationshipLevel,
  relationshipLevelName,
  relationshipDescription,
  relationshipIconName,
  onPurchaseCostume,
  onSelectCostume,
}) => {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <CharacterHeader name={characterName} avatarURL={characterAvatarURL} />
      
      {character ? (
        <CharacterInfoSection
          character={character}
          characterDescription={characterDescription}
        />
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}
      
      <CostumesSection
        costumes={costumes}
        ownedCostumeIds={ownedCostumeIds}
        isLoading={isLoadingCostumes}
        onPurchaseCostume={onPurchaseCostume}
        onSelectCostume={onSelectCostume}
      />
      
      <RelationshipLevelCard
        relationshipLevelName={relationshipLevelName}
        relationshipDescription={relationshipDescription}
        relationshipIconName={relationshipIconName}
      />
    </ScrollView>
  );
};

// Character Header Component
const CharacterHeader: React.FC<{
  name: string;
  avatarURL?: string | null;
}> = ({ name, avatarURL }) => (
  <View style={styles.characterHeader}>
    {avatarURL ? (
      <ExpoImage
        source={{ uri: avatarURL }}
        style={styles.characterAvatar}
        contentFit="cover"
      />
    ) : (
      <View style={styles.characterAvatarPlaceholder} />
    )}
    <Text style={styles.characterName}>{name || 'Character'}</Text>
  </View>
);

// Relationship Status Card
const RelationshipStatusCard: React.FC<{
  relationshipLevelName: string;
  relationshipDescription: string;
  relationshipIconName: IoniconName;
}> = ({ relationshipLevelName, relationshipDescription, relationshipIconName }) => (
  <View style={styles.card}>
    <View style={styles.cardRow}>
      <View style={styles.iconCircle}>
        <Ionicons name={relationshipIconName} size={28} color="#FF247C" />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{relationshipLevelName}</Text>
        <Text style={styles.cardSubtitle}>Current Relationship Status</Text>
      </View>
    </View>
    <Text style={styles.cardBody}>{relationshipDescription}</Text>
  </View>
);

// Relationship Progress Card
const RelationshipProgressCard: React.FC<{
  currentLevel: number;
  progress: number;
}> = ({ currentLevel, progress }) => {
  const nextMilestone = useMemo(() => {
    const milestones = [10, 25, 40, 50, 60, 75, 90, 100];
    return milestones.find(m => m > currentLevel) || 100;
  }, [currentLevel]);

  const nextMessage = useMemo(() => {
    if (currentLevel >= 100) {
      return "You've reached the highest milestone with this character.";
    }
    return `Reach ${nextMilestone} relationship to hit the next milestone.`;
  }, [currentLevel, nextMilestone]);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Bond Progress</Text>
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{currentLevel} / 100</Text>
      </View>
      <Text style={styles.progressHint}>{nextMessage}</Text>
    </View>
  );
};

// Interaction Stats Card
const InteractionStatsCard: React.FC<{
  totalChats: number;
  totalVoiceCalls: number;
  totalVideoCalls: number;
  currentRelationshipLevel: number;
}> = ({ totalChats, totalVoiceCalls, totalVideoCalls, currentRelationshipLevel }) => (
  <View style={styles.card}>
    <Text style={styles.sectionTitle}>Interaction Statistics</Text>
    <View style={styles.statsGrid}>
      <StatMetricCard icon="chatbubble-ellipses" title="Chats" value={`${totalChats}`} />
      <StatMetricCard icon="mic" title="Voice Calls" value={`${totalVoiceCalls}`} />
      <StatMetricCard icon="videocam" title="Video Calls" value={`${totalVideoCalls}`} />
      <StatMetricCard icon="heart" title="Relationship" value={`${currentRelationshipLevel}/100`} />
    </View>
  </View>
);

// Stat Metric Card
const StatMetricCard: React.FC<{
  icon: string;
  title: string;
  value: string;
}> = ({ icon, title, value }) => (
  <View style={styles.statCard}>
    <Ionicons name={icon as any} size={20} color="#FF247C" />
    <Text style={styles.statTitle}>{title}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

// Character Info Section
const CharacterInfoSection: React.FC<{
  character: CharacterItem;
  characterDescription?: string | null;
}> = ({ character, characterDescription }) => (
  <View style={styles.card}>
    <Text style={styles.sectionTitle}>Character Information</Text>
    
    {characterDescription ? (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>About</Text>
        <Text style={styles.infoValue}>{characterDescription}</Text>
      </View>
    ) : null}
    
    <View style={styles.infoSection}>
      {character.tier ? (
        <InfoRow label="Tier" value={character.tier.charAt(0).toUpperCase() + character.tier.slice(1)} />
      ) : null}
      {character.price_vcoin && character.price_vcoin > 0 ? (
        <InfoRow label="Price (VCoin)" value={`${character.price_vcoin}`} />
      ) : null}
      {character.price_ruby && character.price_ruby > 0 ? (
        <InfoRow label="Price (Ruby)" value={`${character.price_ruby}`} />
      ) : null}
      <InfoRow label="Available" value={character.available !== false ? 'Yes' : 'No'} />
    </View>
  </View>
);

// Info Row Component
const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

// Costumes Section
const CostumesSection: React.FC<{
  costumes: CostumeItem[];
  ownedCostumeIds: Set<string>;
  isLoading: boolean;
  onPurchaseCostume?: (costume: CostumeItem) => void;
  onSelectCostume?: (costume: CostumeItem) => void;
}> = ({ costumes, ownedCostumeIds, isLoading, onPurchaseCostume, onSelectCostume }) => {
  if (isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Costumes</Text>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (costumes.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Costumes</Text>
        <Text style={styles.emptyText}>No costumes available</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Costumes</Text>
      <View style={styles.costumesGrid}>
        {costumes.map(costume => {
          const isOwned = ownedCostumeIds.has(costume.id);
          return (
            <Pressable
              key={costume.id}
              style={styles.costumeCard}
              onPress={() => {
                if (isOwned) {
                  onSelectCostume?.(costume);
                } else {
                  onPurchaseCostume?.(costume);
                }
              }}
            >
              <View style={[styles.costumeImageContainer, !isOwned && styles.costumeLocked]}>
                {costume.thumbnail ? (
                  <ExpoImage
                    source={{ uri: costume.thumbnail }}
                    style={styles.costumeImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.costumeImagePlaceholder} />
                )}
                {!isOwned && (
                  <View style={styles.lockOverlay}>
                    <Ionicons name="lock-closed" size={24} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={styles.costumeName} numberOfLines={1}>
                {costume.costume_name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

// Relationship Level Card
const RelationshipLevelCard: React.FC<{
  relationshipLevelName: string;
  relationshipDescription: string;
  relationshipIconName: IoniconName;
}> = ({ relationshipLevelName, relationshipDescription, relationshipIconName }) => (
  <View style={styles.card}>
    <View style={styles.cardRow}>
      <View style={styles.iconCircleLarge}>
        <Ionicons name={relationshipIconName} size={32} color="#FF247C" />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitleLarge}>{relationshipLevelName}</Text>
        <Text style={styles.cardSubtitle}>Current Relationship</Text>
      </View>
    </View>
    <Text style={styles.cardBody}>{relationshipDescription}</Text>
  </View>
);

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 2,
  },
  tabButton: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  tabText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  relationshipSection: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  relationshipSectionHeader: {
    gap: 4,
  },
  relationshipSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  relationshipSectionSubtitle: {
    fontSize: 13,
    color: 'rgba(17,17,17,0.6)',
  },
  relationshipStageList: {
    gap: 12,
  },
  stageCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.08)',
    padding: 16,
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  stageCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stageTitleColumn: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  stageName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  stageThreshold: {
    fontSize: 13,
    color: 'rgba(17,17,17,0.6)',
  },
  stageDescription: {
    fontSize: 13,
    color: 'rgba(17,17,17,0.7)',
    lineHeight: 18,
  },
  stageProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(17,17,17,0.08)',
    overflow: 'hidden',
  },
  stageProgressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#FF247C',
  },
  stageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  stageRewardsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,36,124,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,36,124,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  cardTitleLarge: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.6)',
    marginTop: 4,
  },
  cardBody: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.7)',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  characterHeader: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  characterAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  characterAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  characterName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  progressContainer: {
    gap: 8,
  },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF247C',
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.6)',
  },
  progressHint: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.7)',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
  },
  statTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.7)',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  rewardPill: {
    backgroundColor: 'rgba(255,36,124,0.08)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rewardPillLabel: {
    fontSize: 12,
    color: 'rgba(17,17,17,0.65)',
  },
  rewardPillAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
  },
  stageClaimButton: {
    backgroundColor: '#FF247C',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  stageClaimButtonDisabled: {
    opacity: 0.6,
  },
  stageClaimLabel: {
    color: '#fff',
    fontWeight: '700',
  },
  stageStatusText: {
    fontSize: 12,
    color: 'rgba(17,17,17,0.55)',
  },
  stageClaimedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(42,199,111,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  stageClaimedText: {
    color: '#1C6C46',
    fontWeight: '600',
    fontSize: 12,
  },
  stageCurrentBadge: {
    fontSize: 12,
    color: '#FF247C',
    fontWeight: '600',
  },
  stageNoRewards: {
    fontSize: 12,
    color: 'rgba(17,17,17,0.45)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.6)',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  infoSection: {
    gap: 8,
    marginTop: 12,
  },
  costumesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  costumeCard: {
    width: '30%',
    gap: 8,
  },
  costumeImageContainer: {
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  costumeLocked: {
    opacity: 0.6,
  },
  costumeImage: {
    width: '100%',
    height: '100%',
  },
  costumeImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  costumeName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111',
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.6)',
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.6)',
    textAlign: 'center',
    padding: 20,
  },
});

