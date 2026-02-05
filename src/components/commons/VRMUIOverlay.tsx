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
  Keyboard,
  Alert,
} from "react-native";
import { LiquidGlassView } from '@callstack/liquid-glass';
import { Svg, Circle } from 'react-native-svg';

import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  IconPhoto,
  IconVolume,
  IconVolumeOff,
  IconChevronDown,
  IconChevronUp,
  IconHanger,
  IconMessageOff,
  IconMessageCircle,
  IconMessageCircleOff,
  IconPhone,
  IconShirt,
  IconMapPin,
  IconMessage2,
  IconMusic,
  IconMusicOff,
  IconWoman,
} from '@tabler/icons-react-native';
import * as Haptics from "expo-haptics";
import { LiquidGlass } from "./LiquidGlass";
import { HapticPressable } from "../ui/HapticPressable";
import { NotificationDot } from "../ui/NotificationDot";
import StreakIcon from "../../assets/icons/streak.svg";
import DiamondPinkIcon from "../../assets/icons/diamond-pink.svg";
import { useSceneActions } from "../../context/SceneActionsContext";

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
  remainingQuotaSeconds?: number; // Show remaining call time when in call

  onBackgroundPress?: () => void;
  onCostumePress?: () => void;
  onCalendarPress?: () => void;
  onToggleChatList?: () => void;
  onSettingsPress?: () => void;
  onSpeakerPress?: () => void;
  onDancePress?: () => void;

  // Swipe gesture handlers
  onSwipeBackground?: (offset: number) => void;
  onSwipeCharacter?: (offset: number) => void;
  isChatScrolling?: boolean;
  canSwipeCharacter?: boolean;
  isPro?: boolean;
  isHidden?: boolean;
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
  remainingQuotaSeconds = 0,
  onBackgroundPress,
  onCostumePress,
  onCalendarPress,
  onToggleChatList,
  onSettingsPress,
  onSpeakerPress,
  onDancePress,
  onSwipeBackground,
  onSwipeCharacter,
  isChatScrolling = false,
  canSwipeCharacter = false,
  isPro: isProUser = false,
  isHidden = false,
  ...rest
}) => {
  if (isHidden) return null;

  const [isExpanded, setIsExpanded] = useState(false);
  const [showQuotaLabel, setShowQuotaLabel] = useState(false);
  const sceneActions = useSceneActions();
  // ... rest of component

  // Animation values
  const expandAnimation = useRef(new Animated.Value(0)).current;
  const arrowRotation = useRef(new Animated.Value(0)).current;

  // PanResponder for swipe gestures
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => {
          if (isInCall) return false;
          if (isChatScrolling) return false;
          return true;
        },
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          // Disable swipe during call
          if (isInCall) return false;
          if (isChatScrolling) return false;

          // Don't capture vertical gestures from left side (chat area ~85% width)
          const { pageX } = evt.nativeEvent;
          const isVerticalGesture = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
          const isFromChatArea = pageX < 300; // Approximate chat area width

          if (isVerticalGesture && isFromChatArea) {
            return false; // Let ScrollView handle vertical scrolling in chat area
          }

          return Math.abs(gestureState.dx) > 20 || Math.abs(gestureState.dy) > 20;
        },
        onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
          // Disable swipe during call
          if (isInCall) return false;
          if (isChatScrolling) return false;

          // Don't capture vertical gestures from left side (chat area)
          const { pageX } = evt.nativeEvent;
          const isVerticalGesture = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
          const isFromChatArea = pageX < 300;

          if (isVerticalGesture && isFromChatArea) {
            return false; // Let ScrollView handle vertical scrolling in chat area
          }

          return Math.abs(gestureState.dx) > 20 || Math.abs(gestureState.dy) > 20;
        },
        onPanResponderGrant: () => {
          // Only provide haptic feedback if we're treating this as a potential swipe or button press?
          // Actually, grant happens immediately on tap now.
          // We might want to avoid haptic on every tap if it's annoying.
          // But original code had it on grant.
          // Let's keep it or move it?
          // If we tap to dismiss keyboard, we probably don't want impact?
          // Original code: Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // If I return true on start, this fires on every tap.
          // I will comment it out or leave it if touch feedback is desired.
          // The user mentions "check why... keyboard not dismissed", implies they want it to work like normal background.
          // Normal background doesn't vibrate.
          // So I will remove the haptic from Grant, and only do it on meaningful action (Swipe).
        },
        onPanResponderRelease: (_, gestureState) => {
          if (isChatScrolling) return;
          const dx = gestureState.dx;
          const dy = gestureState.dy;

          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40 && onToggleChatList) {
            // Swipe Left (dx < 0) -> Hide (if shown)
            if (dx < 0 && showChatList) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onToggleChatList();
            }
            // Swipe Right (dx > 0) -> Show (if hidden)
            else if (dx > 0 && !showChatList) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onToggleChatList();
            }
          } else if (Math.abs(dy) > 40 && canSwipeCharacter && onSwipeCharacter) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSwipeCharacter(dy < 0 ? 1 : -1);
          } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
            // Tap detected (small movement)
            Keyboard.dismiss();
          }
        },
      }),
    [isInCall, isChatScrolling, onSwipeBackground, onSwipeCharacter, canSwipeCharacter, showChatList, onToggleChatList]
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
  const menuItems: {
    key: string;
    label: string;
    Icon?: React.ElementType;
    iconProps?: any;
    isStreakButton?: boolean;
    onPress?: () => void;
    isPro?: boolean;
  }[] = [
      // {
      //   key: 'streak',
      //   label: 'Streak',
      //   isStreakButton: true,
      //   onPress: onCalendarPress,
      // },

      {
        key: 'outfit',
        label: 'Outfit',
        Icon: IconShirt,
        onPress: onCostumePress,
      },
      {
        key: 'background',
        label: 'Background',
        Icon: IconMapPin,
        onPress: onBackgroundPress,
      },
      {
        key: 'dance',
        label: 'Dance',
        Icon: IconWoman,
        onPress: onDancePress,
        isPro: true
      },
      {
        key: 'messages',
        label: showChatList ? 'Hide Chat' : 'Show Chat',
        Icon: !showChatList ? IconMessage2 : IconMessageOff,
        onPress: onToggleChatList,
      },
      // {
      //   key: 'music',
      //   label: isBgmOn ? 'Music On' : 'Music Off',
      //   Icon: isBgmOn ? IconMusic : IconMusicOff,
      //   onPress: onSpeakerPress,
      // },

      // {
      //   key: 'settings',
      //   label: 'Settings',
      //   Icon: IconSettings,
      //   onPress: onSettingsPress,
      // },
    ];

  // Format remaining time
  const formatRemainingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Removed separate isInCall view - call quota button now shows remaining time for both states

  const ChevronIcon = isExpanded ? IconChevronDown : IconChevronUp;

  return (
    <View
      style={[styles.container, safeAreaPadding, style]}
      {...panResponder.panHandlers}
      {...rest}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: '#000',
            opacity: expandAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.2], // Using 0.2 for better contrast, roughly 0.1 as requested
            }),
            zIndex: -1,
          },
        ]}
        pointerEvents="none"
      />
      <View style={styles.leftColumn} pointerEvents="box-none">
        {/* Go Pro button - only for non-Pro users AND when NOT in a call */}
        {!isProUser && !isInCall && (
          <View style={styles.menuItemRowLeft}>
            <View style={styles.iconButtonContainer}>
              <HapticPressable onPress={() => sceneActions?.openSubscription()}>
                <LiquidGlassView style={styles.iconButtonGlass} interactive={true}>
                  <View style={styles.premiumButton}>
                    <View style={styles.premiumIconContainer}>
                      <DiamondPinkIcon width={24} height={24} />
                    </View>
                  </View>
                  <NotificationDot />
                </LiquidGlassView>

              </HapticPressable>

            </View>
            {isExpanded && (
              <Animated.Text style={[
                styles.menuLabel,
                { opacity: expandAnimation }
              ]}>
                Unlock All
              </Animated.Text>
            )}
          </View>
        )}

        {/* Always show remaining call time */}
        {/* Always show remaining call time */}
        <View style={styles.callQuotaRow}>
          <LiquidGlass
            isDarkBackground={isDarkBackground}
            style={[styles.iconButtonGlass, { borderWidth: 0, paddingLeft: 0, paddingRight: 0 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const timeString = formatRemainingTime(remainingQuotaSeconds);
              const buttons = isProUser
                ? [{ text: "OK" }]
                : [
                  { text: "OK", style: "cancel" as const },
                  {
                    text: "Upgrade",
                    onPress: () => sceneActions?.openSubscription(),
                  },
                ];
              Alert.alert(
                "Call Time Remaining",
                `You have ${timeString} of voice call time remaining this month.${!isProUser ? "\n\nUpgrade to Pro for more call time!" : ""}`,
                buttons
              );
            }}
          >
            <Svg width={44} height={44} style={StyleSheet.absoluteFill}>
              <Circle
                cx={22}
                cy={22}
                r={21}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={2}
                fill="none"
              />
              <Circle
                cx={22}
                cy={22}
                r={21}
                stroke="white"
                strokeWidth={2}
                fill="none"
                strokeDasharray={`${2 * Math.PI * 21}`}
                strokeDashoffset={`${2 * Math.PI * 21 * (1 - Math.min(remainingQuotaSeconds / (isProUser ? 1800 : 30), 1))}`}
                strokeLinecap="round"
                rotation="-90"
                origin="22, 22"
              />
            </Svg>
            <IconPhone size={20} color={iconColor} />
          </LiquidGlass>
          {(isExpanded || isInCall || showQuotaLabel) && (
            <Animated.Text style={[
              styles.menuLabel,
              { opacity: (isInCall || showQuotaLabel) ? 1 : expandAnimation }
            ]}>
              Call Time {formatRemainingTime(remainingQuotaSeconds)}
            </Animated.Text>
          )}
        </View>
      </View>

      <View style={styles.rightColumn} pointerEvents="box-none">
        {menuItems.map((item, index) => {
          // Show only first 2 items when collapsed
          const shouldShow = isExpanded || index < 3;

          if (!shouldShow) return null;

          // If in call, only show messages button
          if (isInCall && item.key !== 'messages') return null;

          return (
            <AnimatedMenuItem
              key={item.key}
              label={item.label}
              Icon={item.Icon}
              iconProps={item.iconProps}
              isStreakButton={item.isStreakButton}
              streak={loginStreak}
              onPress={item.onPress}
              iconColor={iconColor}
              isExpanded={isExpanded}
              index={index}
              expandAnimation={expandAnimation}
              isDarkBackground={isDarkBackground}
              isPro={item.isPro}
              isProUser={isProUser}
              onSubscribe={() => sceneActions?.openSubscription()}
            />
          );
        })}

        {/* Expand/Collapse button */}
        {!isInCall && (
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
              <ChevronIcon size={24} color={iconColor} />
            </Animated.View>
          </Pressable>
        )}
      </View>
    </View>
  );
};

