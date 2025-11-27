import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Image,
  Easing,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CharacterRepository } from '../../repositories/CharacterRepository';
import AssetRepository from '../../repositories/AssetRepository';

const LEVEL_BADGE = require('../../assets/images/LevelBadge.png');

type LevelSheetProps = {
  isOpened: boolean;
  onIsOpenedChange: (opened: boolean) => void;
  level: number;
  xp: number;
  nextLevelXp: number;
};

export const LevelSheet: React.FC<LevelSheetProps> = ({
  isOpened,
  onIsOpenedChange,
  level,
  xp,
  nextLevelXp,
}) => {
  const insets = useSafeAreaInsets();
  const { metrics } = useLevelInventoryMetrics();
  const levelStartXp = useMemo(
    () => Math.max(0, Math.pow(Math.max(level, 1) - 1, 2) * 100),
    [level]
  );
  const xpInLevel = useMemo(() => Math.max(0, xp - levelStartXp), [xp, levelStartXp]);
  const xpNeeded = useMemo(
    () => Math.max(1, nextLevelXp - levelStartXp),
    [nextLevelXp, levelStartXp]
  );
  const progress = useMemo(
    () => (xpNeeded > 0 ? Math.min(1, Math.max(0, xpInLevel / xpNeeded)) : 0),
    [xpInLevel, xpNeeded]
  );
  const statCards = useMemo<StatMetricCardProps[]>(() => {
    return [
      {
        key: 'characters',
        title: 'Characters',
        value: formatCount(metrics.characterCount, { pad: true }),
      },
      {
        key: 'backgrounds',
        title: 'Backgrounds',
        value: formatCount(metrics.backgroundCount, { pad: true }),
      },
      {
        key: 'costumes',
        title: 'Costumes',
        value: formatCount(metrics.costumeCount, { pad: true }),
      },
      {
        key: 'xp',
        title: 'XP',
        value: formatCompactNumber(xp),
      },
      {
        key: 'photos',
        title: 'Captured Photos',
        value: formatCount(metrics.mediaCount),
      },
      {
        key: 'messages',
        title: 'Messages',
        value: '—',
      },
      {
        key: 'voice',
        title: 'Voice Call',
        value: '—',
      },
      {
        key: 'video',
        title: 'Video Call',
        value: '—',
      },
    ];
  }, [metrics, xp]);

  const closeSheet = () => onIsOpenedChange(false);

  return (
    <Modal
      visible={isOpened}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={closeSheet}
    >
      <LinearGradient
        style={[styles.gradient, { paddingTop: 16, paddingBottom: insets.bottom + 16 }]}
        colors={['#E2005A', '#FF3888', '#FFFFFF']}
        start={{ x: 0.5, y: -0.1 }}
        end={{ x: 0.1, y: 1 }}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Level Info</Text>
            <Text style={styles.headerSubtitle}>Track your XP progress</Text>
          </View>
          <Pressable style={styles.headerClose} onPress={closeSheet}>
            <Ionicons name="close" size={18} color="#fff" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <LevelStatusCard
            level={level}
            xpInLevel={xpInLevel}
            xpNeeded={xpNeeded}
            progress={progress}
          />
          <StatsGrid metrics={statCards} />
          <LevelHowCard />
          <LevelTipsCard />
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
};

const LevelStatusCard: React.FC<{
  level: number;
  xpInLevel: number;
  xpNeeded: number;
  progress: number;
}> = ({ level, xpInLevel, xpNeeded, progress }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [floatAnim]);

  return (
    <View style={[styles.card, styles.levelCard]}>
      <View style={styles.levelCardRow}>
        <Animated.View style={[styles.badgeWrapper, { transform: [{ translateY: floatAnim }] }]}>
          <Image source={LEVEL_BADGE} style={styles.badgeImage} />
          <Text style={styles.badgeValue}>{level}</Text>
        </Animated.View>
        <View style={styles.levelDetails}>
          <Text style={styles.levelSectionLabel}>Current level</Text>
          <View style={styles.levelHeaderRow}>
            <Text style={styles.levelHeaderTitle}>{`Level ${level}`}</Text>
            <Text style={styles.levelHeaderStats}>{`${xpInLevel}/${xpNeeded}`}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.levelHint}>Level up to get more quests</Text>
        </View>
      </View>
    </View>
  );
};

