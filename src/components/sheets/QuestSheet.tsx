import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  Image,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import Button from '../Button';
import type { QuestReward } from '../../services/QuestService';
import type {
  UserDailyQuest,
  UserLevelQuest,
} from '../../repositories/QuestRepository';
import { usePurchaseContext } from '../../context/PurchaseContext';

const VCOIN_ICON = require('../../assets/images/VCoin.png');
const RUBY_ICON = require('../../assets/images/Ruby.png');

type QuestSheetProps = {
  isOpened: boolean;
  onIsOpenedChange: (isOpened: boolean) => void;
  dailyState: {
    visibleQuests: UserDailyQuest[];
    loading: boolean;
    error: string | null;
    refreshing: boolean;
    completedCount: number;
    totalCount: number;
  };
  levelState: {
    quests: UserLevelQuest[];
    loading: boolean;
    error: string | null;
  };
  onRefreshDaily: () => Promise<void>;
  onClaimDaily: (
    questId: string
  ) => Promise<{ quest: UserDailyQuest; reward: QuestReward }>;
  onClaimLevel: (
    questId: string
  ) => Promise<{ quest: UserLevelQuest; reward: QuestReward }>;
};

type TabKey = 'daily' | 'level';

export const QuestSheet: React.FC<QuestSheetProps> = ({
  isOpened,
  onIsOpenedChange,
  dailyState,
  levelState,
  onRefreshDaily,
  onClaimDaily,
  onClaimLevel,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('daily');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [levelClaimingId, setLevelClaimingId] = useState<string | null>(null);
  const { animateIncrease, refresh } = usePurchaseContext();

  const groupedLevelQuests = useMemo(() => {
    const groups = new Map<number, UserLevelQuest[]>();
    levelState.quests.forEach((quest) => {
      const level = quest.quest?.level_required ?? 0;
      const current = groups.get(level) ?? [];
      current.push(quest);
      groups.set(level, current);
    });
    return Array.from(groups.entries()).sort((a, b) => b[0] - a[0]);
  }, [levelState.quests]);

  const handleRefreshDaily = useCallback(() => {
    Alert.alert(
      'Refresh Daily Quests',
      'Làm mới sẽ tạo 6 nhiệm vụ mới và chi phí 50 Ruby hoặc 500 VCoin. Bạn có chắc không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Refresh',
          style: 'default',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onRefreshDaily().catch((error) => {
              const message =
                error instanceof Error ? error.message : 'Không thể làm mới quest';
              Alert.alert('Refresh thất bại', message);
            });
          },
        },
      ]
    );
  }, [onRefreshDaily]);

  const handleDailyClaim = useCallback(
    async (questId: string) => {
      try {
        setClaimingId(questId);
        const result = await onClaimDaily(questId);
        if (result.reward.vcoin || result.reward.ruby) {
          animateIncrease({
            vcoin: result.reward.vcoin ?? 0,
            ruby: result.reward.ruby ?? 0,
          });
        }
        await refresh();
        Alert.alert('Hoàn thành nhiệm vụ', 'Bạn đã nhận thưởng thành công!');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể nhận thưởng';
        Alert.alert('Claim thất bại', message);
      } finally {
        setClaimingId(null);
      }
    },
    [animateIncrease, onClaimDaily, refresh]
  );

  const handleLevelClaim = useCallback(
    async (questId: string) => {
      try {
        setLevelClaimingId(questId);
        const result = await onClaimLevel(questId);
        if (result.reward.vcoin || result.reward.ruby) {
          animateIncrease({
            vcoin: result.reward.vcoin ?? 0,
            ruby: result.reward.ruby ?? 0,
          });
        }
        await refresh();
        Alert.alert('Hoàn thành nhiệm vụ cấp độ', 'Bạn đã nhận thưởng thành công!');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể nhận thưởng';
        Alert.alert('Claim thất bại', message);
      } finally {
        setLevelClaimingId(null);
      }
    },
    [animateIncrease, onClaimLevel, refresh]
  );

  const renderDailyTab = () => {
    if (dailyState.loading) {
      return (
        <View style={styles.skeletonContainer}>
          {Array.from({ length: 4 }).map((_, index) => (
            <QuestCardSkeleton key={`skeleton-${index}`} />
          ))}
        </View>
      );
    }

    if (dailyState.error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>Không thể tải daily quests</Text>
          <Text style={styles.errorMessage}>{dailyState.error}</Text>
          <Button size="md" variant="solid" onPress={onRefreshDaily}>
            Thử lại
          </Button>
        </View>
      );
    }

    if (dailyState.visibleQuests.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>Không có nhiệm vụ</Text>
          <Text style={styles.emptySubTitle}>Nhấn Refresh để tạo nhiệm vụ mới</Text>
          <Button size="md" variant="solid" onPress={handleRefreshDaily}>
            Refresh
          </Button>
        </View>
      );
    }

    return (
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={dailyState.refreshing} onRefresh={onRefreshDaily} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>
          {dailyState.completedCount}/{dailyState.totalCount} completed
        </Text>
        {dailyState.visibleQuests.map((quest) => (
          <QuestCard
            key={quest.id}
            quest={quest}
            claiming={claimingId === quest.id}
            onClaim={() => handleDailyClaim(quest.id)}
          />
        ))}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    );
  };

  const renderLevelTab = () => {
    if (levelState.loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#fff" />
        </View>
      );
    }

    if (levelState.error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>Không thể tải level quests</Text>
          <Text style={styles.errorMessage}>{levelState.error}</Text>
        </View>
      );
    }

    if (!levelState.quests.length) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>Chưa có level quest</Text>
          <Text style={styles.emptySubTitle}>Tăng cấp để mở khóa nhiệm vụ mới!</Text>
        </View>
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {groupedLevelQuests.map(([level, quests]) => {
          const visible = quests.filter((quest) => !(quest.completed && quest.claimed));
          if (!visible.length) {
            return null;
          }
          const completed = visible.filter((quest) => quest.completed).length;
          return (
            <View key={`level-${level}`} style={styles.levelGroup}>
              <View style={styles.levelHeader}>
                <Text style={styles.levelTitle}>Level {level} quests</Text>
                <Text style={styles.levelProgress}>
                  {completed}/{visible.length}
                </Text>
              </View>
              {visible.map((quest) => (
                <LevelQuestCard
                  key={quest.id}
                  quest={quest}
                  claiming={levelClaimingId === quest.id}
                  onClaim={() => handleLevelClaim(quest.id)}
                />
              ))}
            </View>
          );
        })}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={isOpened}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => onIsOpenedChange(false)}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Button
            size='md'
            variant='liquid'
            onPress={handleRefreshDaily}
            startIconName='refresh'
            isIconOnly
          />
          <View style={styles.tabSwitcher}>
            <Pressable
              onPress={() => setActiveTab('daily')}
              style={[styles.tabButton, activeTab === 'daily' && styles.tabButtonActive]}
            >
              <Text style={[styles.tabLabel, activeTab === 'daily' && styles.tabLabelActive]}>
                Daily
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('level')}
              style={[styles.tabButton, activeTab === 'level' && styles.tabButtonActive]}
            >
              <Text style={[styles.tabLabel, activeTab === 'level' && styles.tabLabelActive]}>
                Level
              </Text>
            </Pressable>
          </View>
          <Button
            size='md'
            variant='liquid'
            onPress={() => onIsOpenedChange(false)}
            startIconName='close'
            isIconOnly
          />
        </View>
        <View style={styles.content}>
          {activeTab === 'daily' ? renderDailyTab() : renderLevelTab()}
        </View>
      </View>
    </Modal>
  );
};

