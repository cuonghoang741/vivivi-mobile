import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Button from '../Button';
import { type LoginReward } from '../../services/LoginRewardService';

const VCOIN_ICON = require('../../assets/images/VCoin.png');
const RUBY_ICON = require('../../assets/images/Ruby.png');

type LoginRewardSheetProps = {
  visible: boolean;
  onClose: () => void;
  rewards: LoginReward[];
  currentDay: number;
  canClaimToday: boolean;
  hasClaimedToday: boolean;
  loading: boolean;
  claiming: boolean;
  onRefresh: () => Promise<void>;
  onClaim: () => Promise<void>;
};

export const LoginRewardSheet: React.FC<LoginRewardSheetProps> = ({
  visible,
  onClose,
  rewards,
  currentDay,
  canClaimToday,
  hasClaimedToday,
  loading,
  claiming,
  onRefresh,
  onClaim,
}) => {
  const columnCount = useMemo(() => {
    return 5;
  }, []);

  const renderItem = ({ item }: { item: LoginReward }) => {
    const status = getRewardStatus(item.day_number, currentDay, hasClaimedToday);
    const isCurrent = status === 'current';
    const isClaimed = status === 'claimed';
    const isLocked = status === 'locked';
    const enableClaim = isCurrent && canClaimToday && !claiming;

    return (
      <Pressable
        style={[
          styles.rewardCard,
          isCurrent && styles.rewardCardCurrent,
          isClaimed && styles.rewardCardClaimed,
          isLocked && styles.rewardCardLocked,
        ]}
        disabled={!enableClaim}
        onPress={() => {
          if (enableClaim) {
            void onClaim();
          }
        }}
      >
        <Text style={[styles.dayLabel, isCurrent && styles.dayLabelCurrent]}>
          Day {item.day_number}
        </Text>

        <View style={styles.rewardValues}>
          {item.reward_vcoin > 0 ? (
            <RewardValue icon={VCOIN_ICON} label={formatNumber(item.reward_vcoin)} />
          ) : null}
          {item.reward_ruby > 0 ? (
            <RewardValue icon={RUBY_ICON} label={formatNumber(item.reward_ruby)} />
          ) : null}
          {item.reward_energy > 0 ? (
            <Text style={styles.energyValue}>{`⚡ ${item.reward_energy}`}</Text>
          ) : null}
        </View>

        <View style={styles.statusContainer}>
          {enableClaim ? (
            <Text style={styles.statusText}>Tap to claim</Text>
          ) : isClaimed ? (
            <Text style={styles.statusText}>Claimed</Text>
          ) : (
            <Text style={styles.statusTextDim}>Locked</Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient colors={['#190019', '#3a0d3f']} style={styles.modalContainer}>
        <View style={styles.header}>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              void onRefresh();
            }}
            textStyle={styles.headerButtonText}
          >
            Refresh
          </Button>
          <View>
            <Text style={styles.headerTitle}>Daily Login Rewards</Text>
            <Text style={styles.headerSubtitle}>
              Claim rewards every day to keep the streak
            </Text>
          </View>
          <Button size="md" variant="liquid" isIconOnly startIconName="close" onPress={onClose} />
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Today</Text>
          <Text style={styles.summaryValue}>Day {currentDay}</Text>
          {hasClaimedToday ? (
            <Text style={styles.summaryHint}>Already claimed</Text>
          ) : canClaimToday ? (
            <Text style={styles.summaryHint}>Claim is ready</Text>
          ) : (
            <Text style={styles.summaryHint}>Come back tomorrow</Text>
          )}
        </View>

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Loading calendar...</Text>
          </View>
        ) : (
          <FlatList
            data={rewards}
            keyExtractor={item => item.id}
            numColumns={columnCount}
            renderItem={renderItem}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridRow}
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={styles.footer}>
          <Button
            variant="liquid"
            onPress={() => void onClaim()}
            disabled={!canClaimToday || claiming}
            loading={claiming}
            startIconName="gift"
          >
            {hasClaimedToday ? 'Claimed' : 'Claim today'}
          </Button>
        </View>
      </LinearGradient>
    </Modal>
  );
};

const RewardValue: React.FC<{ icon: any; label: string }> = ({ icon, label }) => (
  <View style={styles.rewardValue}>
    <Image source={icon} style={styles.rewardIcon} />
    <Text style={styles.rewardIconText}>{label}</Text>
  </View>
);

const getRewardStatus = (
  dayNumber: number,
  currentDay: number,
  hasClaimedToday: boolean
): 'current' | 'claimed' | 'locked' => {
  if (dayNumber < currentDay) {
    return 'claimed';
  }
  if (dayNumber === currentDay) {
    return hasClaimedToday ? 'claimed' : 'current';
  }
  return 'locked';
};

const formatNumber = (value: number) =>
  Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    paddingTop: 20,
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerButtonText: {
    color: '#fff',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  summaryHint: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  gridContent: {
    paddingHorizontal: 12,
    paddingBottom: 120,
  },
  gridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  rewardCard: {
    width: '18%',
    minWidth: 70,
    maxWidth: 90,
    marginHorizontal: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rewardCardCurrent: {
    borderColor: '#FFD369',
    backgroundColor: 'rgba(255, 211, 105, 0.15)',
    shadowColor: '#FFD369',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 2,
  },
  rewardCardClaimed: {
    opacity: 0.7,
  },
  rewardCardLocked: {
    opacity: 0.5,
  },
  dayLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  dayLabelCurrent: {
    color: '#FFD369',
  },
  rewardValues: {
    marginTop: 8,
    alignItems: 'center',
    gap: 4,
  },
  rewardValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rewardIcon: {
    width: 16,
    height: 16,
    marginRight: 4,
    resizeMode: 'contain',
  },
  rewardIconText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  energyValue: {
    color: '#FEDA77',
    fontWeight: '700',
  },
  statusContainer: {
    marginTop: 6,
    alignItems: 'center',
  },
  statusText: {
    color: '#FFD369',
    fontSize: 10,
    fontWeight: '600',
  },
  statusTextDim: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.8)',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
    paddingHorizontal: 20,
  },
});

export default LoginRewardSheet;


