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
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Video, ResizeMode } from 'expo-av';
import { BlurView } from 'expo-blur';
import ImageViewing from 'react-native-image-viewing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaRepository, type MediaItem } from '../../repositories/MediaRepository';
import { type BottomSheetRef } from '../commons/BottomSheet';
import { DiamondBadge } from '../commons/DiamondBadge';

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
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabKey>('video');

  // Viewer states
  const [previewVideoItem, setPreviewVideoItem] = useState<MediaItem | null>(null);
  const [cameraRollImages, setCameraRollImages] = useState<{ uri: string }[]>([]);
  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Dynamic colors
  const textColor = isDarkBackground ? '#fff' : '#000';
  const secondaryTextColor = isDarkBackground ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
  const activeTabBgColor = isDarkBackground ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
  const cardBgColor = isDarkBackground ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const closeButtonBg = isDarkBackground ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';
  const sheetBgColor = isDarkBackground ? '#1e1e1e' : '#fff';

  // Expose present/dismiss via ref
  useImperativeHandle(ref, () => ({
    present: () => onIsOpenedChange(true),
    dismiss: () => onIsOpenedChange(false),
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
      setSelectedTab('video');
      if (items.length === 0 || characterId) {
        loadMedia();
      }
    }
  }, [isOpened, characterId, loadMedia]);

  const handleTabChange = (tab: TabKey) => {
    Haptics.selectionAsync();
    setSelectedTab(tab);
  };

  const currentItems = useMemo(() => {
    const filtered = items.filter(item =>
      selectedTab === 'video' ? isVideoItem(item) : !isVideoItem(item)
    );
    // Sort: Free first, then Premium
    // Sort: Free first, then Premium/Pro
    return filtered.sort((a, b) => {
      const isFreeA = (a.tier?.toLowerCase() === 'free') || ((a.price_vcoin ?? 0) === 0 && (a.price_ruby ?? 0) === 0 && a.tier?.toLowerCase() !== 'pro');
      const isFreeB = (b.tier?.toLowerCase() === 'free') || ((b.price_vcoin ?? 0) === 0 && (b.price_ruby ?? 0) === 0 && b.tier?.toLowerCase() !== 'pro');

      if (isFreeA && !isFreeB) return -1;
      if (!isFreeA && isFreeB) return 1;

      // Secondary sort to ensure stability (e.g. by name or ID) - optional but good practice
      // For now just keep existing relative order if same tier
      return 0;
    });
  }, [items, selectedTab]);

  // Prepare images for the ImageViewer (use full URL for preview)
  useEffect(() => {
    // Collect all 'photo' items for the viewer - use original URL for full preview
    const photos = items
      .filter(i => !isVideoItem(i))
      .map(i => ({ uri: i.url }));
    setCameraRollImages(photos);
  }, [items]);

  // Helper to get display URL (prefer thumbnail for grid, fallback to url)
  const getDisplayUrl = useCallback((item: MediaItem) => {
    return item.thumbnail || item.url;
  }, []);

  const handleSelect = useCallback(
    (item: MediaItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);

      const isTierFree = item.tier?.toLowerCase() === 'free';
      const hasNoPrice = (item.price_vcoin ?? 0) === 0 && (item.price_ruby ?? 0) === 0;
      const isFreeItem = isTierFree || (hasNoPrice && item.tier !== 'pro');

      if (isPro || isFreeItem) {
        if (isVideoItem(item)) {
          setPreviewVideoItem(item);
        } else {
          // Find index of this item in the photos ALL array (not just current view if we filter)
          // But cameraRollImages is derived from all items filtered by !isVideoItem
          const photoList = items.filter(i => !isVideoItem(i));
          const photoIndex = photoList.findIndex(i => i.id === item.id);

          if (photoIndex >= 0) {
            setCurrentImageIndex(photoIndex);
            setIsImageViewerVisible(true);
          }
        }
      } else {
        onIsOpenedChange(false);
        setTimeout(() => {
          onOpenSubscription?.();
        }, 300);
      }
    },
    [isPro, onOpenSubscription, onIsOpenedChange, items]
  );

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => {
      const isTierFree = item.tier?.toLowerCase() === 'free';
      const hasNoPrice = (item.price_vcoin ?? 0) === 0 && (item.price_ruby ?? 0) === 0;
      // If user is Pro, everything is unlocked. If not pro, check if item is free.
      const isUnlocked = isPro || isTierFree || (hasNoPrice && item.tier !== 'pro');

      const cardWidth = (width - 40 - 12) / 2;

      return (
        <Pressable
          onPress={() => handleSelect(item)}
          style={[styles.card, { width: cardWidth }]}
        >
          <View style={[styles.thumbnailWrapper, { backgroundColor: cardBgColor }]}>
            {isVideoItem(item) ? (
              // For videos: use thumbnail image if available, otherwise show video frame
              item.thumbnail ? (
                <View style={styles.thumbnail}>
                  <Image
                    source={{ uri: item.thumbnail }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                    <View style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingLeft: 2 // Optical center
                    }}>
                      <Ionicons name="play" size={18} color="#fff" />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.thumbnail} pointerEvents="none">
                  <Video
                    source={{ uri: item.url }}
                    style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={false}
                    isMuted={true}
                    positionMillis={1000}
                  />
                  <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                    <View style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingLeft: 2 // Optical center
                    }}>
                      <Ionicons name="play" size={18} color="#fff" />
                    </View>
                  </View>
                </View>
              )
            ) : (
              // For photos: use thumbnail for grid display (lighter), full URL only in preview
              <Image
                source={{ uri: getDisplayUrl(item) }}
                style={styles.thumbnail}
                contentFit="cover"
                transition={200}
                blurRadius={!isUnlocked ? 40 : 0}
              />
            )}

            {!isUnlocked && (
              <BlurView
                style={StyleSheet.absoluteFill}
                intensity={20}
                tint={isDarkBackground ? 'dark' : 'light'}
              >
                <View style={styles.lockOverlay}>
                  <DiamondBadge size="md" />
                </View>
              </BlurView>
            )}
          </View>
        </Pressable>
      );
    },
    [handleSelect, width, isPro, cardBgColor, isDarkBackground, getDisplayUrl]
  );

  return (
    <>
      <Modal
        visible={isOpened}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => onIsOpenedChange(false)}
      >
        <View style={[styles.container, { backgroundColor: sheetBgColor }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }} />
            <Text style={[styles.headerTitle, { color: textColor }]}>
              {characterName ? `${characterName}'s Media` : 'Media Gallery'}
            </Text>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Pressable
                style={[styles.closeButton, { backgroundColor: closeButtonBg }]}
                onPress={() => onIsOpenedChange(false)}
              >
                <Ionicons name="close" size={20} color={textColor} />
              </Pressable>
            </View>
          </View>

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
            <View style={{ flex: 1 }}>
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

          {/* Viewers nested inside the Modal View to ensure correct stacking context */}

          {/* Video Lightbox */}
          <VideoPreviewModal
            item={previewVideoItem}
            onClose={() => setPreviewVideoItem(null)}
          />

          {/* Image Lightbox */}
          <ImageViewing
            images={cameraRollImages}
            imageIndex={currentImageIndex}
            visible={isImageViewerVisible}
            onRequestClose={() => setIsImageViewerVisible(false)}
            swipeToCloseEnabled={true}
            doubleTapToZoomEnabled={true}
            presentationStyle="overFullScreen"
            backgroundColor="#000"
            FooterComponent={({ imageIndex }) => (
              <View style={styles.imageViewerFooter}>
                <Text style={styles.imageViewerFooterText}>
                  {imageIndex + 1} / {cameraRollImages.length}
                </Text>
              </View>
            )}
          />
        </View>
      </Modal>
    </>
  );
});

const VideoPreviewModal: React.FC<{
  item: MediaItem | null;
  onClose: () => void;
}> = ({ item, onClose }) => {
  const videoRef = useRef<Video | null>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!item && videoRef.current) {
      videoRef.current.stopAsync().catch(() => undefined);
    }
  }, [item]);

  if (!item) return null;

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <View style={styles.lightboxContainer}>
        <Pressable
          style={[styles.lightboxCloseButton, { top: insets.top + (Platform.OS === 'android' ? 20 : 10) }]}
          onPress={onClose}
          hitSlop={20}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>

        <Video
          ref={ref => {
            videoRef.current = ref;
          }}
          style={{ width, height: height * 0.8 }}
          source={{ uri: item.url }}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isLooping
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 56,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(50,50,50,0.5)',
    borderRadius: 20,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  imageViewerFooter: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 40
  },
  imageViewerFooterText: {
    color: '#fff',
    fontSize: 16
  }
});
