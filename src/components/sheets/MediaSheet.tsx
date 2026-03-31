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
  Alert,
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
import { LinearGradient } from 'expo-linear-gradient';
import ImageViewing from 'react-native-image-viewing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaRepository, type MediaItem } from '../../repositories/MediaRepository';
import AssetRepository from '../../repositories/AssetRepository';
import { CurrencyRepository } from '../../repositories/CurrencyRepository';
import { type BottomSheetRef } from '../BottomSheet';
import { DiamondBadge } from '../DiamondBadge';
import { RubyPurchaseSheet, GIFT_TIERS } from './RubyPurchaseSheet';
import GiftIcon from '../../assets/icons/gift.svg';
import RubyIcon from '../../assets/icons/ruby.svg';

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
  const [ownedMediaIds, setOwnedMediaIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabKey>('video');

  // Viewer states
  const [previewVideoItem, setPreviewVideoItem] = useState<MediaItem | null>(null);
  const [cameraRollImages, setCameraRollImages] = useState<{ uri: string }[]>([]);
  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Popup state
  const [selectedGiftItem, setSelectedGiftItem] = useState<MediaItem | null>(null);
  const [showRubySheet, setShowRubySheet] = useState(false);
  const [rubyBalance, setRubyBalance] = useState(0);
  const [isPurchasing, setIsPurchasing] = useState(false);

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
<<<<<<< HEAD
      const media = await mediaRepositoryRef.current!.fetchAllMedia(characterId);
      // Debug: log items that might have unexpected available status
      const unavailable = media.filter(m => m.available !== true);
      if (unavailable.length > 0) {
        console.warn('[MediaSheet] Items passed server filter with available !== true:', unavailable.map(m => ({ id: m.id, name: m.name, available: m.available })));
      }
      // Client-side safety filter: only show items with available === true
      const filtered = media.filter(m => m.available !== false);
      console.log(`[MediaSheet] Loaded ${media.length} items, showing ${filtered.length} after available filter`);
      setItems(filtered);
=======
      const assetRepository = new AssetRepository();
      const [media, ownedIds] = await Promise.all([
        mediaRepositoryRef.current!.fetchAllMedia(characterId),
        assetRepository.fetchOwnedAssets('media'),
      ]);
      const ownedSet = ownedIds instanceof Set ? ownedIds : new Set(ownedIds as Iterable<string>);
      setOwnedMediaIds(new Set(ownedSet));
      setItems(media);
>>>>>>> 21ad5132883fa74490789e274f12dc40006680ff
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

      const isMasturbate = item.keywords?.toLowerCase().includes('masturbate');
      const isOwned = ownedMediaIds.has(item.id);

      if (isMasturbate && !isOwned) {
        setSelectedGiftItem(item);
        return;
      }

      const isTierFree = item.tier?.toLowerCase() === 'free';
      const hasNoPrice = (item.price_vcoin ?? 0) === 0 && (item.price_ruby ?? 0) === 0;

      let isFreeItem = isTierFree || (hasNoPrice && item.tier !== 'pro');
      if (isMasturbate) {
        // Since we got here, isOwned is true, treat it as unlocked directly.
        isFreeItem = true;
      }

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
    [isPro, onOpenSubscription, onIsOpenedChange, items, ownedMediaIds]
  );

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => {
      const isTierFree = item.tier?.toLowerCase() === 'free';
      const hasNoPrice = (item.price_vcoin ?? 0) === 0 && (item.price_ruby ?? 0) === 0;
      const isMasturbate = item.keywords?.toLowerCase().includes('masturbate');
      const isOwned = ownedMediaIds.has(item.id);

      // If user is Pro, everything is unlocked EXCEPT masturbate which relies on isOwned. 
      // If not pro, check if item is free.
      let isUnlocked = false;
      if (isMasturbate) {
        isUnlocked = isOwned;
      } else {
        isUnlocked = isPro || isTierFree || (hasNoPrice && item.tier !== 'pro');
      }

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
                    blurRadius={!isUnlocked ? 10 : 0}
                  />
                  {isUnlocked && (
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
                  )}
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
                  {isUnlocked && (
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
                  )}
                </View>
              )
            ) : (
              // For photos: use thumbnail for grid display (lighter), full URL only in preview
              <Image
                source={{ uri: getDisplayUrl(item) }}
                style={styles.thumbnail}
                contentFit="cover"
                transition={200}
                blurRadius={!isUnlocked ? 10 : 0}
              />
            )}

            {!isUnlocked && (
              <BlurView
                style={StyleSheet.absoluteFill}
                intensity={20}
                tint={isDarkBackground ? 'dark' : 'light'}
              >
                <View style={styles.lockOverlay}>
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    {isMasturbate ? (
                      <GiftIcon width={36} height={36} />
                    ) : (
                      <DiamondBadge size="md" />
                    )}
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', opacity: 0.9 }}>
                      {isMasturbate ? "Unlock with Gift" : "Unlock with Pro"}
                    </Text>
                  </View>
                </View>
              </BlurView>
            )}
          </View>
        </Pressable>
      );
    },
    [handleSelect, width, isPro, cardBgColor, isDarkBackground, getDisplayUrl, ownedMediaIds]
  );

  const handleGiftPurchase = async (giftCost: number) => {
    if (!selectedGiftItem || isPurchasing) return;

    try {
      setIsPurchasing(true);

      // Fetch current Ruby balance
      const currencyRepo = new CurrencyRepository();
      const currency = await currencyRepo.fetchCurrency();
      const currentRuby = currency.ruby;
      setRubyBalance(currentRuby);

      if (currentRuby < giftCost) {
        // Not enough Ruby — show purchase sheet
        setSelectedGiftItem(null);
        setIsPurchasing(false);
        setTimeout(() => setShowRubySheet(true), 300);
        return;
      }

      // Deduct Ruby
      const newRuby = currentRuby - giftCost;
      await currencyRepo.updateCurrency(undefined, newRuby);
      setRubyBalance(newRuby);

      // Save asset ownership
      const assetRepository = new AssetRepository();
      const success = await assetRepository.createAsset(selectedGiftItem.id, 'media');
      if (success) {
        setOwnedMediaIds(prev => new Set([...prev, selectedGiftItem.id]));
        setSelectedGiftItem(null);
      } else {
        // Refund Ruby on failure
        await currencyRepo.updateCurrency(undefined, currentRuby);
        setRubyBalance(currentRuby);
        Alert.alert('Error', 'Failed to unlock media. Ruby refunded.');
      }
    } catch (error: any) {
      console.error('Gift purchase failed:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

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
                  ? 'Video will be updated soon.'
                  : 'Photo will be updated soon.'}
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

          {/* Custom Unlock Popup */}
          <Modal
            visible={!!selectedGiftItem}
            transparent={true}
            animationType="fade"
            onRequestClose={() => !isPurchasing && setSelectedGiftItem(null)}
          >
            <View style={styles.giftPopupOverlay}>
              <BlurView
                style={StyleSheet.absoluteFill}
                intensity={80}
                tint="dark"
              />
              <View style={[styles.giftPopupCard, {
                backgroundColor: isDarkBackground ? '#18181b' : '#ffffff',
                borderColor: isDarkBackground ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
              }]}>
                <View style={styles.giftPopupIconWrapper}>
                  <LinearGradient
                    colors={['rgba(255, 70, 57, 0.1)', 'rgba(255, 142, 134, 0.1)']}
                    style={styles.giftPopupIconBg}
                  >
                    <GiftIcon width={48} height={48} />
                  </LinearGradient>
                </View>

                <Text style={[styles.giftPopupTitle, { color: textColor }]}>
                  Unlock Exclusive Media
                </Text>

                <Text style={[styles.giftPopupDescription, { color: secondaryTextColor }]}>
                  Choose a gift to unlock this special content 🤫
                </Text>

                <View style={styles.giftTiersRow}>
                  {GIFT_TIERS.map(tier => (
                    <Pressable
                      key={tier.id}
                      onPress={() => handleGiftPurchase(tier.cost)}
                      disabled={isPurchasing}
                      style={({ pressed }) => [
                        styles.giftTierCard,
                        pressed && { transform: [{ scale: 0.95 }] },
                      ]}
                    >
                      <LinearGradient
                        colors={tier.gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.giftTierGradient}
                      >
                        {'popular' in tier && tier.popular && (
                          <View style={styles.giftTierPopular}>
                            <Text style={styles.giftTierPopularText}>HOT</Text>
                          </View>
                        )}
                        <Image source={{ uri: tier.image }} style={styles.giftTierImage} />
                        <Text style={styles.giftTierName}>{tier.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={styles.giftTierCost}>{tier.cost}</Text>
                          <RubyIcon width={14} height={14} />
                        </View>
                      </LinearGradient>
                    </Pressable>
                  ))}
                </View>

                {isPurchasing && (
                  <View style={styles.giftPurchasingRow}>
                    <ActivityIndicator color="#a855f7" size="small" />
                    <Text style={{ color: 'rgba(255,255,255,0.6)', marginLeft: 8 }}>Processing...</Text>
                  </View>
                )}

                <Pressable
                  style={styles.giftPopupCancelBtn}
                  onPress={() => !isPurchasing && setSelectedGiftItem(null)}
                  disabled={isPurchasing}
                >
                  <Text style={[styles.giftPopupCancelText, { color: secondaryTextColor }]}>
                    Maybe Later
                  </Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <RubyPurchaseSheet
            visible={showRubySheet}
            onClose={() => setShowRubySheet(false)}
            currentBalance={rubyBalance}
            onPurchaseComplete={(newBalance) => {
              setRubyBalance(newBalance);
              setShowRubySheet(false);
            }}
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
  },
  giftTiersRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 8,
  },
  giftTierCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  giftTierGradient: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 110,
  },
  giftTierPopular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  giftTierPopularText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  giftTierImage: {
    width: 44,
    height: 44,
    marginBottom: 4,
  },
  giftTierName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  giftTierCost: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '800',
  },
  giftPurchasingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
});
