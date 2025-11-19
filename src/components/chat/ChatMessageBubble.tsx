import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ChatMessage } from '../../types/chat';

type Props = {
  message: ChatMessage;
  alignLeft?: boolean;
  onPress?: (message: ChatMessage) => void;
};

export const ChatMessageBubble: React.FC<Props> = ({
  message,
  alignLeft = true,
  onPress,
}) => {
  const isText = message.kind.type === 'text';
  const isMedia = message.kind.type === 'media';

  return (
    <View style={[styles.container, alignLeft ? styles.leftAlign : styles.rightAlign]}>
      <Pressable
        style={({ pressed }) => [
          styles.bubble,
          alignLeft ? styles.agentBubble : styles.userBubble,
          pressed && styles.bubblePressed,
        ]}
        onPress={() => onPress?.(message)}
      >
        {isText ? renderText(message, alignLeft) : null}
        {isMedia ? renderMedia(message) : null}
      </Pressable>
    </View>
  );
};

const renderText = (message: ChatMessage, alignLeft: boolean) => (
  <Text style={[styles.text, alignLeft ? styles.agentText : styles.userText]}>
    {message.kind.type === 'text' ? message.kind.text : ''}
  </Text>
);

const renderMedia = (message: ChatMessage) => {
  const url = message.kind.type === 'media' ? message.kind.thumbnail || message.kind.url : '';
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
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginVertical: 4,
  },
  agentBubble: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: '#FF6EA1',
    borderBottomRightRadius: 4,
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
});

