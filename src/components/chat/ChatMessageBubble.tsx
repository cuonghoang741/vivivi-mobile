import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSubscription } from '../../context/SubscriptionContext';
import { useSceneActions } from '../../context/SceneActionsContext';
import { DiamondBadge } from '../../components/DiamondBadge';
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
  const isText = message.kind.type === 'text' || message.kind.type === 'system';
  const isMedia = message.kind.type === 'media';

  const containerStyles = [
    !isMedia && styles.bubble,
    !isMedia && (alignLeft ? styles.agentBubble : styles.userBubble),
    !isMedia && variant === 'compact' && styles.compactBubble,
    isMedia && styles.mediaContainer,
  ];

  const { isPro } = useSubscription();
  const sceneActions = useSceneActions();

  // Determine if media is locked
  const mediaItem = message.kind.type === 'media' ? message.kind.mediaItem : null;
  const isLocked = isMedia && mediaItem?.tier === 'pro' && !isPro;

  const handlePress = () => {
    if (isMedia && isLocked) {
      sceneActions.openSubscription();
      return;
    }
    onPress?.(message);
  };

  return (
    <View style={[styles.container, alignLeft ? styles.leftAlign : styles.rightAlign]}>
      <Pressable
        style={({ pressed }) => [...containerStyles, pressed && styles.bubblePressed]}
        onPress={handlePress}
      >
        {isText ? renderTextContent(message, variant, alignLeft) : null}
        {isMedia ? renderMediaContent(message, variant, isLocked) : null}
      </Pressable>
    </View>
  );
};

const renderTextContent = (
  message: ChatMessage,
  variant: 'compact' | 'full',
  alignLeft: boolean
) => {
  if (message.kind.type !== 'text' && message.kind.type !== 'system') {
    return null;
  }

  const text = message.kind.text;
  const isCallStarted = text === 'Call started';
  const isCallEnded = text?.startsWith('Call ended') || text?.startsWith('Call ');

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
        numberOfLines={undefined}
      >
        {text}
      </Text>
    </View>
  );
};

const renderMediaContent = (message: ChatMessage, variant: 'compact' | 'full', isLocked: boolean = false) => {
  if (message.kind.type !== 'media') {
    return null;
  }

  // Handle new mediaItem structure
  const mediaItem = message.kind.mediaItem;
  if (!mediaItem) return null;

  const url = mediaItem.thumbnail || mediaItem.url;
  const isVideo = mediaItem.content_type?.startsWith('video') ||
    mediaItem.url?.toLowerCase().endsWith('.mp4') ||
    mediaItem.media_type === 'video';

  // Even in compact mode, we want to show the image cleanly without bubble
  // But maybe smaller? User asked for "full width", assuming for the main chat view.
  // Using same style for both for now based on "hien anh ra..." intent.

  return (
    <View style={styles.mediaWrapper}>
      <Image
        source={{ uri: url }}
        style={styles.mediaFull}
        resizeMode="cover"
        blurRadius={isLocked ? 40 : 0}
      />
      {isLocked && (
        <View style={styles.mediaOverlay}>
          <DiamondBadge size="lg" />
          <Text style={styles.lockedText}>Unlock with Pro</Text>
        </View>
      )}
      {isVideo && (
        <View style={styles.mediaOverlay}>
          <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
        </View>
      )}
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
  mediaContainer: {
    marginVertical: 4,
    // Remove padding and background for media
  },
  compactBubble: {
    maxWidth: '90%',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  agentBubble: {
    backgroundColor: 'rgba(244, 28, 42, 0.33)',
    borderWidth: 1,
    borderColor: 'rgba(244, 28, 42, 0.40)',
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
  mediaWrapper: {
    width: 240, // Fixed width for nice display
    aspectRatio: 3 / 4, // Portrait aspect ratio is common for character photos
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  mediaFull: {
    width: '100%',
    height: '100%',
  },
  lockedText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  }
});

