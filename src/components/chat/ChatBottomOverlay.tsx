import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChatMessagesOverlay } from './ChatMessagesOverlay';
import { QuickMessageChips } from './QuickMessageChips';
import type { ChatMessage, ChatQuickReply } from '../../types/chat';
import { ChatBottomActions } from './ChatBottomActions';
import { ChatInputBar } from './ChatInputBar';

type Props = {
  messages: ChatMessage[];
  quickReplies: ChatQuickReply[];
  showChatList: boolean;
  onMessagePress?: (message: ChatMessage) => void;
  onQuickReply: (id: string) => void;
  onSendText: (text: string) => void;
  onCapture: () => void;
  onSendPhoto: () => void;
  onDance: () => void;
  isTyping?: boolean;
  onToggleMic?: () => void;
  inputPlaceholder?: string;
  inputDisabled?: boolean;
};

export const ChatBottomOverlay: React.FC<Props> = ({
  messages,
  quickReplies,
  showChatList,
  onMessagePress,
  onQuickReply,
  onSendText,
  onCapture,
  onSendPhoto,
  onDance,
  isTyping,
  onToggleMic,
  inputPlaceholder,
  inputDisabled,
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }
    onSendText(trimmed);
    setInputValue('');
  };

  return (
    <View style={styles.container}>
      <ChatMessagesOverlay
        messages={messages}
        showChatList={showChatList}
        onMessagePress={onMessagePress}
        isTyping={isTyping}
      />
      <QuickMessageChips replies={quickReplies} onSelect={onQuickReply} />
      <ChatBottomActions
        onCapture={onCapture}
        onSendPhoto={onSendPhoto}
        onDance={onDance}
      />
      <View style={styles.inputWrapper}>
        <ChatInputBar
          value={inputValue}
          onChangeText={setInputValue}
          onSend={handleSend}
          onToggleMic={onToggleMic}
          placeholder={inputPlaceholder}
          disabled={inputDisabled}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: 16,
    gap: 12,
  },
  inputWrapper: {
    paddingHorizontal: 12,
  },
});

