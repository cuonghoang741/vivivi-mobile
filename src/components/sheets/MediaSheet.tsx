import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Video } from 'expo-av';

import { MediaRepository, type MediaItem } from '../../repositories/MediaRepository';
import { BottomSheet, type BottomSheetRef } from '../BottomSheet';
import { DiamondBadge } from '../DiamondBadge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type MediaSheetProps = {
  isOpened: boolean;
  onIsOpenedChange: (opened: boolean) => void;
  characterId?: string | null;
  characterName?: string | null;
  onOpenSubscription?: () => void;
  isDarkBackground?: boolean;
  isPro?: boolean;
};

export type MediaSheetRef = BottomSheetRef;

type TabKey = 'video' | 'photo';

const isVideoItem = (item: MediaItem) => {
  const mediaType = item.media_type?.toLowerCase();
  if (mediaType) {
    return mediaType === 'video' || mediaType === 'dance';
  }
  const url = item.url.toLowerCase();
  return url.endsWith('.mp4') || url.includes('video');
};

export const MediaSheet = forwardRef<MediaSheetRef, MediaSheetProps>(({
  isOpened,
  onIsOpenedChange,
  characterId,
  characterName,
  onOpenSubscription,
  isDarkBackground = true,
  isPro = false,
}, ref) => {
  const sheetRef = useRef<BottomSheetRef>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabKey>('photo');
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);

  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Dynamic colors (matching CharacterDetailSheet)
  const textColor = isDarkBackground ? '#fff' : '#000';
  const secondaryTextColor = isDarkBackground ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
  const tertiaryTextColor = isDarkBackground ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const cardBgColor = isDarkBackground ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const activeTabBgColor = isDarkBackground ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';

  // Expose present/dismiss via ref
  useImperativeHandle(ref, () => ({
    present: (index?: number) => sheetRef.current?.present(index),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const mediaRepositoryRef = useRef<MediaRepository | null>(null);
  if (!mediaRepositoryRef.current) {
    mediaRepositoryRef.current = new MediaRepository();
  }

  const loadMedia = useCallback(async () => {
    if (!characterId) {
      setErrorMessage('Unable to find the current character');
      setItems([]);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const media = await mediaRepositoryRef.current!.fetchAllMedia(characterId);
      setItems(media);
    } catch (error: any) {
      console.error('[MediaSheet] Failed to load media:', error);
      setErrorMessage(error?.message ?? 'Unable to load media');
    } finally {
      setIsLoading(false);
    }
  }, [characterId]);

  useEffect(() => {
    if (isOpened) {
      if (items.length === 0 || characterId) {
        loadMedia();
      }
    } else {
      setPreviewItem(null);
    }
  }, [isOpened, characterId, loadMedia]); // Removed items.length to allow refresh on re-open if char changed

  const handleTabChange = (tab: TabKey) => {
    Haptics.selectionAsync();
    setSelectedTab(tab);
  };

  const currentItems = useMemo(() => {
    const filtered = items.filter(item =>
      selectedTab === 'video' ? isVideoItem(item) : !isVideoItem(item)
    );
    // Sort: Free first, then Premium
    return filtered.sort((a, b) => {
      const isFreeA = (a.price_vcoin ?? 0) === 0 && (a.price_ruby ?? 0) === 0;
      const isFreeB = (b.price_vcoin ?? 0) === 0 && (b.price_ruby ?? 0) === 0;
      if (isFreeA && !isFreeB) return -1;
      if (!isFreeA && isFreeB) return 1;
      return 0;
    });
  }, [items, selectedTab]);

  const handleSelect = useCallback(
    (item: MediaItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);

      // Free if tier is 'free' OR no price set
      const isTierFree = item.tier?.toLowerCase() === 'free';
      const hasNoPrice = (item.price_vcoin ?? 0) === 0 && (item.price_ruby ?? 0) === 0;
      const isFreeItem = isTierFree || (hasNoPrice && item.tier !== 'pro');

      console.log('[MediaSheet] handleSelect:', {
        id: item.id,
        tier: item.tier,
        isFreeItem,
        isPro,
        price_vcoin: item.price_vcoin,
        price_ruby: item.price_ruby
      });

      if (isPro || isFreeItem) {
        setPreviewItem(item);
      } else {
        // Not pro and not free -> Upsell
        sheetRef.current?.dismiss();
        setTimeout(() => {
          onOpenSubscription?.();
        }, 300);
      }
    },
    [isPro, onOpenSubscription]
  );

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => {
      const isFree = (item.price_vcoin ?? 0) === 0 && (item.price_ruby ?? 0) === 0;
      const isUnlocked = isPro;

      const thumb = item.thumbnail || item.url;
      const cardWidth = (width - 40 - 12) / 2; // Matching CharacterDetailSheet spacing

      return (
        <Pressable
          onPress={() => handleSelect(item)}
          style={[styles.card, { width: cardWidth }]}
        >
          <View style={[styles.thumbnailWrapper, { backgroundColor: cardBgColor }]}>
            {thumb ? (
              <Image
                source={{ uri: thumb }}
                style={styles.thumbnail}
                contentFit="cover"
                transition={200}
                blurRadius={!isUnlocked ? 40 : 0}
              />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailFallback]}>
                <Ionicons name="image" color={tertiaryTextColor} size={28} />
              </View>
            )}

            {!isUnlocked && (
              <View style={styles.lockOverlay}>
                <View style={styles.diamondBadgeContainer}>
                  <DiamondBadge size="md" />
                </View>
              </View>
            )}
          </View>

        </Pressable>
      );
    },
    [handleSelect, width, isPro, cardBgColor, tertiaryTextColor, textColor]
  );

  return (
    <>
      <BottomSheet
        ref={sheetRef}
        isOpened={isOpened}
        onIsOpenedChange={onIsOpenedChange}
        title={characterName ? `${characterName}'s Media` : 'Media Gallery'}
        isDarkBackground={isDarkBackground}
        detents={[0.5, 0.95]}
      >
        {/* Tabs */}
        <View style={[styles.tabsContainer, { backgroundColor: cardBgColor }]}>
          <Pressable
            style={[
              styles.tabButton,
              selectedTab === 'video' && { backgroundColor: activeTabBgColor }
            ]}
            onPress={() => handleTabChange('video')}
          >
            <Text style={[
              styles.tabText,
              { color: selectedTab === 'video' ? textColor : secondaryTextColor }
            ]}>
              Video
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tabButton,
              selectedTab === 'photo' && { backgroundColor: activeTabBgColor }
            ]}
            onPress={() => handleTabChange('photo')}
          >
            <Text style={[
              styles.tabText,
              { color: selectedTab === 'photo' ? textColor : secondaryTextColor }
            ]}>
              Photo
            </Text>
          </Pressable>
        </View>

        {isLoading && items.length === 0 ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={textColor} />
          </View>
        ) : errorMessage ? (
          <View style={styles.centerContent}>
            <Text style={[styles.errorTitle, { color: textColor }]}>Unable to load media</Text>
            <Text style={[styles.errorSubtitle, { color: secondaryTextColor }]}>{errorMessage}</Text>
            <Pressable onPress={loadMedia} style={[styles.retryButton, { borderColor: textColor }]}>
              <Text style={[styles.retryButtonText, { color: textColor }]}>Try again</Text>
            </Pressable>
          </View>
        ) : currentItems.length === 0 ? (
          <View style={styles.centerContent}>
            <Text style={[styles.emptyText, { color: secondaryTextColor }]}>
              {selectedTab === 'video'
                ? 'No videos available'
                : 'No photos available'}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1, maxHeight: height * 0.8 }}>
            <FlatList
              data={currentItems}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              numColumns={2}
              columnWrapperStyle={styles.columnWrapper}
              contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}
      </BottomSheet>

      <MediaPreviewModal
        item={previewItem}
        onClose={() => setPreviewItem(null)}
      />
    </>
  );
});

