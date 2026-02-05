import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Button from "../commons/Button";
import type { LoginReward } from "../../repositories/LoginRewardRepository";

const VCOIN_ICON = require("../../assets/images/VCoin.png");
const RUBY_ICON = require("../../assets/images/Ruby.png");

type LoginRewardCalendarModalProps = {
  visible: boolean;
  onClose: () => void;
  rewards: LoginReward[];
  currentDay: number;
  canClaimToday: boolean;
  hasClaimedToday: boolean;
  isLoading: boolean;
  error: string | null;
  onReload: () => void;
  onClaim: () => void;
  isClaiming?: boolean;
};

export const LoginRewardCalendarModal: React.FC<
  LoginRewardCalendarModalProps
> = ({
  visible,
  onClose,
  rewards,
  currentDay,
  canClaimToday,
  hasClaimedToday,
  isLoading,
  error,
  onReload,
  onClaim,
  isClaiming = false,
}) => {
    const { width } = useWindowDimensions();
    const columnCount = width >= 900 ? 7 : 5;
    const spacing = 12;
    const cardWidth = useMemo(() => {
      if (columnCount === 7) {
        return 60;
      }
      if (width > 420) {
        return 62;
      }
      return Math.max(
        56,
        Math.floor((width - spacing * (columnCount + 1)) / columnCount)
      );
    }, [columnCount, spacing, width]);

    const renderContent = () => {
      if (isLoading) {
        return (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        );
      }

      if (error) {
        return (
          <View style={styles.centerContainer}>
            <Text style={styles.errorTitle}>Unable to load login calendar</Text>
            <Text style={styles.errorSubtitle}>{error}</Text>
            <Button onPress={onReload} size="md">
              Try Again
            </Button>
          </View>
        );
      }

      if (!rewards.length) {
        return (
          <View style={styles.centerContainer}>
            <Text style={styles.errorTitle}>No rewards available</Text>
            <Button onPress={onReload} size="md">
              Reload
            </Button>
          </View>
        );
      }

      return (
        <>
          <FlatList
            data={rewards}
            key={`login-calendar-${columnCount}`}
            keyExtractor={(item) => item.id}
            numColumns={columnCount}
            columnWrapperStyle={{
              gap: spacing,
              marginBottom: spacing,
              justifyContent: "center",
            }}
            contentContainerStyle={[
              styles.listContent,
              { paddingHorizontal: Math.max(12, spacing) },
            ]}
            renderItem={({ item }) => (
              <RewardCell
                reward={item}
                width={cardWidth}
                isCurrentDay={item.day_number === currentDay}
                isPastDay={
                  item.day_number < currentDay ||
                  (item.day_number === currentDay && hasClaimedToday)
                }
                isFutureDay={item.day_number > currentDay}
                onClaim={() => {
                  if (item.day_number === currentDay && canClaimToday) {
                    onClaim();
                  }
                }}
              />
            )}
          />
          <View style={styles.footer}>
            {canClaimToday ? (
              <Button onPress={onClaim} disabled={isClaiming} size="lg">
                {isClaiming ? "Claiming..." : `Claim Day ${currentDay} Reward`}
              </Button>
            ) : (
              <Text style={styles.footerHint}>
                {hasClaimedToday
                  ? "You already claimed today - come back tomorrow"
                  : "Log in daily to unlock more rewards"}
              </Text>
            )}
          </View>
        </>
      );
    };

    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={{ width: 40 }} />
            <View>
              <Text style={styles.title}>Login Calendar</Text>
              <Text style={styles.subtitle}>Earn VCoin, Ruby, and Energy</Text>
            </View>
            <Button
              size="md"
              variant="liquid"
              onPress={onClose}
              startIconName="close"
              isIconOnly
            />
          </View>
          {renderContent()}
        </View>
      </Modal>
    );
  };

type RewardCellProps = {
  reward: LoginReward;
  width: number;
  isCurrentDay: boolean;
  isPastDay: boolean;
  isFutureDay: boolean;
  onClaim: () => void;
};

const RewardCell: React.FC<RewardCellProps> = ({
  reward,
  width,
  isCurrentDay,
  isPastDay,
  isFutureDay,
  onClaim,
}) => {
  const backgroundColor = isCurrentDay
    ? "rgba(255, 214, 0, 0.18)"
    : isPastDay
      ? "rgba(255,255,255,0.08)"
      : "rgba(255,255,255,0.04)";

  const borderColor = isCurrentDay ? "#FFD24C" : "transparent";
  const shadowColor = isCurrentDay
    ? "rgba(255,210,76,0.45)"
    : "rgba(0,0,0,0.25)";
  const statusIcon: keyof typeof Ionicons.glyphMap = isPastDay
    ? "checkmark-circle"
    : isCurrentDay
      ? "star"
      : "ellipse-outline";
  const statusColor = isPastDay
    ? "#4CAF50"
    : isCurrentDay
      ? "#FFD24C"
      : "rgba(255, 255, 255, 0.4)";

  return (
    <Pressable
      onPress={onClaim}
      disabled={!isCurrentDay}
      style={[
        styles.rewardCell,
        {
          width,
          height: 120,
          opacity: isFutureDay ? 0.5 : 1,
          backgroundColor,
          borderColor,
          shadowColor,
        },
      ]}
    >
      <Text style={styles.dayLabel}>Day {reward.day_number}</Text>
      <View style={{ flex: 1, alignItems: "center", justifyContent: 'space-between' }}>
        <View style={styles.rewardAmounts}>
          {reward.reward_vcoin > 0 && (
            <View style={styles.amountRow}>
              <Image source={VCOIN_ICON} style={styles.amountIcon} />
              <Text style={[styles.amountLabel, styles.vcoinLabel]}>
                {reward.reward_vcoin}
              </Text>
            </View>
          )}
          {reward.reward_ruby > 0 && (
            <View style={styles.amountRow}>
              <Image source={RUBY_ICON} style={styles.amountIcon} />
              <Text style={[styles.amountLabel, styles.rubyLabel]}>
                {reward.reward_ruby}
              </Text>
            </View>
          )}
          {reward.reward_energy > 0 && (
            <View style={styles.amountRow}>
              <Ionicons
                name="flash"
                size={12}
                color="#FFD24C"
                style={styles.amountIcon}
              />
              <Text style={[styles.amountLabel, styles.energyLabel]}>
                {reward.reward_energy}
              </Text>
            </View>
          )}
        </View>
        <Ionicons
          name={statusIcon}
          size={isCurrentDay ? 20 : 18}
          color={statusColor}
        />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050505",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    marginTop: 4,
  },
  listContent: {
    paddingTop: 20,
    paddingBottom: 12,
  },
  rewardCell: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 3,
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  rewardAmounts: {
    alignItems: "center",
    gap: 4,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  amountIcon: {
    width: 12,
    height: 12,
    resizeMode: "contain",
  },
  vcoinLabel: {
    color: "#9CFF9C",
  },
  rubyLabel: {
    color: "#FF6B9A",
  },
  energyLabel: {
    color: "#F8D477",
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 8,
  },
  footerHint: {
    textAlign: "center",
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginBottom: 16,
  },
});
