import React, { useCallback, useMemo } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewProps,
  PanResponder,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import Button from "./Button";
import { LiquidGlass } from "./LiquidGlass";
import { usePurchaseContext } from "../context/PurchaseContext";
import { toastManager, ToastType, CurrencyKind } from "../managers/ToastManager";

const VCOIN_ICON = require("../assets/images/VCoin.png");
const RUBY_ICON = require("../assets/images/Ruby.png");

type VRMUIOverlayProps = ViewProps & {
  level?: number;
  xp?: number;
  nextLevelXp?: number;
  energy?: number;
  energyMax?: number;
  hasIncompleteQuests?: boolean;
  canClaimCalendar?: boolean;
  unclaimedQuestCount?: number;
  hasMessages?: boolean;
  showChatList?: boolean;

  onLevelPress?: () => void;
  onEnergyPress?: () => void;
  onBackgroundPress?: () => void;
  onCostumePress?: () => void;
  onQuestPress?: () => void;
  onCalendarPress?: () => void;
  onToggleChatList?: () => void;

  // Swipe gesture handlers
  onSwipeBackground?: (offset: number) => void;
  onSwipeCharacter?: (offset: number) => void;
  isChatScrolling?: boolean;
  canSwipeCharacter?: boolean;
};

export const VRMUIOverlay: React.FC<VRMUIOverlayProps> = ({
  style,
  level = 1,
  xp = 0,
  nextLevelXp = 100,
  energy = 80,
  energyMax = 100,
  hasIncompleteQuests,
  canClaimCalendar,
  unclaimedQuestCount = 0,
  hasMessages,
  showChatList,
  onLevelPress,
  onEnergyPress,
  onBackgroundPress,
  onCostumePress,
  onQuestPress,
  onCalendarPress,
  onToggleChatList,
  onSwipeBackground,
  onSwipeCharacter,
  isChatScrolling = false,
  canSwipeCharacter = false,
  ...rest
}) => {
  const { animatedBalance, setShowPurchaseSheet } = usePurchaseContext();

  // PanResponder for swipe gestures (like swift-version DragGesture)
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Don't respond if user is scrolling in chat
          if (isChatScrolling) {
            return false;
          }
          // Only respond if movement is significant (like swift-version minimumDistance: 20)
          return Math.abs(gestureState.dx) > 20 || Math.abs(gestureState.dy) > 20;
        },
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          // Capture gesture before children handle it, but only for significant movements
          if (isChatScrolling) {
            return false;
          }
          return Math.abs(gestureState.dx) > 20 || Math.abs(gestureState.dy) > 20;
        },
        onPanResponderGrant: () => {
          // Trigger haptic feedback (like swift-version triggerHaptic(.light))
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
        onPanResponderRelease: (_, gestureState) => {
          // Don't handle gesture if user is scrolling in chat
          if (isChatScrolling) {
            return;
          }

          const dx = gestureState.dx;
          const dy = gestureState.dy;

          // Horizontal swipe -> change background (like swift-version)
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40 && onSwipeBackground) {
            onSwipeBackground(dx < 0 ? 1 : -1);
          }
          // Vertical swipe -> change character (only if user has more than one owned character)
          else if (Math.abs(dy) > 40 && canSwipeCharacter && onSwipeCharacter) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // dy < 0 means swipe up -> next character (+1)
            // dy > 0 means swipe down -> previous character (-1)
            onSwipeCharacter(dy < 0 ? 1 : -1);
          }
        },
      }),
    [isChatScrolling, onSwipeBackground, onSwipeCharacter, canSwipeCharacter]
  );

  const levelProgress = useMemo(() => {
    if (nextLevelXp <= 0) return 0;
    return Math.min(1, Math.max(0, xp / nextLevelXp));
  }, [xp, nextLevelXp]);

  const insets = useSafeAreaInsets();
  const safeAreaPadding = useMemo(
    () => ({
      paddingTop: 68 + insets.top,
      paddingBottom: 12 + insets.bottom,
    }),
    [insets.bottom, insets.top]
  );

  const handleCurrencyPress = useCallback(() => {
    setShowPurchaseSheet(true);
  }, [setShowPurchaseSheet]);

  const handleRandomToast = useCallback(() => {
    const random = Math.random();
    const toastTypes = [
      () => toastManager.showXPToast(Math.floor(Math.random() * 100) + 10),
      () => toastManager.showBPToast(Math.floor(Math.random() * 50) + 5),
      () => toastManager.showRelationshipToast(Math.floor(Math.random() * 20) + 1),
      () => toastManager.showCurrencyToast(CurrencyKind.VCOIN, Math.floor(Math.random() * 500) + 50),
      () => toastManager.showCurrencyToast(CurrencyKind.RUBY, Math.floor(Math.random() * 100) + 10),
      () => toastManager.showQuestProgress(
        'Daily Quest Progress',
        Math.floor(Math.random() * 5) + 1,
        5,
        false
      ),
      () => toastManager.showQuestProgress(
        'Quest Completed!',
        5,
        5,
        true
      ),
      () => toastManager.showToast(
        ToastType.LEVEL_UP,
        'Level Up!',
        'You reached level 10',
        undefined,
        'arrow-up-circle'
      ),
      () => toastManager.showToast(
        ToastType.ENERGY,
        '+20 Energy',
        undefined,
        20,
        'flash'
      ),
    ];
    
    const randomToast = toastTypes[Math.floor(Math.random() * toastTypes.length)];
    randomToast();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  return (
    <View
      style={[styles.container, safeAreaPadding, style]}
      {...panResponder.panHandlers}
      {...rest}
    >
      <View style={styles.leftColumn} pointerEvents="box-none">
        <ButtonTile onPress={onLevelPress}>
          <View style={styles.levelCompactRow}>
            <Text style={styles.levelLabel}>{`LV. ${level}`}</Text>
            <View style={styles.levelCompactTrack}>
              <LinearGradient
                colors={["#FF247C", "#FF247C"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[
                  styles.levelCompactFill,
                  { width: `${levelProgress * 100}%` },
                ]}
              />
            </View>
          </View>
        </ButtonTile>

        <ButtonTile onPress={onEnergyPress}>
          <View style={styles.energyRow}>
            <Ionicons name="flash" size={14} color="#111" />
            <Text style={styles.energyLabel}>{`${energy}/${energyMax}`}</Text>
          </View>
        </ButtonTile>

        <ButtonTile onPress={handleCurrencyPress}>
          <CurrencyRow icon={VCOIN_ICON} amount={animatedBalance.vcoin} />
        </ButtonTile>
        <ButtonTile onPress={handleCurrencyPress}>
          <CurrencyRow icon={RUBY_ICON} amount={animatedBalance.ruby} />
        </ButtonTile>
      </View>
      <View style={styles.rightColumn} pointerEvents="box-none">
        <IconButton iconName="map-outline" onPress={onBackgroundPress} />
        <IconButton iconName="shirt-outline" onPress={onCostumePress} />
        <IconButton
          iconName="flag-outline"
          highlight={hasIncompleteQuests}
          badgeCount={unclaimedQuestCount > 0 ? unclaimedQuestCount : undefined}
          onPress={onQuestPress}
        />
        {/* <IconButton
          iconName="calendar-outline"
          highlight={canClaimCalendar}
          showBadge={canClaimCalendar}
          onPress={onCalendarPress}
        /> */}
        {hasMessages ? (
          <IconButton
            iconName={
              showChatList ? "close-outline" : "chatbubble-ellipses-outline"
            }
            onPress={onToggleChatList}
          />
        ) : null}
        {/* <IconButton
          iconName="bug-outline"
          onPress={handleRandomToast}
        /> */}
      </View>
    </View>
  );
};

const CurrencyRow: React.FC<{
  icon: any;
  amount: number;
}> = ({ icon, amount }) => (
  <View style={styles.currencyRow}>
    <Image source={icon} style={styles.currencyIcon} />
    <Text style={styles.currencyLabel}>{formatCompactCurrency(amount)}</Text>
  </View>
);

type IoniconName = keyof typeof Ionicons.glyphMap;

const IconButton: React.FC<{
  iconName: IoniconName;
  onPress?: () => void;
  highlight?: boolean;
  badgeCount?: number;
  showBadge?: boolean;
}> = ({ iconName, onPress, highlight, badgeCount, showBadge }) => {
  const shouldShowBadge = showBadge || (badgeCount !== undefined && badgeCount > 0);
  
  return (
    <View style={styles.iconButtonContainer}>
      <LiquidGlass style={styles.iconButtonGlass} onPress={onPress}>
        <Ionicons name={iconName} size={18} color="#111" />
      </LiquidGlass>
      {shouldShowBadge && (
        <View style={styles.badgeContainer}>
          {badgeCount !== undefined && badgeCount > 0 ? (
            <View style={[
              styles.badgeWithCount,
              badgeCount > 9 && { paddingHorizontal: 4 }
            ]}>
              <Text style={styles.badgeText}>
                {badgeCount > 9 ? '9+' : badgeCount.toString()}
              </Text>
            </View>
          ) : (
            <View style={styles.badgeDot} />
          )}
        </View>
      )}
    </View>
  );
};

const ButtonTile: React.FC<{
  children: React.ReactNode;
  onPress?: () => void;
}> = ({ children, onPress }) => (
  <Button variant="liquid" style={styles.tilePressable} onPress={onPress}>
    <View style={styles.tileContentRow}>{children}</View>
  </Button>
);

const formatCompactCurrency = (value: number) => {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }

  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }

  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  return `${value}`;
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  leftColumn: {
    gap: 12,
    width: "auto",
    alignSelf: "flex-start",
  },
  rightColumn: {
    alignItems: "flex-end",
    gap: 10,
  },
  tilePressable: {
    borderRadius: 22,
    minHeight: 44,
    alignSelf: "flex-start",
  },
  tileContentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  levelLabel: {
    color: "#111",
    fontSize: 14,
    fontWeight: "700",
  },
  levelCompactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelCompactTrack: {
    width: 86,
    height: 12,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 10,
    overflow: "hidden",
  },
  levelCompactFill: {
    height: "100%",
    borderRadius: 10,
  },
  energyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  energyLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
  },
  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currencyIcon: {
    width: 18,
    height: 18,
    resizeMode: "contain",
  },
  currencyLabel: {
    color: "#111",
    fontSize: 14,
    fontWeight: "700",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  iconButtonContainer: {
    position: "relative",
  },
  iconButtonGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  iconButtonHighlight: {
    backgroundColor: "rgba(255,149,0,0.18)",
  },
  pressed: {
    opacity: 0.85,
  },
  badgeContainer: {
    position: "absolute",
    top: -2,
    right: -2,
    zIndex: 1,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3B30",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  badgeWithCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FF3B30",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 13,
  },
});