const LevelHowCard: React.FC = () => (
  <View style={styles.card}>
    <View style={styles.cardHeading}>
      <Text style={styles.cardTitle}>How Leveling Works</Text>
      <Text style={styles.cardSubtitle}>Plan your XP grind</Text>
    </View>
    <View style={styles.listBody}>
      <Text style={styles.listItem}>
        • Chats and quick replies give small bursts of XP. Longer conversations grant more.
      </Text>
      <Text style={styles.listItem}>
        • Daily quests, streak bonuses, and immersive events deliver the largest XP chunks.
      </Text>
      <Text style={styles.listItem}>
        • Each level needs more XP — keep quests and streaks active to stay ahead.
      </Text>
    </View>
  </View>
);

const LevelTipsCard: React.FC = () => (
  <View style={styles.card}>
    <View style={styles.cardHeading}>
      <Text style={styles.cardTitle}>Tips</Text>
      <Text style={styles.cardSubtitle}>Level up faster</Text>
    </View>
    <View style={styles.tipRow}>
      <Ionicons name="checkmark-circle" size={18} color="#F52B7B" />
      <Text style={styles.tipText}>Claim streak rewards daily to lock in bonus XP.</Text>
    </View>
    <View style={styles.tipRow}>
      <Ionicons name="chatbubble-ellipses" size={18} color="#F52B7B" />
      <Text style={styles.tipText}>Run multi-step chats instead of single-line replies.</Text>
    </View>
    <View style={styles.tipRow}>
      <Ionicons name="flame" size={18} color="#F52B7B" />
      <Text style={styles.tipText}>Keep events and photo shoots active for premium XP rewards.</Text>
    </View>
  </View>
);

const StatsGrid: React.FC<{ metrics: StatMetricCardProps[] }> = ({ metrics }) => (
  <View style={styles.card}>
    <View style={styles.cardHeading}>
      <Text style={styles.cardTitle}>Current Stats</Text>
      <Text style={styles.cardSubtitle}>Your progress</Text>
    </View>
    <View style={styles.statsGrid}>
      {metrics.map(metric => (
        <StatMetricCard key={metric.key} {...metric} />
      ))}
    </View>
  </View>
);

type StatMetricCardProps = {
  key: string;
  title: string;
  value: string;
};

const StatMetricCard: React.FC<StatMetricCardProps> = ({ title, value }) => (
  <View style={styles.statCard}>
    <Text style={styles.statTitle}>{title}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const useLevelInventoryMetrics = () => {
  const [metrics, setMetrics] = useState<{
    characterCount: number | null;
    backgroundCount: number | null;
    costumeCount: number | null;
    mediaCount: number | null;
  }>({
    characterCount: null,
    backgroundCount: null,
    costumeCount: null,
    mediaCount: null,
  });

  useEffect(() => {
    let mounted = true;
    const characterRepo = new CharacterRepository();
    const assetRepo = new AssetRepository();

    (async () => {
      try {
        const [ownedCharacters, ownedBackgrounds, ownedCostumes, ownedMedia] = await Promise.all([
          characterRepo.fetchOwnedCharacterIds(),
          assetRepo.fetchOwnedAssets('background'),
          assetRepo.fetchOwnedAssets('character_costume'),
          assetRepo.fetchOwnedAssets('media'),
        ]);

        if (!mounted) {
          return;
        }

        setMetrics({
          characterCount: ownedCharacters.size,
          backgroundCount: ownedBackgrounds.size,
          costumeCount: ownedCostumes.size,
          mediaCount: ownedMedia.size,
        });
      } catch (error) {
        console.warn('[LevelSheet] Failed to load inventory metrics', error);
        if (!mounted) {
          return;
        }
        setMetrics(prev => ({ ...prev }));
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { metrics };
};

const formatCount = (value: number | null | undefined, options?: { pad?: boolean }) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }

  if (options?.pad) {
    return value >= 10 ? `${value}` : `0${value}`;
  }

  return `${value}`;
};

const formatCompactNumber = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return `${value}`;
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginTop: 4,
  },
  headerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  cardHeading: {
    alignItems: 'center',
    gap: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  cardSubtitle: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.6)',
  },
  progressTrack: {
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFEFF5',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 7,
    backgroundColor: '#FF247C',
  },
  listBody: {
    gap: 10,
  },
  listItem: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.75)',
    lineHeight: 20,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(0,0,0,0.75)',
    lineHeight: 20,
  },
  levelCard: {
    paddingBottom: 32,
  },
  levelCardRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  badgeWrapper: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeImage: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
  badgeValue: {
    position: 'absolute',
    fontSize: 56,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  levelDetails: {
    flex: 1,
    gap: 8,
  },
  levelSectionLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  levelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  levelHeaderStats: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  levelHint: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.6)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flexBasis: '48%',
    backgroundColor: '#FFF5F9',
    borderRadius: 20,
    padding: 16,
    gap: 4,
  },
  statTitle: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.6)',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111',
  },
});


