import React, { useMemo, useState } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    ViewProps,
    PanResponder,
    Keyboard,
    Dimensions,
} from "react-native";
import { BlurView } from 'expo-blur';
import { Svg, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    IconMapPin,
    IconPhone,
    IconShirt,
    IconMessage2,
    IconWoman,
    IconSettings,
} from '@tabler/icons-react-native';
import * as Haptics from "expo-haptics";
import { HapticPressable } from "../ui/HapticPressable";
import DiamondPinkIcon from "../../assets/icons/diamond-pink.svg";
import { useSceneActions } from "../../context/SceneActionsContext";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

type VRMUIOverlayProps = ViewProps & {
    hasMessages?: boolean;
    showChatList?: boolean;
    loginStreak?: number;
    isDarkBackground?: boolean;
    canClaimCalendar?: boolean;
    isBgmOn?: boolean;
    isInCall?: boolean;
    remainingQuotaSeconds?: number;
    onBackgroundPress?: () => void;
    onCostumePress?: () => void;
    onCalendarPress?: () => void;
    onToggleChatList?: () => void;
    onSettingsPress?: () => void;
    onSpeakerPress?: () => void;
    onDancePress?: () => void;
    onSwipeBackground?: (offset: number) => void;
    onSwipeCharacter?: (offset: number) => void;
    isChatScrolling?: boolean;
    canSwipeCharacter?: boolean;
    isPro?: boolean;
    isHidden?: boolean;
};

interface ActionButtonProps {
    icon: React.ElementType;
    label: string;
    onPress?: () => void;
    isActive?: boolean;
    isPro?: boolean;
    isProUser?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
    icon: Icon,
    label,
    onPress,
    isActive,
    isPro,
    isProUser,
}) => {
    const showProBadge = isPro && !isProUser;

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
    };

    return (
        <HapticPressable onPress={handlePress} style={styles.actionButton}>
            <View style={[styles.actionIconContainer, isActive && styles.actionIconActive]}>
                <Icon size={22} color="#fff" strokeWidth={1.8} />
                {showProBadge && (
                    <View style={styles.proBadge}>
                        <DiamondPinkIcon width={8} height={8} />
                    </View>
                )}
            </View>
            <Text style={styles.actionLabel}>{label}</Text>
        </HapticPressable>
    );
};

