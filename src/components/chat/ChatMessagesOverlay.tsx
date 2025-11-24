import React, { useMemo, useRef, useEffect } from 'react';
import { FlatList, StyleSheet, View, Animated } from 'react-native';
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
};

// Spring animation config matching Swift version
const SPRING_CONFIG = {
  tension: 50,
  friction: 7,
  useNativeDriver: true,
};

type ChatOverlayItemProps = {
  message: ChatMessage;
  index: number;
  total: number;
  onMessagePress?: (message: ChatMessage) => void;
};

const ChatOverlayItem: React.FC<ChatOverlayItemProps> = ({
  message,
  index,
  total,
  onMessagePress,
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
}) => {
  const displayedMessages = useMemo(() => messages.slice(-3), [messages]);
  const opacityAnim = useRef(new Animated.Value(showChatList ? 1 : 0)).current;
  const translateXAnim = useRef(new Animated.Value(showChatList ? 0 : 200)).current;
  const typingOpacityAnim = useRef(new Animated.Value(isTyping ? 1 : 0)).current;

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
      <FlatList
        data={displayedMessages}
        renderItem={({ item, index }) => (
          <ChatOverlayItem
            message={item}
            index={index}
            total={displayedMessages.length}
            onMessagePress={onMessagePress}
          />
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset }]}
        scrollEnabled={false}
      />
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
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  listContent: {
    gap: 4,
  },
  typingContainer: {
    paddingHorizontal: 12,
  },
});

