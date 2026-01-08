import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChatMessagesOverlay } from './ChatMessagesOverlay';
import type { ChatMessage } from '../../types/chat';
import { ChatBottomActions } from './ChatBottomActions';
import { ChatInputBar } from './ChatInputBar';

type Props = {
  messages: ChatMessage[];
  showChatList: boolean;
  onMessagePress?: (message: ChatMessage) => void;
  onSendText: (text: string) => void;
  onCapture: () => void;
  onSendPhoto: () => void;
  onDance: () => void;
  isDancing?: boolean;
  isTyping?: boolean;
  onToggleMic?: () => void;
  onVideoCall?: () => void;
  isVoiceCallActive?: boolean;
  isVideoCallActive?: boolean;
  isUserSpeaking?: boolean;
  inputPlaceholder?: string;
  inputDisabled?: boolean;
  voiceLoading?: boolean;
  streakDays?: number;
  hasUnclaimed?: boolean;
  showStreakConfetti?: boolean;
  onStreakTap?: () => void;
  onOpenHistory?: () => void;
  onChatScrollStateChange?: (isScrolling: boolean) => void;
  onToggleChatList?: () => void;
};

export const ChatBottomOverlay: React.FC<Props> = ({
  messages,
  showChatList,
  onMessagePress,
  onSendText,
  onCapture,
  onSendPhoto,
  onDance,
  isDancing = false,
  isTyping,
  onToggleMic,
  onVideoCall,
  isVoiceCallActive,
  isVideoCallActive,
  isUserSpeaking,
  inputPlaceholder,
  inputDisabled,
  voiceLoading,
  streakDays,
  hasUnclaimed,
  showStreakConfetti,
  onStreakTap,
  onOpenHistory,
  onChatScrollStateChange,
  onToggleChatList,
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

  const handleChangeText = (text: string) => {
    setInputValue(text);
    // Auto-toggle chat list when user starts typing (like swift-version)
    if (text.length > 0 && !showChatList && onToggleChatList) {
      onToggleChatList();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.messagesContainer}>
        <ChatMessagesOverlay
          messages={messages}
          showChatList={showChatList}
          onMessagePress={message => {
            onMessagePress?.(message);
            onOpenHistory?.();
          }}
          isTyping={isTyping}
          streakDays={streakDays}
          hasUnclaimed={hasUnclaimed}
          showStreakConfetti={showStreakConfetti}
          onStreakTap={onStreakTap}
          onScrollStateChange={onChatScrollStateChange}
        />
      </View>
      <View style={styles.inputSection}>
        <ChatBottomActions
          onCapture={onCapture}
          onSendPhoto={onSendPhoto}
          onDance={onDance}
          isDancing={isDancing}
        />
        <View style={styles.inputWrapper}>
          <ChatInputBar
            value={inputValue}
            onChangeText={handleChangeText}
            onSend={handleSend}
            onToggleMic={onToggleMic}
            onVideoCall={onVideoCall}
            isMicMuted={isVoiceCallActive}
            isVoiceCallActive={isVoiceCallActive}
            isVideoCallActive={isVideoCallActive}
            isUserSpeaking={isUserSpeaking}
            placeholder={inputPlaceholder}
            disabled={inputDisabled}
            voiceLoading={voiceLoading}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    // Use flex column with flex-end to keep input at bottom
    flexDirection: 'column',
    justifyContent: 'flex-end',
    // Prevent container from expanding beyond screen
    maxHeight: '100%',
    paddingHorizontal: 10
  },
  messagesContainer: {
    // Messages container can scroll but won't push input out
    // Use flexShrink to allow shrinking when needed
    flexShrink: 1,
    // Remove maxHeight here, let ChatMessagesOverlay handle it
    marginBottom: 12,
    // Ensure it's visible and takes space when needed
    minHeight: 0,
    width: '100%',
  },
  inputSection: {
    // Input section always stays at bottom
    gap: 12,
    // Use flexShrink: 0 to prevent input from shrinking
    flexShrink: 0,
  },
  inputWrapper: {
    paddingHorizontal: 12,
  },
});