export const VRMUIOverlay: React.FC<VRMUIOverlayProps> = ({
    style,
    showChatList,
    isDarkBackground = true,
    isInCall = false,
    remainingQuotaSeconds = 0,
    onBackgroundPress,
    onCostumePress,
    onToggleChatList,
    onSettingsPress,
    onDancePress,
    onSwipeCharacter,
    isChatScrolling = false,
    canSwipeCharacter = false,
    isPro: isProUser = false,
    isHidden = false,
    ...rest
}) => {
    if (isHidden) return null;

    const sceneActions = useSceneActions();
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    const isTablet = Math.min(screenWidth, screenHeight) >= 600;

    // PanResponder for swipe gestures
    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => {
                    if (isInCall || isChatScrolling) return false;
                    return true;
                },
                onMoveShouldSetPanResponder: (evt, gestureState) => {
                    if (isInCall || isChatScrolling) return false;
                    const { pageX } = evt.nativeEvent;
                    const isVerticalGesture = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
                    const isFromChatArea = pageX < 300;
                    if (isVerticalGesture && isFromChatArea) return false;
                    return Math.abs(gestureState.dx) > 20 || Math.abs(gestureState.dy) > 20;
                },
                onPanResponderRelease: (_, gestureState) => {
                    if (isChatScrolling) return;
                    const { dx, dy } = gestureState;

                    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40 && onToggleChatList) {
                        if (dx < 0 && showChatList) {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onToggleChatList();
                        } else if (dx > 0 && !showChatList) {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onToggleChatList();
                        }
                    } else if (Math.abs(dy) > 40 && canSwipeCharacter && onSwipeCharacter) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onSwipeCharacter(dy < 0 ? 1 : -1);
                    } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                        Keyboard.dismiss();
                    }
                },
            }),
        [isInCall, isChatScrolling, canSwipeCharacter, showChatList, onToggleChatList, onSwipeCharacter]
    );

    const formatRemainingTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Call progress ring calculation
    const maxQuota = isProUser ? 1800 : 30;
    const quotaProgress = Math.min(remainingQuotaSeconds / maxQuota, 1);

    return (
        <View
            style={[styles.container, style]}
            {...panResponder.panHandlers}
            {...rest}
            pointerEvents="box-none"
        >
            {/* Top Left - Pro Badge / Call Time */}
            <Animated.View
                entering={FadeIn}
                style={[styles.topLeft, { top: insets.top + (isTablet ? 32 : 12) }]}
            >
                {!isProUser && !isInCall && (
                    <HapticPressable onPress={() => sceneActions?.openSubscription()}>
                        <BlurView intensity={40} tint="dark" style={styles.proPill}>
                            <DiamondPinkIcon width={18} height={18} />
                            <Text style={styles.proPillText}>PRO</Text>
                        </BlurView>
                    </HapticPressable>
                )}

                {/* Call Time Indicator */}
                <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        // Show call time info
                    }}
                >
                    <BlurView intensity={40} tint="dark" style={styles.callTimePill}>
                        <View style={styles.callTimeRing}>
                            <Svg width={32} height={32}>
                                <Circle
                                    cx={16}
                                    cy={16}
                                    r={14}
                                    stroke="rgba(255,255,255,0.2)"
                                    strokeWidth={2}
                                    fill="none"
                                />
                                <Circle
                                    cx={16}
                                    cy={16}
                                    r={14}
                                    stroke="#4ade80"
                                    strokeWidth={2}
                                    fill="none"
                                    strokeDasharray={`${2 * Math.PI * 14}`}
                                    strokeDashoffset={`${2 * Math.PI * 14 * (1 - quotaProgress)}`}
                                    strokeLinecap="round"
                                    rotation="-90"
                                    origin="16, 16"
                                />
                            </Svg>
                            <IconPhone size={14} color="#fff" style={styles.callTimeIcon} />
                        </View>
                        {(isInCall || remainingQuotaSeconds > 0) && (
                            <Text style={styles.callTimeText}>
                                {formatRemainingTime(remainingQuotaSeconds)}
                            </Text>
                        )}
                    </BlurView>
                </Pressable>
            </Animated.View>

            {/* Floating Action Bar at Bottom */}
            {!isInCall && (
                <Animated.View
                    entering={SlideInDown.springify().damping(15)}
                    exiting={SlideOutDown}
                    style={[styles.actionBarContainer, { bottom: insets.bottom + 16 }]}
                >
                    <BlurView intensity={50} tint="dark" style={styles.actionBar}>
                        <ActionButton
                            icon={IconMapPin}
                            label="Scene"
                            onPress={onBackgroundPress}
                        />
                        <ActionButton
                            icon={IconShirt}
                            label="Outfit"
                            onPress={onCostumePress}
                        />
                        <ActionButton
                            icon={IconWoman}
                            label="Dance"
                            onPress={onDancePress}
                            isPro={true}
                            isProUser={isProUser}
                        />
                        <ActionButton
                            icon={IconMessage2}
                            label="Chat"
                            onPress={onToggleChatList}
                            isActive={showChatList}
                        />
                        <ActionButton
                            icon={IconSettings}
                            label="More"
                            onPress={onSettingsPress}
                        />
                    </BlurView>
                </Animated.View>
            )}

            {/* In-Call Minimal UI */}
            {isInCall && (
                <Animated.View
                    entering={FadeIn}
                    exiting={FadeOut}
                    style={[styles.inCallBadge, { bottom: insets.bottom + 40 }]}
                >
                    <BlurView intensity={60} tint="dark" style={styles.inCallPill}>
                        <View style={styles.inCallDot} />
                        <Text style={styles.inCallText}>
                            In Call • {formatRemainingTime(remainingQuotaSeconds)}
                        </Text>
                    </BlurView>
                </Animated.View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
    },
    topLeft: {
        position: 'absolute',
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    proPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 92, 168, 0.4)',
        backgroundColor: 'rgba(255, 92, 168, 0.2)',
    },
    proPillText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.5,
    },
    callTimePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 4,
        paddingRight: 12,
        paddingVertical: 4,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    callTimeRing: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    callTimeIcon: {
        position: 'absolute',
    },
    callTimeText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
    },
    actionBarContainer: {
        position: 'absolute',
        left: 16,
        right: 16,
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    actionButton: {
        alignItems: 'center',
        gap: 4,
        minWidth: 56,
    },
    actionIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionIconActive: {
        backgroundColor: 'rgba(255, 107, 157, 0.3)',
    },
    actionLabel: {
        fontSize: 11,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.8)',
    },
    proBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 92, 168, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#fff',
    },
    inCallBadge: {
        position: 'absolute',
        alignSelf: 'center',
    },
    inCallPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.4)',
    },
    inCallDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4ade80',
    },
    inCallText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
});
