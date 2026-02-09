import React, { useMemo, useRef, useEffect, useState } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    ViewProps,
    PanResponder,
    Keyboard,
    Dimensions,
    Animated,
} from "react-native";
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    IconMapPin,
    IconPhone,
    IconShirt,
    IconMessage2,
    IconWoman,
    IconSettings,
    IconSparkles,
    IconPhoneCall,
    IconUsers,
    IconX,
    IconMenu2,
} from '@tabler/icons-react-native';
import * as Haptics from "expo-haptics";
import { HapticPressable } from "../ui/HapticPressable";
import DiamondPinkIcon from "../../assets/icons/diamond-pink.svg";
import { useSceneActions } from "../../context/SceneActionsContext";
import ReAnimated, { FadeIn, FadeOut, SlideInUp, useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming, Easing } from 'react-native-reanimated';

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
    onMultiplayerPress?: () => void;
    onSwipeBackground?: (offset: number) => void;
    onSwipeCharacter?: (offset: number) => void;
    isChatScrolling?: boolean;
    canSwipeCharacter?: boolean;
    isPro?: boolean;
    isHidden?: boolean;
};

// Animated Gradient Border Button
const GradientBorderButton: React.FC<{
    icon: React.ElementType;
    label: string;
    onPress?: () => void;
    isActive?: boolean;
    showBadge?: boolean;
}> = ({ icon: Icon, label, onPress, isActive, showBadge }) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.92);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
    };

    return (
        <ReAnimated.View style={animatedStyle}>
            <Pressable
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={styles.gradientButtonWrapper}
            >
                <LinearGradient
                    colors={isActive ? ['#a78bfa', '#8b5cf6', '#a78bfa'] : ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.15)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientBorder}
                >
                    <View style={[styles.buttonInner, isActive && styles.buttonInnerActive]}>
                        <Icon size={20} color="#fff" strokeWidth={1.8} />
                        {showBadge && (
                            <View style={styles.sparkBadge}>
                                <IconSparkles size={8} color="#fff" />
                            </View>
                        )}
                    </View>
                </LinearGradient>
                <Text style={[styles.buttonLabel, isActive && styles.buttonLabelActive]}>{label}</Text>
            </Pressable>
        </ReAnimated.View>
    );
};

// Pulsing Call Indicator
const PulsingCallIndicator: React.FC<{ remainingSeconds: number }> = ({ remainingSeconds }) => {
    const pulse = useSharedValue(1);

    useEffect(() => {
        pulse.value = withRepeat(
            withTiming(1.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
        opacity: 2 - pulse.value,
    }));

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <View style={styles.callIndicator}>
            <ReAnimated.View style={[styles.callPulseRing, pulseStyle]} />
            <View style={styles.callCore}>
                <IconPhoneCall size={16} color="#4ade80" />
            </View>
            <Text style={styles.callTimeText}>{formatTime(remainingSeconds)}</Text>
        </View>
    );
};

