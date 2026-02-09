import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
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
  Animated,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../commons/Button';
import type { QuestReward } from '../../services/QuestService';
import type {
  UserDailyQuest,
  UserLevelQuest,
} from '../../repositories/QuestRepository';
import { usePurchaseContext } from '../../context/PurchaseContext';

const VCOIN_ICON = require('../../assets/images/VCoin.png');
const RUBY_ICON = require('../../assets/images/Ruby.png');

type TabKey = 'daily' | 'level';

type TabRequest = {
  tab: TabKey;
  token: number;
};

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
  level: number;
  xp: number;
  nextLevelXp: number;
  initialTabRequest?: TabRequest | null;
  onRefreshLoginRewards?: () => void;
};

export const QuestSheet: React.FC<QuestSheetProps> = ({
  isOpened,
  onIsOpenedChange,
  dailyState,
  levelState,
  onRefreshDaily,
  onClaimDaily,
  onClaimLevel,
  level,
  xp,
  nextLevelXp,
  initialTabRequest,
  onRefreshLoginRewards,
}) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>('daily');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [levelClaimingId, setLevelClaimingId] = useState<string | null>(null);
  const { animateIncrease, refresh } = usePurchaseContext();

  useEffect(() => {
    if (!isOpened || !initialTabRequest) {
      return;
    }
    setActiveTab(initialTabRequest.tab);
  }, [initialTabRequest?.token, initialTabRequest?.tab, isOpened]);

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

  const sortLevelQuestsByCompletion = useCallback((quests: UserLevelQuest[]) => {
    const completed = quests.filter((q) => q.completed);
    const inProgress = quests.filter((q) => !q.completed);
    return [...completed, ...inProgress];
  }, []);

  const handleRefreshDaily = useCallback(() => {
    const refreshEnergyCost = 50;
    Alert.alert(
      'Refresh Daily Quests',
      `Refreshing will generate new daily quests and will cost ${refreshEnergyCost} Energy.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refresh',
          style: 'default',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
            onRefreshDaily().catch((error) => {
              const message =
                error instanceof Error ? error.message : 'Failed to refresh quests';
              Alert.alert('Refresh Failed', message);
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
        // RewardClaimOverlay will be shown by App.tsx
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
        // RewardClaimOverlay will be shown by App.tsx
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
    const completed = dailyState.visibleQuests.filter((q) => q.completed);
    const inProgress = dailyState.visibleQuests.filter((q) => !q.completed);
    const sortedQuests = [...completed, ...inProgress];
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.dailyTabContent}>

          {/* Daily Tasks Section */}
          <View style={styles.dailyTasksSection}>
            {dailyState.loading && dailyState.visibleQuests.length === 0 ? (
              <View style={styles.dailyTasksSkeleton}>
                <View style={styles.dailyTasksHeader}>
                  <View style={styles.dailyTasksHeaderSkeleton} />
                  <View style={styles.dailyTasksCountdownSkeleton} />
                </View>
                {[0, 1, 2, 3].map((i) => (
                  <QuestCardSkeleton key={i} />
                ))}
              </View>
            ) : (
              <>
                <View style={styles.dailyTasksHeader}>
                  <Text style={styles.dailyTasksTitle}>Daily Tasks</Text>
                  <DailyTasksCountdownView />
                </View>

                {dailyState.visibleQuests.length === 0 ? (
                  <View style={styles.dailyTasksEmptyState}>
                    <Text style={styles.dailyTasksEmptyTitle}>No quests available</Text>
                    <Button size="md" variant="solid" onPress={handleRefreshDaily}>
                      Generate Quests
                    </Button>
                  </View>
                ) : (
                  <View style={styles.dailyTasksList}>
                    {sortedQuests.map((quest) => (
                      <QuestCard
                        key={quest.id}
                        quest={quest}
                        claiming={claimingId === quest.id}
                        onClaim={() => handleDailyClaim(quest.id)}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        </View>
        <View style={styles.dailyRefreshButtonContainer}>
          <Pressable
            style={styles.dailyRefreshButton}
            onPress={handleRefreshDaily}
            disabled={dailyState.refreshing}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.dailyRefreshButtonText}>Refresh Daily Quests</Text>
          </Pressable>
        </View>
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
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.levelTabContent}>
            <CurrentLevelSection level={level} xp={xp} nextLevelXp={nextLevelXp} />
            <View style={styles.centerContainer}>
              <Text style={styles.errorTitle}>Không thể tải level quests</Text>
              <Text style={styles.errorMessage}>{levelState.error}</Text>
            </View>
          </View>
        </ScrollView>
      );
    }

    if (!levelState.quests.length) {
      return (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.levelTabContent}>
            <CurrentLevelSection level={level} xp={xp} nextLevelXp={nextLevelXp} />
            <View style={styles.centerContainer}>
              <Text style={styles.emptyTitle}>No level quests available</Text>
              <Text style={styles.emptySubTitle}>Complete levels to unlock new quests!</Text>
            </View>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.levelTabContent}>
          {/* Current Level Section */}
          <CurrentLevelSection level={level} xp={xp} nextLevelXp={nextLevelXp} />

          {groupedLevelQuests.map(([levelNum, quests]) => {
            const visible = quests.filter((quest) => !(quest.completed && quest.claimed));
            if (!visible.length) {
              return null;
            }
            const sortedQuests = sortLevelQuestsByCompletion(visible);
            const completed = visible.filter((quest) => quest.completed).length;
            return (
              <View key={`level-${levelNum}`} style={styles.levelGroup}>
                <View style={styles.levelHeader}>
                  <Text style={styles.levelTitle}>Level {levelNum} Quests</Text>
                  <Text style={styles.levelProgress}>
                    {completed}/{visible.length}
                  </Text>
                </View>
                {sortedQuests.map((quest) => (
                  <View key={quest.id} style={styles.levelQuestWrapper}>
                    <LevelQuestCard
                      quest={quest}
                      claiming={levelClaimingId === quest.id}
                      onClaim={() => handleLevelClaim(quest.id)}
                    />
                  </View>
                ))}
              </View>
            );
          })}
        </View>
        <View style={styles.bottomSpacer} />
      </ScrollView>
    );
  };

  const content = activeTab === 'daily' ? renderDailyTab() : renderLevelTab();

  return (
    <Modal
      visible={isOpened}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => onIsOpenedChange(false)}
    >
      <LinearGradient
        style={[
          styles.gradient,
          { paddingTop: 24 },
        ]}
        colors={['#E2005A', '#FF3888', '#FFFFFF']}
        start={{ x: 0.5, y: -0.1 }}
        end={{ x: 0.1, y: 1 }}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={handleRefreshDaily}>
            <Ionicons name="refresh" size={18} color="#fff" />
          </Pressable>
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
          <Pressable style={styles.iconButton} onPress={() => onIsOpenedChange(false)}>
            <Ionicons name="close" size={18} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.contentWrapper}>{content}</View>
      </LinearGradient>
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
  const isCompleted = quest.completed;
  const isClaimed = quest.claimed;

  const textColor = isCompleted ? '#FFFFFF' : '#000000';
  const progressTextColor = isCompleted ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.7)';
  const progressTrackColor = isCompleted ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.7)';
  const progressFillColor = isCompleted ? '#FFFFFF' : '#FF247C';
  const progressDescription = isCompleted ? 'Completed!' : `${quest.progress}/${progressTarget}`;

  return (
    <View
      style={[
        styles.dailyQuestCard,
        isCompleted && styles.dailyQuestCardCompleted,
      ]}
    >
      {isCompleted && (
        <LinearGradient
          colors={['#FF3B8A', '#E20E62']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={styles.dailyQuestCardContent}>
        {/* Quest Title & Status */}
        <View style={styles.dailyQuestHeader}>
          <Text
            style={[
              styles.dailyQuestTitle,
              { color: textColor },
            ]}
            numberOfLines={2}
          >
            {questData?.description ?? 'Unknown Quest'}
          </Text>
          {isCompleted && (
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          )}
        </View>

        {/* Progress Bar */}
        {questData && (
          <View style={styles.dailyQuestProgressContainer}>
            <View
              style={[
                styles.dailyQuestProgressBar,
                { backgroundColor: progressTrackColor },
              ]}
            >
              <View
                style={[
                  styles.dailyQuestProgressFill,
                  {
                    width: `${progressRatio * 100}%`,
                    backgroundColor: progressFillColor,
                  },
                ]}
              />
            </View>
            <View style={styles.dailyQuestProgressRow}>
              <Text
                style={[
                  styles.dailyQuestProgressText,
                  { color: progressTextColor },
                ]}
              >
                {progressDescription}
              </Text>
              <RewardRow
                vcoin={questData.reward_vcoin ?? 0}
                ruby={questData.reward_ruby ?? 0}
                xp={questData.reward_xp ?? 0}
                textColor={textColor}
                backgroundColor={isCompleted ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.7)'}
              />
            </View>
          </View>
        )}

        {/* Claim Button */}
        {isCompleted && !isClaimed && (
          <Pressable
            onPress={onClaim}
            disabled={claiming}
            style={styles.dailyQuestClaimButton}
          >
            <Text style={styles.dailyQuestClaimButtonText}>
              {claiming ? 'Claiming…' : 'Claim Reward'}
            </Text>
          </Pressable>
        )}
        {isClaimed && (
          <View style={styles.dailyQuestClaimedContainer}>
            <Text style={styles.dailyQuestClaimedText}>Claimed ✓</Text>
          </View>
        )}
      </View>
      {isCompleted && (
        <View style={styles.dailyQuestCardBorder} />
      )}
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
  const isCompleted = quest.completed;
  const isClaimed = quest.claimed;

  const textColor = isCompleted ? '#FFFFFF' : '#000000';
  const progressTextColor = isCompleted ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.7)';
  const progressTrackColor = isCompleted ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.7)';
  const progressFillColor = isCompleted ? '#FFFFFF' : '#FF247C';
  const progressDescription = isCompleted ? 'Completed!' : `${quest.progress}/${target}`;

  return (
    <View
      style={[
        styles.levelQuestCard,
        isCompleted && styles.levelQuestCardCompleted,
      ]}
    >
      {isCompleted && (
        <LinearGradient
          colors={['#FF3B8A', '#E20E62']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={styles.levelQuestCardContent}>
        {/* Quest Title & Status */}
        <View style={styles.levelQuestHeader}>
          <Text
            style={[
              styles.levelQuestTitle,
              { color: textColor },
            ]}
            numberOfLines={2}
          >
            {questData?.description ?? 'Unknown Quest'}
          </Text>
          {isCompleted && (
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          )}
        </View>

        {/* Progress Bar */}
        {questData && (
          <View style={styles.levelQuestProgressContainer}>
            <View
              style={[
                styles.levelQuestProgressBar,
                { backgroundColor: progressTrackColor },
              ]}
            >
              <View
                style={[
                  styles.levelQuestProgressFill,
                  {
                    width: `${ratio * 100}%`,
                    backgroundColor: progressFillColor,
                  },
                ]}
              />
            </View>
            <View style={styles.levelQuestProgressRow}>
              <Text
                style={[
                  styles.levelQuestProgressText,
                  { color: progressTextColor },
                ]}
              >
                {progressDescription}
              </Text>
              <RewardRow
                vcoin={questData.reward_vcoin ?? 0}
                ruby={questData.reward_ruby ?? 0}
                xp={questData.reward_xp ?? 0}
                textColor={textColor}
                backgroundColor={isCompleted ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.7)'}
              />
            </View>
          </View>
        )}

        {/* Action Button */}
        {claimable && (
          <Pressable
            onPress={onClaim}
            disabled={claiming}
            style={styles.levelQuestClaimButton}
          >
            <Text style={styles.levelQuestClaimButtonText}>
              {claiming ? 'Claiming…' : 'Claim Reward'}
            </Text>
          </Pressable>
        )}
        {isClaimed && (
          <View style={styles.levelQuestClaimedContainer}>
            <Text style={styles.levelQuestClaimedText}>Reward Claimed</Text>
            <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
          </View>
        )}
      </View>
      {isCompleted && (
        <View style={styles.levelQuestCardBorder} />
      )}
    </View>
  );
};

const RewardRow: React.FC<{
  vcoin: number;
  ruby: number;
  xp: number;
  textColor?: string;
  backgroundColor?: string;
}> = ({ vcoin, ruby, xp, textColor = '#000000', backgroundColor = 'rgba(255, 255, 255, 0.7)' }) => {
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
        <View
          key={reward.label}
          style={[
            styles.rewardChip,
            { backgroundColor },
          ]}
        >
          {reward.icon ? (
            <Image source={reward.icon} style={styles.rewardImage} />
          ) : (
            <Ionicons name={reward.iconName!} size={16} color="#FFD166" />
          )}
          <Text style={[styles.rewardLabel, { color: textColor }]}>
            +{reward.value} {reward.label}
          </Text>
        </View>
      ))}
    </View>
  );
};

const DailyTasksCountdownView: React.FC = () => {
  const [timeRemaining, setTimeRemaining] = useState('00:00:00');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const timeInterval = tomorrow.getTime() - now.getTime();

      if (timeInterval <= 0) {
        setTimeRemaining('00:00:00');
        return;
      }

      const hours = Math.floor(timeInterval / (1000 * 60 * 60));
      const minutes = Math.floor((timeInterval % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeInterval % (1000 * 60)) / 1000);

      setTimeRemaining(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <Text style={styles.dailyTasksCountdown}>Reset in {timeRemaining}</Text>
  );
};

type WeekDay = {
  id: number;
  date: Date;
  dateString: string;
  isToday: boolean;
  isCheckedIn: boolean;
  canClaim: boolean;
  isClaimed: boolean;
  monthText: string;
  dayText: string;
};

const WeeklyCheckinSection: React.FC<{
  onRefreshLoginRewards?: () => void;
}> = ({ onRefreshLoginRewards }) => {
  const [weekDays, setWeekDays] = React.useState<WeekDay[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [canClaimToday, setCanClaimToday] = React.useState(false);
  const [hasClaimedToday, setHasClaimedToday] = React.useState(false);

  const loadWeekData = useCallback(async () => {
    try {
      setLoading(true);
      const { LoginRewardService } = await import('../../services/LoginRewardService');
      const service = new LoginRewardService();
      const { state } = await service.hydrate();
      const status = state;

      setCanClaimToday(status.canClaimToday);
      setHasClaimedToday(status.hasClaimedToday);

      const calendar = new Date();
      const now = new Date();
      const weekday = now.getDay(); // 0 (Sun) - 6 (Sat)
      const daysFromMonday = (weekday + 6) % 7; // Monday = 0
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - daysFromMonday);

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const todayString = formatDate(now);
      const lastClaimDate = status.record.last_claim_date ?? null;

      const days: WeekDay[] = [];
      for (let i = 0; i < 7; i += 1) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const isToday = formatDate(date) === todayString;
        const dateString = formatDate(date);
        const isCheckedIn = lastClaimDate === dateString;
        const canClaim = isToday && status.canClaimToday;
        const isClaimed = isToday && status.hasClaimedToday;
        const finalIsCheckedIn = isCheckedIn || (isToday && isClaimed);

        const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
        const monthText = monthFormatter.format(date);
        const dayText = `${date.getDate()}`;

        days.push({
          id: i,
          date,
          dateString,
          isToday,
          isCheckedIn: finalIsCheckedIn,
          canClaim,
          isClaimed,
          monthText,
          dayText,
        });
      }

      setWeekDays(days);
    } catch (error) {
      console.warn('[WeeklyCheckinSection] Failed to load week data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeekData();
  }, [loadWeekData]);

  const subtitle = useMemo(() => {
    if (canClaimToday && !hasClaimedToday) {
      return 'Ready to claim rewards';
    }
    return 'Rewards claimed';
  }, [canClaimToday, hasClaimedToday]);

  const handleClaimToday = useCallback(async () => {
    try {
      const { LoginRewardService } = await import('../../services/LoginRewardService');
      const service = new LoginRewardService();
      const { rewards, state } = await service.hydrate();
      const result = await service.claimTodayReward({ record: state.record, rewards });
      if (result?.updatedRecord) {
        setHasClaimedToday(true);
        setCanClaimToday(false);
        await loadWeekData();
        onRefreshLoginRewards?.();
      }
    } catch (error) {
      console.warn('[WeeklyCheckinSection] Failed to claim today reward:', error);
    }
  }, [loadWeekData, onRefreshLoginRewards]);

  const isSkeleton = loading || weekDays.length === 0;

  return (
    <View style={styles.dailyCheckInSection}>
      <View style={{ alignItems: 'center', gap: 16 }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={styles.weeklyTitle}>Weekly Checkin</Text>
          {isSkeleton ? (
            <View style={styles.weeklySubtitleSkeleton} />
          ) : (
            <Text style={styles.weeklySubtitle}>{subtitle}</Text>
          )}
        </View>
        {isSkeleton ? (
          <View style={styles.weeklyDaysSkeletonRow}>
            {Array.from({ length: 7 }).map((_, idx) => (
              <View key={idx} style={styles.weeklyDaySkeletonCircle} />
            ))}
          </View>
        ) : (
          <View style={styles.weeklyDaysRow}>
            {weekDays.map(day => (
              <View key={day.id} style={styles.weeklyDayContainer}>
                {day.isToday && !day.isCheckedIn ? (
                  <Pressable
                    onPress={day.canClaim && !day.isClaimed ? handleClaimToday : undefined}
                    style={styles.weeklyDayTodayCircle}
                  >
                    <View style={styles.weeklyDayInner}>
                      <Text style={styles.weeklyDayMonthToday}>{day.monthText}</Text>
                      <Text style={styles.weeklyDayNumberToday}>{day.dayText}</Text>
                    </View>
                    {day.canClaim && !day.isClaimed && <View style={styles.weeklyDayDot} />}
                  </Pressable>
                ) : day.isCheckedIn ? (
                  <View style={styles.weeklyDayCheckedCircle}>
                    <View style={styles.weeklyDayInner}>
                      <Text style={styles.weeklyDayMonthChecked}>{day.monthText}</Text>
                      <Text style={styles.weeklyDayNumberChecked}>{day.dayText}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.weeklyDayInactiveCircle}>
                    <View style={styles.weeklyDayInner}>
                      <Text style={styles.weeklyDayMonthInactive}>{day.monthText}</Text>
                      <Text style={styles.weeklyDayNumberInactive}>{day.dayText}</Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const CurrentLevelSection: React.FC<{ level: number; xp: number; nextLevelXp: number }> = ({
  level,
  xp,
  nextLevelXp,
}) => {
  const currentLevelXP = Math.max(0, (level - 1) * (level - 1) * 100);
  const xpInLevel = Math.max(0, xp - currentLevelXP);
  const xpNeeded = Math.max(1, nextLevelXp - currentLevelXP);
  const progress = Math.min(1, Math.max(0, xpInLevel / xpNeeded));
  const breathingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathingAnim, {
          toValue: -8,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(breathingAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.currentLevelSection}>
      <Animated.View
        style={[
          styles.currentLevelBadgeContainer,
          {
            transform: [{ translateY: breathingAnim }],
          },
        ]}
      >
        <Image
          source={require('../../assets/images/LevelBadge.png')}
          style={styles.currentLevelBadgeImage}
          resizeMode="contain"
        />
        <Text style={styles.currentLevelNumber}>{level}</Text>
      </Animated.View>
      <View style={styles.currentLevelContent}>
        <Text style={styles.currentLevelTitle}>Current level</Text>
        <View style={styles.currentLevelRow}>
          <Text style={styles.currentLevelLabel}>Level {level}</Text>
          <Text style={styles.currentLevelXP}>{xpInLevel}/{xpNeeded}</Text>
        </View>
        <View style={styles.currentLevelProgressBar}>
          <View style={[styles.currentLevelProgressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.currentLevelHint}>Level up to get more quests</Text>
      </View>
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
  gradient: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    padding: 4,
    gap: 6,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  tabButtonActive: {
    backgroundColor: '#fff',
  },
  tabLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#111',
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: '#6c6c6c',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  cardTitleContainer: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  cardTitle: {
    color: '#111',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: '#6b6b6b',
    fontSize: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F5F5F5',
    flexShrink: 0,
  },
  difficultyText: {
    color: '#333',
    fontSize: 12,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF247C',
  },
  progressLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressLabel: {
    color: '#111',
    fontSize: 12,
    fontWeight: '600',
  },
  progressStatus: {
    color: '#6b6b6b',
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
    backgroundColor: '#F5F5F5',
  },
  rewardImage: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
  rewardLabel: {
    color: '#111',
    fontSize: 12,
    fontWeight: '600',
  },
  claimButton: {
    marginTop: 12,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 12,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorMessage: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    textAlign: 'center',
  },
  emptyTitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptySubTitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    textAlign: 'center',
  },
  skeletonContainer: {
    gap: 16,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
    marginBottom: 8,
  },
  skeletonLineLarge: {
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    marginBottom: 12,
  },
  levelGroup: {
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 32,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingTop: 20,
    paddingHorizontal: 20,
    gap: 4,
  },
  levelTitle: {
    color: '#111',
    fontSize: 18,
    fontWeight: '700',
  },
  levelProgress: {
    color: 'rgba(0, 0, 0, 0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  levelQuestWrapper: {
    paddingHorizontal: 20,
  },
  levelQuestCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: '#FFF5F9',
  },
  levelQuestCardCompleted: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  levelQuestCardContent: {
    padding: 16,
  },
  levelQuestCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    pointerEvents: 'none',
  },
  levelQuestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  levelQuestTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  levelQuestProgressContainer: {
    gap: 6,
  },
  levelQuestProgressBar: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 2,
  },
  levelQuestProgressFill: {
    height: '100%',
    borderRadius: 6,
  },
  levelQuestProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 12,
  },
  levelQuestProgressText: {
    fontSize: 13,
    fontWeight: '600',
  },
  levelQuestClaimButton: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
  },
  levelQuestClaimButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B8A',
  },
  levelQuestClaimedContainer: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  levelQuestClaimedText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  levelTabContent: {
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  currentLevelSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 32,
    marginBottom: 0,
  },
  currentLevelBadgeContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentLevelBadgeImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  currentLevelNumber: {
    fontSize: 60,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  currentLevelContent: {
    flex: 1,
    gap: 8,
  },
  currentLevelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  currentLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currentLevelLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#111',
  },
  currentLevelXP: {
    fontSize: 16,
    fontWeight: '400',
    color: '#111',
  },
  currentLevelProgressBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFF5F9',
    overflow: 'hidden',
  },
  currentLevelProgressFill: {
    height: '100%',
    backgroundColor: '#FF247C',
    borderRadius: 6,
  },
  currentLevelHint: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(0, 0, 0, 0.6)',
  },
  dailyTabContent: {
    paddingTop: 4,
    paddingHorizontal: 20,
    gap: 0,
  },
  dailyCheckInSection: {
    marginTop: 8,
    marginBottom: 0,
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 20,
    minHeight: 100,
  },
  dailyTasksSection: {
    marginTop: 0,
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 20,
  },
  dailyTasksHeader: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  dailyTasksTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  dailyTasksCountdown: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(0, 0, 0, 0.6)',
  },
  weeklyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  weeklySubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(0, 0, 0, 0.6)',
  },
  weeklySubtitleSkeleton: {
    width: 160,
    height: 16,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  weeklyDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  weeklyDaysSkeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  weeklyDaySkeletonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  weeklyDayContainer: {
    flex: 1,
    alignItems: 'center',
  },
  weeklyDayInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  weeklyDayTodayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F52B7B',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  weeklyDayMonthToday: {
    fontSize: 8,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  weeklyDayNumberToday: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  weeklyDayDot: {
    position: 'absolute',
    bottom: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F52B7B',
  },
  weeklyDayCheckedCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6CA6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weeklyDayMonthChecked: {
    fontSize: 8,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  weeklyDayNumberChecked: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  weeklyDayInactiveCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weeklyDayMonthInactive: {
    fontSize: 8,
    fontWeight: '500',
    color: '#F52B7B',
  },
  weeklyDayNumberInactive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F52B7B',
  },
  dailyTasksSkeleton: {
    gap: 16,
  },
  dailyTasksHeaderSkeleton: {
    height: 20,
    width: 120,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 4,
    marginBottom: 4,
  },
  dailyTasksCountdownSkeleton: {
    height: 16,
    width: 160,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 4,
  },
  dailyTasksList: {
    gap: 16,
    paddingVertical: 8,
  },
  dailyTasksEmptyState: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 40,
  },
  dailyTasksEmptyTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(0, 0, 0, 0.6)',
  },
  dailyQuestCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFF5F9',
  },
  dailyQuestCardCompleted: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  dailyQuestCardContent: {
    padding: 16,
    gap: 12,
  },
  dailyQuestCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    pointerEvents: 'none',
  },
  dailyQuestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  dailyQuestTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  dailyQuestProgressContainer: {
    gap: 6,
  },
  dailyQuestProgressBar: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 2,
  },
  dailyQuestProgressFill: {
    height: '100%',
    borderRadius: 6,
  },
  dailyQuestProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 12,
  },
  dailyQuestProgressText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dailyQuestClaimButton: {
    marginTop: 0,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  dailyQuestClaimButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B8A',
  },
  dailyQuestClaimedContainer: {
    marginTop: 0,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 8,
    alignItems: 'center',
  },
  dailyQuestClaimedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dailyRefreshButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
  },
  dailyRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
  },
  dailyRefreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomSpacer: {
    height: 120,
  },
});


