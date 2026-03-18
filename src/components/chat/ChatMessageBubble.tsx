import React, { useState, useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View, Modal, ActivityIndicator, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '../../context/SubscriptionContext';
import { useSceneActions } from '../../context/SceneActionsContext';
import { DiamondBadge } from '../../components/DiamondBadge';
import AssetRepository from '../../repositories/AssetRepository';
import { revenueCatManager } from '../../services/RevenueCatManager';
import GiftIcon from '../../assets/icons/gift.svg';
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
    !isMedia && (message.isAgent ? styles.agentBubble : styles.userBubble),
    !isMedia && variant === 'compact' && styles.compactBubble,
    isMedia && styles.mediaContainer,
  ];

  const { isPro } = useSubscription();
  const sceneActions = useSceneActions();
  const [isOwned, setIsOwned] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Determine if media is locked
  const mediaItem = message.kind.type === 'media' ? message.kind.mediaItem : null;
  const isMasturbate = mediaItem?.keywords?.toLowerCase().includes('masturbate');

  useEffect(() => {
    if (isMedia && isMasturbate && mediaItem) {
      const checkOwned = async () => {
        try {
          const repo = new AssetRepository();
          const owned = await repo.fetchOwnedAssets('media');
          const ownedSet = owned instanceof Set ? owned : new Set(owned as Iterable<string>);
          if (ownedSet.has(mediaItem.id)) {
            setIsOwned(true);
          }
        } catch (e) {
          console.warn('Failed to fetch ownership', e);
        }
      };
      checkOwned();
    }
  }, [message.id, isMedia, isMasturbate, mediaItem]);

  const isLocked = isMedia && (isMasturbate ? !isOwned : (mediaItem?.tier === 'pro' && !isPro));

  const handlePress = () => {
    if (isMedia && isLocked) {
      if (isMasturbate) {
        setShowGiftModal(true);
        return;
      }
      sceneActions.openSubscription();
      return;
    }
    onPress?.(message);
  };

  const handleGiftPurchase = async () => {
    if (!mediaItem || isPurchasing) return;
    try {
      setIsPurchasing(true);
      const pkg = await revenueCatManager.getPackageByIdentifier('roxie.gift');
      if (pkg) {
        const { productIdentifier } = await revenueCatManager.purchasePackage(pkg);
        const assetRepository = new AssetRepository();

        // Prevent transaction_id unique constraint errors in the database by omitting it entirely.
        const success = await assetRepository.createAsset(mediaItem.id, 'media');
        if (success) {
          setIsOwned(true);
          setShowGiftModal(false);
        } else {
          Alert.alert('Error', 'Purchase successful but failed to save to database. Please contact support.');
          // Still unlock in current session so they get what they paid for
          setIsOwned(true);
          setShowGiftModal(false);
        }
      } else {
        Alert.alert('Error', 'Gift package not found.');
      }
    } catch (error: any) {
      console.error('Purchase failed:', error);
      if (error.message !== 'Purchase cancelled') {
        Alert.alert('Error', 'Purchase failed. Please try again.');
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <View style={[styles.container, styles.leftAlign]}>
      <Pressable
        style={({ pressed }) => [...containerStyles, pressed && styles.bubblePressed]}
        onPress={handlePress}
      >
        {isText ? renderTextContent(message, variant) : null}
        {isMedia ? renderMediaContent(message, variant, isLocked, isMasturbate) : null}
      </Pressable>

      <Modal
        visible={showGiftModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !isPurchasing && setShowGiftModal(false)}
      >
        <View style={styles.giftPopupOverlay}>
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={80}
            tint="dark"
          />
          <View style={[styles.giftPopupCard, {
            backgroundColor: '#18181b',
            borderColor: 'rgba(255,255,255,0.1)'
          }]}>
            <View style={styles.giftPopupIconWrapper}>
              <LinearGradient
                colors={['rgba(255, 70, 57, 0.1)', 'rgba(255, 142, 134, 0.1)']}
                style={styles.giftPopupIconBg}
              >
                <GiftIcon width={48} height={48} />
              </LinearGradient>
            </View>

            <Text style={[styles.giftPopupTitle, { color: '#fff' }]}>
              Unlock Exclusive Media
            </Text>

            <Text style={[styles.giftPopupDescription, { color: 'rgba(255,255,255,0.7)' }]}>
              Send me a sweet gift to unlock this special content. 🤫
            </Text>

            <Pressable
              onPress={handleGiftPurchase}
              disabled={isPurchasing}
              style={styles.giftPopupButtonContainer}
            >
              <LinearGradient
                colors={['#FF4639', '#FF8E86']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.giftPopupGradientBtn}
              >
                {isPurchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.giftPopupBtnText}>Send Gift ($1.00)</Text>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable
              style={styles.giftPopupCancelBtn}
              onPress={() => !isPurchasing && setShowGiftModal(false)}
              disabled={isPurchasing}
            >
              <Text style={[styles.giftPopupCancelText, { color: 'rgba(255,255,255,0.7)' }]}>
                Maybe Later
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const renderTextContent = (
  message: ChatMessage,
  variant: 'compact' | 'full'
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
          message.isAgent ? styles.agentText : styles.userText,
          variant === 'compact' && styles.compactText,
        ]}
        numberOfLines={undefined}
      >
        {text}
      </Text>
    </View>
  );
};

const renderMediaContent = (message: ChatMessage, variant: 'compact' | 'full', isLocked: boolean = false, isMasturbate: boolean = false) => {
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

  return (
    <View style={styles.mediaWrapper}>
      <Image
        source={{ uri: url }}
        style={styles.mediaFull}
        resizeMode="cover"
        blurRadius={isLocked ? 10 : 0}
      />
      {isLocked && (
        <View style={styles.mediaOverlay}>
          {isMasturbate ? (
            <GiftIcon width={48} height={48} />
          ) : (
            <DiamondBadge size="lg" />
          )}
          <Text style={styles.lockedText}>
            {isMasturbate ? "Unlock with Gift" : "Unlock with Pro"}
          </Text>
        </View>
      )}
      {!isLocked && isVideo && (
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginVertical: 4,
  },
  mediaContainer: {
    marginVertical: 4,
    // Remove padding and background for media
  },
  compactBubble: {
    maxWidth: '90%',
    paddingVertical: 6,
    paddingHorizontal: 10,
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
  },
  giftPopupOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  giftPopupCard: {
    width: '80%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  giftPopupIconWrapper: {
    marginBottom: 16,
    shadowColor: '#FF4639',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  giftPopupIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 70, 57, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 142, 134, 0.2)'
  },
  giftPopupTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  giftPopupDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  giftPopupButtonContainer: {
    width: '100%',
    shadowColor: '#FF4639',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  giftPopupGradientBtn: {
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftPopupBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  giftPopupCancelBtn: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  giftPopupCancelText: {
    fontSize: 15,
    fontWeight: '600',
  }
});