// Collapsible Sidebar Menu (Right side, toggle to expand/collapse)
const CollapsibleSidebarMenu: React.FC<{
    actions: Array<{
        icon: React.ElementType;
        label: string;
        onPress?: () => void;
        isActive?: boolean;
        showBadge?: boolean;
    }>;
    bottomInset: number;
}> = ({ actions, bottomInset }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const expandAnim = useSharedValue(0);

    const toggleExpand = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsExpanded(!isExpanded);
        expandAnim.value = withTiming(isExpanded ? 0 : 1, { duration: 250, easing: Easing.out(Easing.ease) });
    };

    const menuStyle = useAnimatedStyle(() => ({
        opacity: expandAnim.value,
        transform: [
            { translateY: (1 - expandAnim.value) * 30 },
        ],
    }));

    const toggleButtonStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${expandAnim.value * 90}deg` }],
    }));

    return (
        <View style={[styles.sidebarContainer, { bottom: bottomInset + 120 }]}>
            {/* Expanded Menu */}
            <ReAnimated.View style={[styles.expandedMenu, menuStyle]} pointerEvents={isExpanded ? 'auto' : 'none'}>
                <BlurView intensity={50} tint="dark" style={styles.sidebarBlur}>
                    <View style={styles.sidebarInner}>
                        {actions.map((action, index) => (
                            <GradientBorderButton
                                key={index}
                                icon={action.icon}
                                label={action.label}
                                onPress={() => {
                                    action.onPress?.();
                                    setIsExpanded(false);
                                    expandAnim.value = withSpring(0);
                                }}
                                isActive={action.isActive}
                                showBadge={action.showBadge}
                            />
                        ))}
                    </View>
                </BlurView>
                <View style={styles.sidebarGlow} />
            </ReAnimated.View>

            {/* Toggle Button */}
            <Pressable onPress={toggleExpand} style={styles.toggleButton}>
                <BlurView intensity={60} tint="dark" style={styles.toggleButtonBlur}>
                    {isExpanded ? (
                        <IconX size={24} color="#fff" />
                    ) : (
                        <IconMenu2 size={24} color="#fff" />
                    )}
                </BlurView>
            </Pressable>
        </View>
    );
};

export const VRMUIOverlayV2: React.FC<VRMUIOverlayProps> = ({
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
    onMultiplayerPress,
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

    const menuActions = [
        { icon: IconMapPin, label: 'Scene', onPress: onBackgroundPress },
        { icon: IconShirt, label: 'Style', onPress: onCostumePress },
        { icon: IconUsers, label: 'Party', onPress: onMultiplayerPress },
        { icon: IconWoman, label: 'Dance', onPress: onDancePress, showBadge: !isProUser },
        { icon: IconMessage2, label: 'Chat', onPress: onToggleChatList, isActive: showChatList },
        { icon: IconSettings, label: 'More', onPress: onSettingsPress },
    ];

    return (
        <View
            style={[styles.container, style]}
            {...panResponder.panHandlers}
            {...rest}
            pointerEvents="box-none"
        >
            {/* Top Bar */}
            <ReAnimated.View
                entering={SlideInUp.springify().damping(12)}
                style={[styles.topBar, { paddingTop: insets.top + (isTablet ? 30 : 20) }]}
            >
                {/* PRO Badge with animated gradient */}
                {!isProUser && !isInCall && (
                    <HapticPressable onPress={() => sceneActions?.openSubscription()}>
                        <MaskedView
                            maskElement={
                                <View style={styles.proBadgeMask}>
                                    <DiamondPinkIcon width={16} height={16} />
                                    <Text style={styles.proBadgeTextMask}>PRO</Text>
                                </View>
                            }
                        >
                            <LinearGradient
                                colors={['#ff6b9d', '#ffd93d', '#6dd5ed', '#ff6b9d']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.proBadgeGradient}
                            />
                        </MaskedView>
                        <BlurView intensity={30} tint="dark" style={styles.proBadgeBlur}>
                            <DiamondPinkIcon width={16} height={16} />
                            <Text style={styles.proBadgeText}>PRO</Text>
                        </BlurView>
                    </HapticPressable>
                )}

                {/* Call Indicator */}
                {(isInCall || remainingQuotaSeconds > 0) && (
                    <PulsingCallIndicator remainingSeconds={remainingQuotaSeconds} />
                )}
            </ReAnimated.View>

            {/* Right Vertical Sidebar Menu */}
            {!isInCall && (
                <CollapsibleSidebarMenu actions={menuActions} bottomInset={insets.bottom} />
            )}

            {/* In-Call Floating Badge */}
            {isInCall && (
                <ReAnimated.View
                    entering={FadeIn}
                    exiting={FadeOut}
                    style={[styles.inCallBadgeContainer, { bottom: insets.bottom + 40 }]}
                >
                    <LinearGradient
                        colors={['rgba(74, 222, 128, 0.2)', 'rgba(34, 197, 94, 0.1)']}
                        style={styles.inCallBadge}
                    >
                        <View style={styles.inCallDot} />
                        <Text style={styles.inCallText}>Live Call</Text>
                    </LinearGradient>
                </ReAnimated.View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
    },
    topBar: {
        paddingHorizontal: 16,
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 10,
    },
    proBadgeBlur: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(167, 139, 250, 0.5)',
    },
    proBadgeMask: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    proBadgeTextMask: {
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 1,
    },
    proBadgeGradient: {
        height: 36,
        width: 80,
    },
    proBadgeText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 1,
    },
    callIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        paddingLeft: 8,
        paddingRight: 14,
        paddingVertical: 10,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.4)',
        height: 44,
    },
    callPulseRing: {
        position: 'absolute',
        left: 6,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(74, 222, 128, 0.3)',
    },
    callCore: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(167, 139, 250, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.5)',
    },
    callTimeText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#4ade80',
        fontVariant: ['tabular-nums'],
    },
    // Vertical Sidebar styles
    sidebarContainer: {
        position: 'absolute',
        right: 12,
    },
    sidebarBlur: {
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    sidebarInner: {
        flexDirection: 'column',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 10,
        gap: 4,
    },
    sidebarGlow: {
        position: 'absolute',
        right: -10,
        top: '20%',
        bottom: '20%',
        width: 20,
        backgroundColor: 'rgba(167, 139, 250, 0.15)',
        borderRadius: 100,
        transform: [{ scaleX: 0.5 }],
    },
    expandedMenu: {
        position: 'absolute',
        right: 0,
        bottom: 60,
    },
    toggleButton: {
        position: 'absolute',
        right: 0,
        bottom: 0,
    },
    toggleButtonBlur: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(167, 139, 250, 0.4)',
    },
    gradientButtonWrapper: {
        alignItems: 'center',
        gap: 6,
    },
    gradientBorder: {
        padding: 2,
        borderRadius: 20,
    },
    buttonInner: {
        width: 44,
        height: 44,
        borderRadius: 18,
        backgroundColor: 'rgba(20, 20, 30, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonInnerActive: {
        backgroundColor: 'rgba(167, 139, 250, 0.2)',
    },
    buttonLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.7)',
    },
    buttonLabelActive: {
        color: '#a78bfa',
    },
    sparkBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#ffd93d',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(20, 20, 30, 1)',
    },
    inCallBadgeContainer: {
        position: 'absolute',
        alignSelf: 'center',
    },
    inCallBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.4)',
    },
    inCallDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#4ade80',
    },
    inCallText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.5,
    },
});

export default VRMUIOverlayV2;
