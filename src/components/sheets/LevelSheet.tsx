import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const progress = nextLevelXp > 0 ? Math.min(1, Math.max(0, xp / nextLevelXp)) : 0;

  const closeSheet = () => onIsOpenedChange(false);

  return (
    <Modal
      visible={isOpened}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={closeSheet}
    >
      <LinearGradient
        style={[styles.gradient, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}
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
          <LevelStatusCard level={level} xp={xp} nextLevelXp={nextLevelXp} progress={progress} />
          <LevelHowCard />
          <LevelTipsCard />
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
};

const LevelStatusCard: React.FC<{
  level: number;
  xp: number;
  nextLevelXp: number;
  progress: number;
}> = ({ level, xp, nextLevelXp, progress }) => (
  <View style={styles.card}>
    <View style={styles.cardHeading}>
      <Text style={styles.cardTitle}>Current Level</Text>
      <Text style={styles.cardSubtitle}>Each level unlocks new perks</Text>
    </View>
    <View style={styles.levelRow}>
      <Text style={styles.levelBadge}>{`LV. ${level}`}</Text>
      <Text style={styles.levelPercent}>{`${Math.round(progress * 100)}%`}</Text>
    </View>
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
    </View>
    <Text style={styles.levelStats}>{`${xp} / ${nextLevelXp} XP`}</Text>
    <Text style={styles.cardBodyText}>
      Complete interactions, daily quests, and events to earn XP. Higher levels improve your bond and
      unlock premium scenes.
    </Text>
  </View>
);

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
      <Ionicons name="checkmark.circle.fill" size={18} color="#F52B7B" />
      <Text style={styles.tipText}>Claim streak rewards daily to lock in bonus XP.</Text>
    </View>
    <View style={styles.tipRow}>
      <Ionicons name="chatbubble-ellipses.fill" size={18} color="#F52B7B" />
      <Text style={styles.tipText}>Run multi-step chats instead of single-line replies.</Text>
    </View>
    <View style={styles.tipRow}>
      <Ionicons name="flame.fill" size={18} color="#F52B7B" />
      <Text style={styles.tipText}>Keep events and photo shoots active for premium XP rewards.</Text>
    </View>
  </View>
);

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
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelBadge: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FF247C',
  },
  levelPercent: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F52B7B',
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
  levelStats: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  cardBodyText: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.7)',
    lineHeight: 20,
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
});