type QuestCardProps = {
  quest: UserDailyQuest;
  claiming: boolean;
  onClaim: () => void;
};

const QuestCard: React.FC<QuestCardProps> = ({ quest, claiming, onClaim }) => {
  const questData = quest.quest;
  const progressTarget = questData?.target_value ?? 1;
  const progressRatio = Math.min(1, quest.progress / Math.max(1, progressTarget));
  const claimable = quest.completed && !quest.claimed;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>{questData?.description ?? 'Quest'}</Text>
          {questData?.quest_category ? (
            <Text style={styles.cardSubtitle}>{questData.quest_category}</Text>
          ) : null}
        </View>
        <View style={styles.difficultyBadge}>
          <Text style={styles.difficultyText}>{questData?.difficulty ?? '—'}</Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
      </View>
      <View style={styles.progressLabels}>
        <Text style={styles.progressLabel}>
          {quest.progress}/{progressTarget}
        </Text>
        <Text style={styles.progressStatus}>
          {quest.claimed ? 'Claimed' : quest.completed ? 'Reward ready' : 'In progress'}
        </Text>
      </View>

      <RewardRow
        vcoin={questData?.reward_vcoin ?? 0}
        ruby={questData?.reward_ruby ?? 0}
        xp={questData?.reward_xp ?? 0}
      />

      <Button
        size='md'
        variant={claimable ? 'solid' : 'ghost'}
        onPress={onClaim}
        disabled={!claimable || claiming}
        style={styles.claimButton}
      >
        {claiming ? 'Claiming…' : claimable ? 'Claim reward' : 'Keep going'}
      </Button>
    </View>
  );
};

