import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Animated, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';

export type RewardItem = {
  id: string;
  type: 'vcoin' | 'ruby' | 'xp' | 'bp' | 'energy' | 'costume' | 'custom';
  amount: number;
  icon: string;
  color: string;
  thumbnail?: string | null;
};

// ... (Props definition remains same)

// RewardItemView update
const RewardItemView: React.FC<{ reward: RewardItem }> = ({ reward }) => {
  const getCurrencyType = (): 'vcoin' | 'ruby' | 'xp' | 'bp' | null => {
    switch (reward.type) {
      case 'vcoin': return 'vcoin';
      case 'ruby': return 'ruby';
      case 'xp': return 'xp';
      case 'bp': return 'bp';
      default: return null;
    }
  };

  const currencyType = getCurrencyType();

  return (
    <View style={styles.rewardItem}>
      <View style={styles.rewardIconContainer}>
        {reward.thumbnail ? (
          <Image
            source={{ uri: reward.thumbnail }}
            style={{ width: 80, height: 80, borderRadius: 12 }}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name={reward.icon as any} size={52} color="#FFFFFF" />
        )}
      </View>
      <Text style={styles.rewardAmount}>+{reward.amount}</Text>
    </View>
  );
};

type Props = {
  isPresented: boolean;
  rewards: RewardItem[];
  title: string;
  subtitle?: string;
  onClaim: () => void;
  showConfetti?: boolean;
};

export const RewardClaimOverlay: React.FC<Props> = ({
  isPresented,
  rewards,
  title,
  subtitle,
  onClaim,
  showConfetti = true,
}) => {
  const [showRewards, setShowRewards] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (isPresented) {
      setShowRewards(false);
      Animated.parallel([
        Animated.spring(fadeAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      // Show rewards after a short delay
      setTimeout(() => {
        setShowRewards(true);
      }, 200);
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      setShowRewards(false);
    }
  }, [isPresented]);

  const handleClose = () => {
    onClaim();
  };

  return (
    <Modal transparent visible={isPresented} animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={['#FF5FA1', '#FF247C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <View style={styles.content}>
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              </View>

              {showRewards && (
                <View style={styles.rewardsContainer}>
                  {rewards.length > 0 ? (
                    <>
                      {/* First row (max 2 items) */}
                      {/* <View style={styles.rewardRow}>
                        {rewards.slice(0, 2).map(reward => (
                          <RewardItemView key={reward.id} reward={reward} />
                        ))}
                      </View> */}

                      {/* Second row (items 3 and 4, if they exist) */}
                      {/* {rewards.length > 2 && (
                        <View style={styles.rewardRow}>
                          {rewards.slice(2, 4).map(reward => (
                            <RewardItemView key={reward.id} reward={reward} />
                          ))}
                        </View>
                      )} */}
                    </>
                  ) : (
                    <Text style={styles.emptyText}>No rewards available</Text>
                  )}
                </View>
              )}

              <Pressable style={styles.closeButton} onPress={handleClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};



// MARK: - Helper Functions
export const RewardClaimOverlayHelpers = {
  fromMilestone(vcoin: number, ruby: number, xp: number = 0): RewardItem[] {
    const rewards: RewardItem[] = [];
    function generateId(): string {
      return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    if (vcoin > 0) {
      rewards.push({
        id: generateId(),
        type: 'vcoin',
        amount: vcoin,
        icon: 'cash',
        color: 'green',
      });
    }

    if (ruby > 0) {
      rewards.push({
        id: generateId(),
        type: 'ruby',
        amount: ruby,
        icon: 'diamond',
        color: 'pink',
      });
    }

    if (xp > 0) {
      rewards.push({
        id: generateId(),
        type: 'xp',
        amount: xp,
        icon: 'star',
        color: 'yellow',
      });
    }

    return rewards;
  },

  serializeRewards(rewards: RewardItem[]): Array<Record<string, any>> {
    return rewards.map(reward => ({
      type: reward.type,
      amount: reward.amount,
      icon: reward.icon,
      colorName: reward.color,
    }));
  },

  deserializeRewards(dicts: Array<Record<string, any>>): RewardItem[] {
    function generateId(): string {
      return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
    return dicts
      .filter(dict => dict.type && dict.amount !== undefined && dict.icon && dict.colorName)
      .map(dict => ({
        id: generateId(),
        type: dict.type as RewardItem['type'],
        amount: dict.amount as number,
        icon: dict.icon as string,
        color: dict.colorName as string,
      }));
  },
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradient: {
    padding: 24,
  },
  content: {
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  rewardsContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
  },
  rewardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 40,
  },
  rewardItem: {
    alignItems: 'center',
    gap: 16,
  },
  rewardIconContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  closeButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 120,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF247C',
    textAlign: 'center',
  },
});