// Animated menu item component
const AnimatedMenuItem: React.FC<{
  label: string;
  Icon?: React.ElementType;
  iconProps?: any;
  isStreakButton?: boolean;
  streak?: number;
  onPress?: () => void;
  iconColor: string;
  isExpanded: boolean;
  index: number;
  expandAnimation: Animated.Value;
  isDarkBackground?: boolean;
  isPro?: boolean;
  isProUser?: boolean;
  onSubscribe?: () => void;
}> = ({
  label,
  Icon,
  iconProps,
  isStreakButton,
  streak = 0,
  onPress,
  iconColor,
  isExpanded,
  index,
  expandAnimation,
  isDarkBackground,
  isPro, // Item requires Pro
  isProUser, // User status
  onSubscribe,
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

    const showProBadge = isPro && !isProUser;

    const handlePress = () => {
      if (showProBadge && onSubscribe) {
        onSubscribe();
      } else {
        onPress?.();
      }
    };

    return (
      <Pressable style={styles.menuItemRow} onPress={handlePress}>
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
          <LiquidGlass isDarkBackground={isDarkBackground} style={styles.iconButtonGlass} onPress={handlePress}>
            {Icon && <Icon width={22} height={22} color={iconColor}  {...iconProps} />}
            {showProBadge && (
              <View style={{
                position: 'absolute',
                top: -5,
                right: -5,
                backgroundColor: 'rgba(255, 92, 168, 0.2)',
                borderRadius: 8,
                paddingHorizontal: 4,
                paddingVertical: 3,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 2,
                borderWidth: 1,
                borderColor: '#ffffff50'
              }}>
                <DiamondPinkIcon width={10} height={10} />
              </View>
            )}
          </LiquidGlass>
        )}
      </Pressable>
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
    top: -1,
    right: -1,
    zIndex: 1,
  },
  badgeDot: {
    width: 15,
    height: 15,
    borderRadius: 100,
    backgroundColor: "#FF3B30",
    borderWidth: 2,
    borderColor: "#ffffffa5",
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
    fontSize: 15,
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
  remainingTimeBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  remainingTimeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  premiumButton: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#FF5CA8',
  },
  premiumIconContainer: {
    width: '100%',
    height: '100%',
    borderWidth: 2,
    borderColor: '#ffffff97',
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  callQuotaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 100,
  },
  callQuotaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  callQuotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuItemRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
