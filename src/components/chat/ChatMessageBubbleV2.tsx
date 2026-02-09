import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { IconPlayerPlay, IconLock, IconSparkles } from '@tabler/icons-react-native';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { useSubscription } from '../../context/SubscriptionContext';
import { useSceneActions } from '../../context/SceneActionsContext';
import type { ChatMessage } from '../../types/chat';

type Props = {
    message: ChatMessage;
    alignLeft?: boolean;
    onPress?: (message: ChatMessage) => void;
    variant?: 'compact' | 'full';
    index?: number;
};

export const ChatMessageBubbleV2: React.FC<Props> = ({
    message,
    alignLeft = true,
    onPress,
    variant = 'full',
    index = 0,
}) => {
    const isText = message.kind.type === 'text' || message.kind.type === 'system';
    const isMedia = message.kind.type === 'media';
    const isAgent = message.isAgent;

    const { isPro } = useSubscription();
    const sceneActions = useSceneActions();

    const mediaItem = message.kind.type === 'media' ? message.kind.mediaItem : null;
    const isLocked = isMedia && mediaItem?.tier === 'pro' && !isPro;

    const handlePress = () => {
        if (isMedia && isLocked) {
            sceneActions.openSubscription();
            return;
        }
        onPress?.(message);
    };

    const AnimatedContainer = isAgent ? FadeInLeft : FadeInRight;
    const delay = Math.min(index * 50, 200);

    return (
        <Animated.View
            entering={AnimatedContainer.delay(delay).springify()}
            style={[styles.container, alignLeft ? styles.leftAlign : styles.rightAlign]}
        >
            <Pressable
                onPress={handlePress}
                style={({ pressed }) => [pressed && styles.pressed]}
            >
                {isText && (
                    <View style={styles.bubbleWrapper}>
                        {isAgent ? (
                            // Agent message - Gradient border with glow
                            <View style={styles.agentBubbleOuter}>
                                <LinearGradient
                                    colors={['rgba(167,139,250,0.4)', 'rgba(139,92,246,0.4)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.agentGradientBorder}
                                >
                                    <BlurView intensity={30} tint="dark" style={styles.agentBubbleInner}>
                                        <View style={styles.agentHeader}>
                                            <IconSparkles size={12} color="#a78bfa" />
                                        </View>
                                        <Text style={styles.agentText}>
                                            {message.kind.type === 'text' ? message.kind.text : ''}
                                        </Text>
                                    </BlurView>
                                </LinearGradient>
                                {/* Glow effect */}
                                <View style={styles.agentGlow} />
                            </View>
                        ) : (
                            // User message - Clean dark bubble
                            <View style={styles.userBubble}>
                                <Text style={styles.userText}>
                                    {message.kind.type === 'text' ? message.kind.text : ''}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {isMedia && (
                    <View style={styles.mediaWrapper}>
                        <Image
                            source={{ uri: mediaItem?.thumbnail || mediaItem?.url }}
                            style={styles.mediaImage}
                            resizeMode="cover"
                            blurRadius={isLocked ? 50 : 0}
                        />
                        {/* Gradient overlay at bottom */}
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.6)']}
                            style={styles.mediaGradient}
                        />
                        {/* Locked overlay */}
                        {isLocked && (
                            <View style={styles.lockedOverlay}>
                                <BlurView intensity={20} tint="dark" style={styles.lockedBadge}>
                                    <IconLock size={18} color="#ffd93d" />
                                    <Text style={styles.lockedText}>PRO</Text>
                                </BlurView>
                            </View>
                        )}
                        {/* Play button for video */}
                        {mediaItem?.media_type === 'video' && !isLocked && (
                            <View style={styles.playOverlay}>
                                <View style={styles.playButton}>
                                    <IconPlayerPlay size={24} color="#fff" fill="#fff" />
                                </View>
                            </View>
                        )}
                    </View>
                )}
            </Pressable>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginVertical: 4,
    },
    leftAlign: {
        alignItems: 'flex-start',
    },
    rightAlign: {
        alignItems: 'flex-end',
    },
    pressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    bubbleWrapper: {
        maxWidth: '85%',
    },
    // Agent bubble styles
    agentBubbleOuter: {
        position: 'relative',
    },
    agentGradientBorder: {
        padding: 1.5,
        borderRadius: 22,
        borderTopLeftRadius: 6,
    },
    agentBubbleInner: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        borderTopLeftRadius: 4,
        overflow: 'hidden',
    },
    agentHeader: {
        position: 'absolute',
        top: 8,
        right: 10,
        opacity: 0.6,
    },
    agentText: {
        fontSize: 15,
        lineHeight: 22,
        color: '#fff',
        fontWeight: '400',
    },
    agentGlow: {
        position: 'absolute',
        bottom: -6,
        left: 10,
        right: 10,
        height: 12,
        backgroundColor: 'rgba(167,139,250,0.15)',
        borderRadius: 20,
        transform: [{ scaleY: 0.5 }],
    },
    // User bubble styles
    userBubble: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 22,
        borderBottomRightRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    userText: {
        fontSize: 15,
        lineHeight: 22,
        color: '#fff',
        fontWeight: '400',
    },
    // Media styles
    mediaWrapper: {
        width: 220,
        aspectRatio: 3 / 4,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    mediaImage: {
        width: '100%',
        height: '100%',
    },
    mediaGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
    },
    lockedOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    lockedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,217,61,0.4)',
    },
    lockedText: {
        color: '#ffd93d',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 1,
    },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
});

export default ChatMessageBubbleV2;
