import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';

const VCOIN_ICON = require('../../assets/images/VCoin.png');
const RUBY_ICON = require('../../assets/images/Ruby.png');

export type RewardDescriptor = {
  type: 'vcoin' | 'ruby' | 'xp';
  amount: number;
};

type RewardClaimModalProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  rewards: RewardDescriptor[];
  onClose: () => void;
};

export const RewardClaimModal: React.FC<RewardClaimModalProps> = ({
  visible,
  title,
  subtitle,
  rewards,
  onClose,
}) => {
  const displayRewards = rewards.filter(reward => reward.amount > 0);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <LinearGradient colors={['#FF5FA1', '#FF247C']} style={styles.modalShell}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>

            <View style={styles.rewardsContainer}>
              {displayRewards.length ? (
                displayRewards.map(reward => (
                  <View key={reward.type} style={styles.rewardCard}>
                    <View style={styles.rewardIcon}>
                      {reward.type === 'vcoin' || reward.type === 'ruby' ? (
                        <Image
                          source={reward.type === 'vcoin' ? VCOIN_ICON : RUBY_ICON}
                          style={styles.currencyIcon}
                        />
                      ) : (
                        <Ionicons name="star" size={28} color="#fff" />
                      )}
                    </View>
                    <Text style={styles.rewardLabel}>
                      {reward.type === 'vcoin'
                        ? 'VCoin'
                        : reward.type === 'ruby'
                        ? 'Ruby'
                        : 'XP'}
                    </Text>
                    <Text style={styles.rewardAmount}>+{reward.amount}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyRewardText}>Không có phần thưởng khả dụng</Text>
              )}
            </View>

            <Pressable style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>Close</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalShell: {
    width: '100%',
    borderRadius: 28,
    padding: 1,
    shadowColor: '#FF247C',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  content: {
    backgroundColor: 'rgba(17,17,17,0.9)',
    borderRadius: 27,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  rewardsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 28,
  },
  rewardCard: {
    width: 110,
    paddingVertical: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    gap: 6,
  },
  rewardIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  currencyIcon: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  rewardLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  rewardAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyRewardText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
  },
  button: {
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: '#fff',
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '700',
  },
});