type LevelQuestCardProps = {
  quest: UserLevelQuest;
  claiming: boolean;
  onClaim: () => void;
};

const LevelQuestCard: React.FC<LevelQuestCardProps> = ({ quest, claiming, onClaim }) => {
  const questData = quest.quest;
  const target = questData?.target_value ?? 1;
  const ratio = Math.min(1, quest.progress / Math.max(1, target));
  const claimable = quest.completed && !quest.claimed;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>{questData?.description ?? 'Quest'}</Text>
          <Text style={styles.cardSubtitle}>
            {questData?.quest_category ?? questData?.quest_type ?? 'Quest'}
          </Text>
        </View>
        <View style={styles.difficultyBadge}>
          <Text style={styles.difficultyText}>{questData?.difficulty ?? '—'}</Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
      </View>
      <View style={styles.progressLabels}>
        <Text style={styles.progressLabel}>
          {quest.progress}/{target}
        </Text>
        <Text style={styles.progressStatus}>
          {quest.claimed ? 'Claimed' : quest.completed ? 'Reward ready' : 'In progress'}
        </Text>
      </View>

      <RewardRow
        vcoin={questData?.reward_vcoin ?? 0}
        ruby={questData?.reward_ruby ?? 0}
        xp={questData?.reward_xp ?? 0}
      />

      <Button
        size='md'
        variant={claimable ? 'solid' : 'ghost'}
        onPress={onClaim}
        disabled={!claimable || claiming}
        style={styles.claimButton}
      >
        {claiming ? 'Claiming…' : claimable ? 'Claim reward' : 'Keep going'}
      </Button>
    </View>
  );
};

const RewardRow: React.FC<{ vcoin: number; ruby: number; xp: number }> = ({ vcoin, ruby, xp }) => {
  const rewards = [
    { label: 'VCoin', value: vcoin, icon: VCOIN_ICON },
    { label: 'Ruby', value: ruby, icon: RUBY_ICON },
    { label: 'XP', value: xp, iconName: 'star' as const },
  ].filter((reward) => reward.value > 0);

  if (!rewards.length) {
    return null;
  }

  return (
    <View style={styles.rewardRow}>
      {rewards.map((reward) => (
        <View key={reward.label} style={styles.rewardChip}>
          {reward.icon ? (
            <Image source={reward.icon} style={styles.rewardImage} />
          ) : (
            <Ionicons name={reward.iconName!} size={16} color="#FFD166" />
          )}
          <Text style={styles.rewardLabel}>
            +{reward.value} {reward.label}
          </Text>
        </View>
      ))}
    </View>
  );
};

const QuestCardSkeleton = () => (
  <View style={styles.card}>
    <View style={styles.skeletonLineLarge} />
    <View style={styles.skeletonLine} />
    <View style={[styles.skeletonLine, { width: '60%' }]} />
    <View style={styles.progressBar}>
      <View style={[styles.progressFill, { width: '30%', opacity: 0.3 }]} />
    </View>
    <View style={[styles.skeletonLine, { width: '40%' }]} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    columnGap: 16,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    padding: 4,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  tabButtonActive: {
    backgroundColor: '#fff',
  },
  tabLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  difficultyText: {
    color: '#fff',
    fontSize: 12,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7C5CFF',
  },
  progressLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressLabel: {
    color: '#fff',
    fontSize: 12,
  },
  progressStatus: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  rewardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rewardImage: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
  rewardLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  claimButton: {
    marginTop: 12,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorMessage: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  skeletonContainer: {
    gap: 12,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    marginBottom: 8,
  },
  skeletonLineLarge: {
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    marginBottom: 12,
  },
  levelGroup: {
    marginBottom: 20,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  levelTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  levelProgress: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  bottomSpacer: {
    height: 120,
  },
});


