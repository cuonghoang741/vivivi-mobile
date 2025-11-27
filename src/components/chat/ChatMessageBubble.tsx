import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ChatMessage } from '../../types/chat';

type Props = {
  message: ChatMessage;
  alignLeft?: boolean;
  onPress?: (message: ChatMessage) => void;
  variant?: 'compact' | 'full';
};

export const ChatMessageBubble: React.FC<Props> = ({
  message,
  alignLeft = true,
  onPress,
  variant = 'full',
}) => {
  const isText = message.kind.type === 'text';
  const isMedia = message.kind.type === 'media';

  const containerStyles = [
    styles.bubble,
    alignLeft ? styles.agentBubble : styles.userBubble,
    variant === 'compact' && styles.compactBubble,
  ];

  return (
    <View style={[styles.container, alignLeft ? styles.leftAlign : styles.rightAlign]}>
      <Pressable
        style={({ pressed }) => [...containerStyles, pressed && styles.bubblePressed]}
        onPress={() => onPress?.(message)}
      >
        {isText ? renderTextContent(message, variant, alignLeft) : null}
        {isMedia ? renderMediaContent(message, variant) : null}
      </Pressable>
    </View>
  );
};

const renderTextContent = (
  message: ChatMessage,
  variant: 'compact' | 'full',
  alignLeft: boolean
) => {
  if (message.kind.type !== 'text') {
    return null;
  }

  const text = message.kind.text;
  const isCallStarted = text === 'Call started';
  const isCallEnded = text?.startsWith('Call ended');

  return (
    <View style={styles.textRow}>
      {(isCallStarted || isCallEnded) && (
        <Ionicons
          name={isCallStarted ? 'call' : 'call-outline'}
          size={14}
          color="#fff"
          style={styles.callIcon}
        />
      )}
      <Text
        style={[
          styles.text,
          alignLeft ? styles.agentText : styles.userText,
          variant === 'compact' && styles.compactText,
        ]}
        numberOfLines={variant === 'compact' ? 3 : undefined}
      >
        {text}
      </Text>
    </View>
  );
};

const renderMediaContent = (message: ChatMessage, variant: 'compact' | 'full') => {
  if (message.kind.type !== 'media') {
    return null;
  }
  const url = message.kind.thumbnail || message.kind.url;

  if (variant === 'compact') {
    const isVideo =
      message.kind.url.toLowerCase().endsWith('.mp4') ||
      message.kind.url.toLowerCase().includes('video');
    return (
      <View style={styles.mediaCompactRow}>
        <Ionicons
          name={isVideo ? 'play-circle' : 'image'}
          size={18}
          color="#fff"
          style={{ marginRight: 8 }}
        />
        <Text style={styles.mediaCompactText}>{isVideo ? 'Show Video' : 'Show Image'}</Text>
      </View>
    );
  }

  return (
    <View>
      <Image source={{ uri: url }} style={styles.media} />
      <View style={styles.mediaOverlay}>
        <Ionicons name="play-circle" size={28} color="#fff" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  leftAlign: {
    alignItems: 'flex-start',
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginVertical: 4,
  },
  compactBubble: {
    maxWidth: '90%',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  agentBubble: {
    backgroundColor: 'rgba(255,138,196,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,138,196,0.55)',
  },
  userBubble: {
    backgroundColor: 'rgba(15,15,15,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  bubblePressed: {
    transform: [{ scale: 0.98 }],
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  agentText: {
    color: '#fff',
  },
  userText: {
    color: '#fff',
  },
  media: {
    width: 180,
    height: 120,
    borderRadius: 16,
  },
  mediaOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaCompactText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callIcon: {
    marginRight: 8,
  },
  compactText: {
    fontSize: 13,
    flexShrink: 1,
  },
});

