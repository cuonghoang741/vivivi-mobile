import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewProps,
  PanResponder,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { LiquidGlass } from "./LiquidGlass";
import StreakIcon from "../assets/icons/streak.svg";

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type VRMUIOverlayProps = ViewProps & {
  hasMessages?: boolean;
  showChatList?: boolean;
  loginStreak?: number;
  isDarkBackground?: boolean;
  canClaimCalendar?: boolean;
  isBgmOn?: boolean;
  isInCall?: boolean; // Hide overlay and disable gestures during call

  onBackgroundPress?: () => void;
  onCostumePress?: () => void;
  onCalendarPress?: () => void;
  onToggleChatList?: () => void;
  onSettingsPress?: () => void;
  onSpeakerPress?: () => void;

  // Swipe gesture handlers
  onSwipeBackground?: (offset: number) => void;
  onSwipeCharacter?: (offset: number) => void;
  isChatScrolling?: boolean;
  canSwipeCharacter?: boolean;
};

export const VRMUIOverlay: React.FC<VRMUIOverlayProps> = ({
  style,
  hasMessages,
  showChatList,
  loginStreak = 0,
  isDarkBackground = true,
  canClaimCalendar,
  isBgmOn = false,
  isInCall = false,
  onBackgroundPress,
  onCostumePress,
  onCalendarPress,
  onToggleChatList,
  onSettingsPress,
  onSpeakerPress,
  onSwipeBackground,
  onSwipeCharacter,
  isChatScrolling = false,
  canSwipeCharacter = false,
  ...rest
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Animation values
  const expandAnimation = useRef(new Animated.Value(0)).current;
  const arrowRotation = useRef(new Animated.Value(0)).current;

  // PanResponder for swipe gestures
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Disable swipe during call
          if (isInCall) return false;
          if (isChatScrolling) return false;
          return Math.abs(gestureState.dx) > 20 || Math.abs(gestureState.dy) > 20;
        },
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          // Disable swipe during call
          if (isInCall) return false;
          if (isChatScrolling) return false;
          return Math.abs(gestureState.dx) > 20 || Math.abs(gestureState.dy) > 20;
        },
        onPanResponderGrant: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (isChatScrolling) return;
          const dx = gestureState.dx;
          const dy = gestureState.dy;
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40 && onSwipeBackground) {
            onSwipeBackground(dx < 0 ? 1 : -1);
          } else if (Math.abs(dy) > 40 && canSwipeCharacter && onSwipeCharacter) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSwipeCharacter(dy < 0 ? 1 : -1);
          }
        },
      }),
    [isInCall, isChatScrolling, onSwipeBackground, onSwipeCharacter, canSwipeCharacter]
  );

  const insets = useSafeAreaInsets();
  const safeAreaPadding = useMemo(
    () => ({
      paddingTop: 68 + insets.top,
      paddingBottom: 12 + insets.bottom,
    }),
    [insets.bottom, insets.top]
  );

  // Icon color based on background brightness
  const iconColor = isDarkBackground ? '#fff' : '#000';

  const handleToggleExpand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Configure layout animation - faster
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        200,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      )
    );

    const toValue = isExpanded ? 0 : 1;

    // Animate expand/collapse - faster spring
    Animated.parallel([
      Animated.spring(expandAnimation, {
        toValue,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.spring(arrowRotation, {
        toValue,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    setIsExpanded(!isExpanded);
  };

  // Interpolate arrow rotation
  const arrowRotationStyle = {
    transform: [{
      rotate: arrowRotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
      }),
    }],
  };

  // Menu items configuration
  const menuItems = [
    {
      key: 'streak',
      label: 'Streak',
      isStreakButton: true,
      onPress: onCalendarPress,
    },
    {
      key: 'messages',
      label: showChatList ? 'Hide Chat' : 'Show Chat',
      iconName: showChatList ? 'chatbubble' : 'chatbubble-outline',
      onPress: onToggleChatList,
    },
    {
      key: 'outfit',
      label: 'Outfit',
      iconName: 'shirt-outline' as const,
      onPress: onCostumePress,
    },
    {
      key: 'background',
      label: 'Background',
      iconName: 'image-outline' as const,
      onPress: onBackgroundPress,
    },
    {
      key: 'music',
      label: isBgmOn ? 'Music On' : 'Music Off',
      iconName: isBgmOn ? 'volume-high' : 'volume-mute',
      onPress: onSpeakerPress,
    },
    {
      key: 'settings',
      label: 'Settings',
      iconName: 'settings-outline' as const,
      onPress: onSettingsPress,
    },
  ];

  // Hide overlay UI during call (only keep swipe handler for consistent behavior)
  if (isInCall) {
    return (
      <View
        style={[styles.container, safeAreaPadding, style]}
        {...panResponder.panHandlers}
        {...rest}
        pointerEvents="box-none"
      />
    );
  }

  return (
    <View
      style={[styles.container, safeAreaPadding, style]}
      {...panResponder.panHandlers}
      {...rest}
    >
      <View style={styles.leftColumn} pointerEvents="box-none">
        {/* Empty left column */}
      </View>

      <View style={styles.rightColumn} pointerEvents="box-none">
        {menuItems.map((item, index) => {
          // Show only first 2 items when collapsed
          const shouldShow = isExpanded || index < 3;

          if (!shouldShow) return null;

          return (
            <AnimatedMenuItem
              key={item.key}
              label={item.label}
              iconName={item.iconName as IoniconName}
              isStreakButton={item.isStreakButton}
              streak={loginStreak}
              onPress={item.onPress}
              iconColor={iconColor}
              isExpanded={isExpanded}
              index={index}
              expandAnimation={expandAnimation}
            />
          );
        })}

        {/* Expand/Collapse button */}
        <Pressable style={styles.expandRow} onPress={handleToggleExpand}>
          {isExpanded && (
            <Animated.Text
              style={[
                styles.menuLabel,
                { opacity: expandAnimation }
              ]}
            >
              Close
            </Animated.Text>
          )}
          <Animated.View style={[styles.expandButton, arrowRotationStyle]}>
            <Ionicons name={isExpanded ? "chevron-down" : "chevron-up"} size={20} color={iconColor} />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
};

type IoniconName = keyof typeof Ionicons.glyphMap;

// Animated menu item component
const AnimatedMenuItem: React.FC<{
  label: string;
  iconName?: IoniconName;
  isStreakButton?: boolean;
  streak?: number;
  onPress?: () => void;
  iconColor: string;
  isExpanded: boolean;
  index: number;
  expandAnimation: Animated.Value;
}> = ({
  label,
  iconName,
  isStreakButton,
  streak = 0,
  onPress,
  iconColor,
  isExpanded,
  index,
  expandAnimation,
}) => {
    // Create individual animation for staggered effect
    const itemAnimation = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

    useEffect(() => {
      Animated.spring(itemAnimation, {
        toValue: isExpanded ? 1 : 0,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
        delay: isExpanded ? index * 30 : 0, // Faster stagger
      }).start();
    }, [isExpanded, index]);

    // Text opacity animation - only show when expanded
    const textOpacity = itemAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    // Text translate animation
    const textTranslateX = itemAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [20, 0],
    });

    return (
      <Pressable style={styles.menuItemRow} onPress={onPress}>
        {/* Animated label - only visible when expanded */}
        <Animated.View
          style={[
            styles.labelContainer,
            {
              opacity: textOpacity,
              transform: [{ translateX: textTranslateX }],
            },
          ]}
        >
          <Text style={styles.menuLabel}>{label}</Text>
        </Animated.View>

        {/* Icon button */}
        {isStreakButton ? (
          <View style={styles.streakFlameContainer}>
            <StreakIcon width={50} height={50} />
            <View style={styles.streakNumberContainer}>
              <Text style={styles.streakNumber}>{streak}</Text>
            </View>
          </View>
        ) : (
          <LiquidGlass style={styles.iconButtonGlass} onPress={onPress}>
            <Ionicons name={iconName!} size={18} color={iconColor} />
          </LiquidGlass>
        )}
      </Pressable>
    );
  };

const IconButton: React.FC<{
  iconName: IoniconName;
  onPress?: () => void;
  highlight?: boolean;
  badgeCount?: number;
  showBadge?: boolean;
  iconColor?: string;
}> = ({ iconName, onPress, highlight, badgeCount, showBadge, iconColor = '#fff' }) => {
  const shouldShowBadge = showBadge || (badgeCount !== undefined && badgeCount > 0);

  return (
    <View style={styles.iconButtonContainer}>
      <LiquidGlass style={styles.iconButtonGlass} onPress={onPress}>
        <Ionicons name={iconName} size={18} color={iconColor} />
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
    gap: 12,
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
  streakFlameContainer: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  streakNumberContainer: {
    position: "absolute",
    top: 14,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  streakNumber: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  // Menu item styles
  menuItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  labelContainer: {
    // Container for animated label
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  expandButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  expandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
});
