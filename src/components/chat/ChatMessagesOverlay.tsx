import React, { useMemo, useRef, useEffect } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ChatMessage } from '../../types/chat';
import { ChatMessageBubble } from './ChatMessageBubble';
import { TypingIndicator } from './TypingIndicator';

type Props = {
  messages: ChatMessage[];
  showChatList: boolean;
  onSwipeToHide?: () => void;
  onMessagePress?: (message: ChatMessage) => void;
  isTyping?: boolean;
  bottomInset?: number;
  streakDays?: number;
  hasUnclaimed?: boolean;
  showStreakConfetti?: boolean;
  onStreakTap?: () => void;
  onScrollStateChange?: (isScrolling: boolean) => void;
};

// Spring animation config matching Swift version
const SPRING_CONFIG = {
  tension: 50,
  friction: 7,
  useNativeDriver: true,
};

const BADGE_HEIGHT = 54;

type ChatOverlayItemProps = {
  message: ChatMessage;
  index: number;
  total: number;
  onMessagePress?: (message: ChatMessage) => void;
  variant?: 'compact' | 'full';
};

const ChatOverlayItem: React.FC<ChatOverlayItemProps> = ({
  message,
  index,
  total,
  onMessagePress,
  variant = 'compact',
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fadeAnim, {
        toValue: 1,
        ...SPRING_CONFIG,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        ...SPRING_CONFIG,
      }),
    ]).start();
  }, [fadeAnim, translateYAnim]);

  // Tính opacity theo vị trí (gần giống Swift version)
  const positionOpacity =
    total > 0 ? Math.max(0.3, 1 - (total - 1 - index) * 0.2) : 1;

  return (
    <Animated.View
      style={{
        opacity: Animated.multiply(fadeAnim, positionOpacity),
        transform: [{ translateY: translateYAnim }],
      }}
    >
      <ChatMessageBubble
        message={message}
        alignLeft={message.isAgent}
        onPress={() => onMessagePress?.(message)}
        variant={variant}
      />
    </Animated.View>
  );
};