const MediaPreviewModal: React.FC<{
  item: MediaItem | null;
  onClose: () => void;
}> = ({ item, onClose }) => {
  const videoRef = useRef<Video | null>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    console.log('[MediaPreviewModal] item changed:', item?.id, item?.url);
    if (!item && videoRef.current) {
      videoRef.current.stopAsync().catch(() => undefined);
    }
  }, [item]);

  if (!item) return null;

  const isVideo = isVideoItem(item);

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.lightboxContainer}>
        <Pressable
          style={[styles.lightboxCloseButton, { top: insets.top + 10 }]}
          onPress={onClose}
          hitSlop={20}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>

        {isVideo ? (
          <Video
            ref={ref => {
              videoRef.current = ref;
            }}
            style={{ width, height: height * 0.8 }}
            source={{ uri: item.url }}
            useNativeControls
            resizeMode="contain"
            shouldPlay
            isLooping
          />
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              alignItems: 'center',
              minWidth: width,
              minHeight: height,
            }}
            maximumZoomScale={5}
            minimumZoomScale={1}
            bouncesZoom
            bounces
            alwaysBounceHorizontal
            alwaysBounceVertical
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            centerContent
            pinchGestureEnabled
          >
            <Image
              source={{ uri: item.url }}
              style={{ width, height: height * 0.9 }}
              contentFit="contain"
            />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 24,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  retryButtonText: {
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
  },
  columnWrapper: {
    gap: 12,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  card: {
    gap: 8,
  },
  thumbnailWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    aspectRatio: 3 / 4,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondBadgeContainer: {
    // Center it
  },
  priceBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priceText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
  },
  mediaTitle: {
    fontWeight: '600',
    fontSize: 14,
    paddingLeft: 4,
  },
  lightboxContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxCloseButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
});
