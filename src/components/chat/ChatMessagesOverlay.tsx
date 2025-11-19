import React, { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { ChatMessage } from '../../types/chat';
import { ChatMessageBubble } from './ChatMessageBubble';
import { TypingIndicator } from './TypingIndicator';

type Props = {
  messages: ChatMessage[];
  showChatList: boolean;
  onSwipeToHide?: () => void;
  onTap?: () => void;
  onMessagePress?: (message: ChatMessage) => void;
  isTyping?: boolean;
  bottomInset?: number;
};

export const ChatMessagesOverlay: React.FC<Props> = ({
  messages,
  showChatList,
  onMessagePress,
  isTyping,
  bottomInset = 48,
}) => {
  const displayedMessages = useMemo(() => messages.slice(-3), [messages]);

  return (
    <View
      style={[
        styles.container,
        { opacity: showChatList ? 1 : 0, transform: [{ translateX: showChatList ? 0 : 200 }] },
      ]}
    >
      <FlatList
        data={displayedMessages}
        renderItem={({ item }) => (
          <ChatMessageBubble
            message={item}
            alignLeft={item.isAgent}
            onPress={onMessagePress}
          />
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset }]}
      />
      {isTyping ? (
        <View style={styles.typingContainer}>
          <TypingIndicator />
        </View>
      ) : null}
    </View>
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