export const ChatMessagesOverlay: React.FC<Props> = ({
  messages,
  showChatList,
  onMessagePress,
  isTyping,
  bottomInset = 48,
  streakDays,
  hasUnclaimed,
  showStreakConfetti,
  onStreakTap,
  onScrollStateChange,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const isUserScrollingRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const opacityAnim = useRef(new Animated.Value(showChatList ? 1 : 0)).current;
  const translateXAnim = useRef(new Animated.Value(showChatList ? 0 : 200)).current;
  const typingOpacityAnim = useRef(new Animated.Value(isTyping ? 1 : 0)).current;

  // Show all messages (not just last 3) to allow scrolling (like swift-version)
  const displayedMessages = useMemo(() => messages, [messages]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(opacityAnim, {
        toValue: showChatList ? 1 : 0,
        ...SPRING_CONFIG,
      }),
      Animated.spring(translateXAnim, {
        toValue: showChatList ? 0 : 200,
        ...SPRING_CONFIG,
      }),
    ]).start();
  }, [showChatList, opacityAnim, translateXAnim]);

  useEffect(() => {
    Animated.spring(typingOpacityAnim, {
      toValue: isTyping ? 1 : 0,
      ...SPRING_CONFIG,
    }).start();
  }, [isTyping, typingOpacityAnim]);

  // Auto scroll to bottom when new message arrives (only if user is near bottom)
  useEffect(() => {
    if (messages.length > 0 && scrollViewRef.current && isNearBottomRef.current && !isUserScrollingRef.current) {
      // Small delay to ensure message is rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    // Consider "near bottom" if within 100px
    isNearBottomRef.current = distanceFromBottom < 100;
  };

  const handleScrollBeginDrag = () => {
    isUserScrollingRef.current = true;
    onScrollStateChange?.(true);
  };

  const handleScrollEndDrag = () => {
    isUserScrollingRef.current = false;
    onScrollStateChange?.(false);
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
          transform: [{ translateX: translateXAnim }],
        },
      ]}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.overlayContent, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        bounces={true}
        nestedScrollEnabled={true}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
      >
        {typeof streakDays === 'number' && (
          <StreakBadge
            days={streakDays}
            hasUnclaimed={!!hasUnclaimed}
            showConfetti={!!showStreakConfetti}
            onPress={onStreakTap}
          />
        )}

        {displayedMessages.map((message, index) => (
          <ChatOverlayItem
            key={message.id}
            message={message}
            index={index}
            total={displayedMessages.length}
            onMessagePress={onMessagePress}
            variant="compact"
          />
        ))}

        <Animated.View
          style={[
            styles.typingContainer,
            {
              opacity: typingOpacityAnim,
              transform: [
                {
                  translateY: typingOpacityAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents={isTyping ? 'auto' : 'none'}
        >
          {isTyping && <TypingIndicator />}
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 4,
    // Limit height to prevent pushing input out of view
    maxHeight: 300, // Fixed max height instead of percentage
    // Ensure container is visible
    minHeight: 0,
  },
  scrollView: {
    // Remove flex: 1, use maxHeight only
    maxHeight: 300, // Match container maxHeight
    // Ensure scrollView is visible
    minHeight: 0,
  },
  overlayContent: {
    gap: 6,
    paddingHorizontal: 20,
    // Ensure content is visible
    minHeight: 0,
  },
  typingContainer: {
    paddingTop: 4,
    alignSelf: 'flex-start',
  },
  streakContainer: {
    height: BADGE_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 6,
  },
  streakClaimable: {
    shadowColor: '#FF5E9E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  streakPressed: {
    transform: [{ scale: 0.98 }],
  },
  streakGradient: {
    flex: 1,
  },
  streakContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  streakLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  streakSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '500',
  },
  claimPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  claimText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BADGE_HEIGHT,
    pointerEvents: 'none',
  },
  confettiPiece: {
    position: 'absolute',
    width: 4,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
});

const StreakBadge: React.FC<{
  days: number;
  hasUnclaimed: boolean;
  showConfetti: boolean;
  onPress?: () => void;
}> = ({ days, hasUnclaimed, showConfetti, onPress }) => {
  const label = days > 0 ? `${days} day streak` : 'Start streak';
  const icon = hasUnclaimed ? 'flame' : 'flame-outline';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.streakContainer,
        hasUnclaimed && styles.streakClaimable,
        pressed && styles.streakPressed,
      ]}
    >
      <LinearGradient
        colors={
          hasUnclaimed
            ? ['#FF9ACB', '#FF5E9E']
            : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.streakGradient}
      >
        <View style={styles.streakContent}>
          <Ionicons
            name={icon as any}
            size={18}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.streakLabel}>{label}</Text>
            <Text style={styles.streakSubtitle}>
              {hasUnclaimed ? 'Claim your reward' : 'Chat daily to earn boosts'}
            </Text>
          </View>
          {hasUnclaimed && (
            <View style={styles.claimPill}>
              <Text style={styles.claimText}>CLAIM</Text>
            </View>
          )}
        </View>
      </LinearGradient>
      {showConfetti && <MiniConfetti />}
    </Pressable>
  );
};

const MiniConfetti: React.FC = () => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [anim]);

  const pieces = new Array(8).fill(null).map((_, index) => {
    const translateY = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 18 + index * 2],
    });
    const opacity = anim.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [0, 0.8, 0],
    });
    return (
      <Animated.View
        key={`confetti-${index}`}
        style={[
          styles.confettiPiece,
          {
            left: (index % 4) * 12 + 8,
            transform: [{ translateY }],
            opacity,
          },
        ]}
      />
    );
  });
  return <View style={styles.confettiContainer}>{pieces}</View>;
};

const additionalStyles = StyleSheet.create({
  streakShadow: {
    shadowColor: '#FF5E9E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
});

Object.assign(styles, {
  streakContainer: {
    height: BADGE_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 6,
  },
  streakClaimable: {
    ...additionalStyles.streakShadow,
  },
  streakPressed: {
    transform: [{ scale: 0.98 }],
  },
  streakGradient: {
    flex: 1,
  },
  streakContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  streakLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  streakSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '500',
  },
  claimPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  claimText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BADGE_HEIGHT,
    pointerEvents: 'none',
  },
  confettiPiece: {
    position: 'absolute',
    width: 4,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
});

