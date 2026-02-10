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

type EnergySheetProps = {
  isOpened: boolean;
  onIsOpenedChange: (opened: boolean) => void;
  energy: number;
  energyMax: number;
};

export const EnergySheet: React.FC<EnergySheetProps> = ({
  isOpened,
  onIsOpenedChange,
  energy,
  energyMax,
}) => {
  const insets = useSafeAreaInsets();
  const progress = Math.min(1, Math.max(0, energyMax > 0 ? energy / energyMax : 0));

  const closeSheet = () => onIsOpenedChange(false);

  return (
    <Modal
      visible={isOpened}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={closeSheet}
    >
      <LinearGradient
        style={[styles.gradient, { paddingTop: 20, paddingBottom: insets.bottom + 16 }]}
        colors={['#7c3aed', '#8b5cf6', '#FFFFFF']}
        start={{ x: 0.5, y: -0.1 }}
        end={{ x: 0.1, y: 1 }}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Energy</Text>
            <Text style={styles.headerSubtitle}>Stay powered for premium interactions</Text>
          </View>
          <Pressable style={styles.headerClose} onPress={closeSheet}>
            <Ionicons name="close" size={18} color="#fff" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <EnergyStatusCard energy={energy} progress={progress} />
          <EnergyHowCard />
          <EnergyTipsCard />
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
};

const EnergyStatusCard: React.FC<{ energy: number; progress: number }> = ({
  energy,
  progress,
}) => {
  const energyColor =
    energy < 20 ? '#FF5F6D' : energy < 50 ? '#FFB347' : '#FFB703';
  return (
    <View style={styles.card}>
      <View style={styles.cardHeading}>
        <Text style={styles.cardTitle}>Current Energy</Text>
        <Text style={styles.cardSubtitle}>Energy regenerates over time</Text>
      </View>
      <View style={styles.energyRow}>
        <View style={styles.energyValueRow}>
          <View style={[styles.energyIcon, { backgroundColor: `${energyColor}26` }]}>
            <Ionicons name="flash" size={16} color={energyColor} />
          </View>
          <Text style={styles.energyValue}>{`${energy}/100`}</Text>
        </View>
        <Text style={styles.energyPercent}>{`${Math.round(progress * 100)}%`}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.cardBodyText}>
        Energy powers premium interactions. Maintain it via regeneration and rewards.
      </Text>
    </View>
  );
};

const EnergyHowCard: React.FC = () => (
  <View style={styles.card}>
    <View style={styles.cardHeading}>
      <Text style={styles.cardTitle}>How Energy Works</Text>
      <Text style={styles.cardSubtitle}>Plan interactions with refills in mind</Text>
    </View>
    <View style={styles.listBody}>
      <Text style={styles.listItem}>
        • Calls, photo shoots, and immersive events consume more energy than simple chats.
      </Text>
      <Text style={styles.listItem}>
        • Energy naturally regenerates every few minutes, so breaks help it refill.
      </Text>
      <Text style={styles.listItem}>
        • Rewards from quests, check-ins, and streak bonuses instantly restore larger amounts.
      </Text>
    </View>
  </View>
);

const EnergyTipsCard: React.FC = () => (
  <View style={styles.card}>
    <View style={styles.cardHeading}>
      <Text style={styles.cardTitle}>Tips</Text>
      <Text style={styles.cardSubtitle}>Keep energy handy</Text>
    </View>
    <View style={styles.tipRow}>
      <Ionicons name="gift" size={16} color="#8b5cf6" />
      <Text style={styles.tipText}>Claim daily check-ins to refill a chunk of energy.</Text>
    </View>
    <View style={styles.tipRow}>
      <Ionicons name="checkmark-done" size={16} color="#8b5cf6" />
      <Text style={styles.tipText}>Complete quests and missions for bonus refills.</Text>
    </View>
    <View style={styles.tipRow}>
      <Ionicons name="time" size={16} color="#8b5cf6" />
      <Text style={styles.tipText}>Take short breaks so regeneration can catch up.</Text>
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
  energyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  energyValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  energyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  energyValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111',
  },
  energyPercent: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8b5cf6',
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
    backgroundColor: '#8b5cf6',
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


