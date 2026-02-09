import React, { useMemo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, Keyboard, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
    IconMicrophone,
    IconMicrophoneOff,
    IconVideo,
    IconVideoOff,
    IconPhoneOff,
    IconSend2,
    IconSparkles,
} from '@tabler/icons-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withRepeat,
    withTiming,
    Easing,
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';

type Props = {
    value: string;
    onChangeText: (text: string) => void;
    onSend: () => void;
    onToggleMic?: () => void;
    onVideoCall?: () => void;
    isVideoCallActive?: boolean;
    isVoiceCallActive?: boolean;
    isMicMuted?: boolean;
    isUserSpeaking?: boolean;
    placeholder?: string;
    disabled?: boolean;
    voiceLoading?: boolean;
    isDarkBackground?: boolean;
};

export const ChatInputBarV2: React.FC<Props> = ({
    value,
    onChangeText,
    onSend,
    onToggleMic,
    onVideoCall,
    isVideoCallActive = false,
    isVoiceCallActive = false,
    isMicMuted = false,
    isUserSpeaking = false,
    placeholder = 'Message...',
    disabled,
    voiceLoading,
    isDarkBackground = true,
}) => {
    const showSend = useMemo(() => value.trim().length > 0, [value]);
    const isCallActive = isVoiceCallActive || isVideoCallActive;

    // Animations
    const sendButtonScale = useSharedValue(1);
    const micPulse = useSharedValue(1);
    const inputFocus = useSharedValue(0);

    // Pulsing for speaking indicator
    useEffect(() => {
        if (isUserSpeaking) {
            micPulse.value = withRepeat(
                withTiming(1.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            );
        } else {
            micPulse.value = withSpring(1);
        }
    }, [isUserSpeaking]);

    const micPulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: micPulse.value }],
        opacity: 2 - micPulse.value,
    }));

    const sendButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: sendButtonScale.value }],
    }));

    const inputBorderStyle = useAnimatedStyle(() => ({
        borderColor: `rgba(167, 139, 250, ${inputFocus.value * 0.5 + 0.15})`,
    }));

    // Keyboard handling
    const [isKeyboardVisible, setKeyboardVisible] = React.useState(false);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const keyboardShowListener = Keyboard.addListener(showEvent, () => {
            setKeyboardVisible(true);
            inputFocus.value = withSpring(1);
        });
        const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
            setKeyboardVisible(false);
            inputFocus.value = withSpring(0);
        });

        return () => {
            keyboardShowListener.remove();
            keyboardHideListener.remove();
        };
    }, []);

    const handleSend = () => {
        if (disabled || !value.trim()) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        sendButtonScale.value = withSpring(0.8, {}, () => {
            sendButtonScale.value = withSpring(1);
        });
        onSend();
    };

    const handleMicPress = () => {
        if (!onToggleMic || voiceLoading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onToggleMic();
    };

    return (
        <View style={styles.container}>
            {/* Left Action Buttons */}
            {!isKeyboardVisible && (
                <View style={styles.leftActions}>
                    {/* Voice/End Call Button */}
                    {onToggleMic && (
                        <Pressable onPress={handleMicPress} style={styles.actionButton}>
                            <View style={styles.actionButtonInner}>
                                {isUserSpeaking && (
                                    <Animated.View style={[styles.speakingRing, micPulseStyle]} />
                                )}
                                {isCallActive ? (
                                    <LinearGradient
                                        colors={['#ef4444', '#dc2626']}
                                        style={styles.endCallGradient}
                                    >
                                        <IconPhoneOff size={20} color="#fff" />
                                    </LinearGradient>
                                ) : (
                                    <BlurView intensity={40} tint="dark" style={styles.micButton}>
                                        <IconMicrophone size={20} color="#fff" />
                                    </BlurView>
                                )}
                            </View>
                        </Pressable>
                    )}
                </View>
            )}

            {/* Main Input Container */}
            <Animated.View style={[styles.inputContainer, inputBorderStyle]}>
                <BlurView intensity={50} tint="dark" style={styles.inputBlur}>
                    <View style={styles.inputRow}>
                        {/* Sparkle Icon */}
                        <View style={styles.sparkleIcon}>
                            <IconSparkles size={16} color="rgba(167,139,250,0.8)" />
                        </View>

                        {/* Text Input */}
                        <TextInput
                            style={styles.input}
                            value={value}
                            onChangeText={onChangeText}
                            placeholder={placeholder}
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            editable={!disabled}
                            returnKeyType="send"
                            onSubmitEditing={handleSend}
                            multiline
                            maxLength={500}
                        />

                        {/* Send Button */}
                        {showSend && (
                            <Animated.View entering={FadeIn} exiting={FadeOut} style={sendButtonStyle}>
                                <Pressable onPress={handleSend} disabled={disabled}>
                                    <LinearGradient
                                        colors={['#a78bfa', '#8b5cf6']}
                                        style={styles.sendButton}
                                    >
                                        <IconSend2 size={18} color="#fff" />
                                    </LinearGradient>
                                </Pressable>
                            </Animated.View>
                        )}
                    </View>
                </BlurView>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
    },
    leftActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    actionButton: {
        position: 'relative',
    },
    actionButtonInner: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    speakingRing: {
        position: 'absolute',
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(74, 222, 128, 0.3)',
        borderWidth: 2,
        borderColor: '#4ade80',
    },
    micButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    endCallGradient: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inputContainer: {
        flex: 1,
        borderRadius: 28,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.15)',
        overflow: 'hidden',
    },
    inputBlur: {
        borderRadius: 28,
        overflow: 'hidden',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 14,
        paddingRight: 6,
        paddingVertical: 8,
        minHeight: 52,
    },
    sparkleIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        maxHeight: 100,
        paddingVertical: 0,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
});

export default ChatInputBarV2;
