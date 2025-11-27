import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Video } from 'expo-av';

import Button from '../Button';
import AssetRepository from '../../repositories/AssetRepository';
import { MediaRepository, type MediaItem } from '../../repositories/MediaRepository';
import { usePurchaseContext, ConfirmPurchasePortal } from '../../context/PurchaseContext';
import { QuestProgressTracker } from '../../utils/QuestProgressTracker';

type MediaSheetProps = {
  isOpened: boolean;
  onIsOpenedChange: (opened: boolean) => void;
  characterId?: string | null;
  characterName?: string | null;
};

type TabKey = 'video' | 'photo';

const isVideoItem = (item: MediaItem) => {
  const mediaType = item.media_type?.toLowerCase();
  if (mediaType) {
    return mediaType === 'video' || mediaType === 'dance';
  }
  const url = item.url.toLowerCase();
  return url.endsWith('.mp4') || url.includes('video');
};

export const MediaSheet: React.FC<MediaSheetProps> = ({
  isOpened,
  onIsOpenedChange,
  characterId,
  characterName,
}) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabKey>('video');
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const ownedIdsRef = useRef(ownedIds);

  useEffect(() => {
    ownedIdsRef.current = ownedIds;
  }, [ownedIds]);

  const mediaRepositoryRef = useRef<MediaRepository>();
  if (!mediaRepositoryRef.current) {
    mediaRepositoryRef.current = new MediaRepository();
  }
  const assetRepositoryRef = useRef<AssetRepository>();
  if (!assetRepositoryRef.current) {
    assetRepositoryRef.current = new AssetRepository();
  }

  const {
    confirmPurchase,
    performPurchase,
    handlePurchaseError,
    refresh: refreshCurrency,
  } = usePurchaseContext();

  const { width } = useWindowDimensions();

  const sortedItems = useMemo(() => {
    const available = items.filter(item => item.available ?? true);
    const owned = new Set(ownedIds);
    return [...available].sort((a, b) => {
      const aOwned = owned.has(a.id);
      const bOwned = owned.has(b.id);
      if (aOwned !== bOwned) {
        return aOwned ? -1 : 1;
      }
      const aPrice = (a.price_vcoin ?? 0) + (a.price_ruby ?? 0);
      const bPrice = (b.price_vcoin ?? 0) + (b.price_ruby ?? 0);
      return aPrice - bPrice;
    });
  }, [items, ownedIds]);

  const currentItems = useMemo(() => {
    return sortedItems.filter(item =>
      selectedTab === 'video' ? isVideoItem(item) : !isVideoItem(item)
    );
  }, [sortedItems, selectedTab]);

  const fetchOwned = useCallback(async () => {
    try {
      const owned = await assetRepositoryRef.current!.fetchOwnedAssets('media');
      setOwnedIds(owned);
    } catch (error) {
      console.warn('[MediaSheet] Failed to fetch owned media:', error);
    }
  }, []);

  const loadMedia = useCallback(async () => {
    if (!characterId) {
      setErrorMessage('Unable to find the current character');
      setItems([]);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [media, owned] = await Promise.all([
        mediaRepositoryRef.current!.fetchAllMedia(characterId),
        assetRepositoryRef.current!.fetchOwnedAssets('media'),
      ]);
      setItems(media);
      setOwnedIds(owned);
    } catch (error: any) {
      console.error('[MediaSheet] Failed to load media:', error);
      setErrorMessage(error?.message ?? 'Unable to load media');
    } finally {
      setIsLoading(false);
    }
  }, [characterId]);

  useEffect(() => {
    if (isOpened) {
      if (items.length === 0) {
        loadMedia();
      } else {
        fetchOwned();
      }
    } else {
      setPreviewItem(null);
    }
  }, [fetchOwned, isOpened, items.length, loadMedia]);

  const closeSheet = useCallback(() => {
    onIsOpenedChange(false);
  }, [onIsOpenedChange]);

  const ensureOwnership = useCallback(
    async (item: MediaItem) => {
      const trackMediaMilestone = async () => {
        const nextCount = ownedIdsRef.current.size + 1;
        if (QuestProgressTracker.shouldTrackCollectionMilestone(nextCount, [10])) {
          await QuestProgressTracker.track('obtain_media');
        }
      };

      if ((item.price_vcoin ?? 0) === 0 && (item.price_ruby ?? 0) === 0) {
        const success = await assetRepositoryRef.current!.createAsset(item.id, 'media');
        if (success) {
          setOwnedIds(prev => new Set(prev).add(item.id));
          await trackMediaMilestone();
          return true;
        }
        return false;
      }

      const title = item.media_type === 'video' ? 'Buy video' : 'Buy photo';
      const confirmed = await confirmPurchase(
        `${title}`,
        item.price_vcoin ?? 0,
        item.price_ruby ?? 0
      );
      if (!confirmed) {
        return false;
      }

      try {
        setIsPurchasing(true);
        await performPurchase({
          itemId: item.id,
          itemType: 'media',
          priceVcoin: item.price_vcoin ?? 0,
          priceRuby: item.price_ruby ?? 0,
        });
        await refreshCurrency();
        setOwnedIds(prev => new Set(prev).add(item.id));
        await trackMediaMilestone();
        return true;
      } catch (error) {
        handlePurchaseError(error);
        return false;
      } finally {
        setIsPurchasing(false);
      }
    },
    [confirmPurchase, handlePurchaseError, performPurchase, refreshCurrency]
  );

  const handleSelect = useCallback(
    async (item: MediaItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      if (ownedIds.has(item.id)) {
        setPreviewItem(item);
        return;
      }

      const granted = await ensureOwnership(item);
      if (granted) {
        setPreviewItem(item);
      }
    },
    [ensureOwnership, ownedIds]
  );

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => {
      const owned = ownedIds.has(item.id);
      const thumb = item.thumbnail || item.url;
      const cardWidth = (width - 48) / 2; // padding & gap

      return (
        <Pressable
          onPress={() => handleSelect(item)}
          style={[styles.card, { width: cardWidth }]}
        >
          <View style={styles.thumbnailWrapper}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.thumbnail} resizeMode="cover" />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailFallback]}>
                <Ionicons name="image" color="#999" size={28} />
              </View>
            )}
            {!owned && <View style={styles.lockOverlay} />}
            <View style={styles.badgeStack}>
              {!owned && (
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={14} color="#fff" />
                </View>
              )}
              {(item.price_vcoin ?? 0) > 0 || (item.price_ruby ?? 0) > 0 ? (
                <View style={styles.priceBadge}>
                  {item.price_vcoin ? (
                    <Text style={styles.priceText}>{`${item.price_vcoin} VC`}</Text>
                  ) : null}
                  {item.price_ruby ? (
                    <Text style={styles.priceText}>{`${item.price_ruby} Ruby`}</Text>
                  ) : null}
                </View>
              ) : (
                <View style={styles.freeBadge}>
                  <Text style={styles.freeBadgeText}>FREE</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.mediaTitle} numberOfLines={1}>
            {item.media_type === 'video' ? 'Video' : 'Photo'}
          </Text>
          <Text style={styles.mediaSubtitle} numberOfLines={1}>
            {owned ? 'Owned' : ''}
          </Text>
        </Pressable>
      );
    },
    [handleSelect, ownedIds, width]
  );

  return (
    <>
      <Modal
        visible={isOpened}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={closeSheet}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Button
              size="md"
              variant="liquid"
              isIconOnly
              startIconName="close"
              onPress={closeSheet}
            />
            <View style={styles.headerTitleWrapper}>
              <Text style={styles.headerSubtitle}>{characterName || 'Vivivi'}</Text>
              <Text style={styles.headerTitle}>Media Gallery</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.tabBar}>
            {(['video', 'photo'] as TabKey[]).map(tab => (
              <Pressable
                key={tab}
                onPress={() => setSelectedTab(tab)}
                style={[
                  styles.tabButton,
                  selectedTab === tab && styles.tabButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    selectedTab === tab && styles.tabButtonTextActive,
                  ]}
                >
                  {tab === 'video' ? 'Video' : 'Photo'}
                </Text>
              </Pressable>
            ))}
          </View>

          {isLoading && items.length === 0 ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          ) : errorMessage ? (
            <View style={styles.centerContent}>
              <Text style={styles.errorTitle}>Unable to load media</Text>
              <Text style={styles.errorSubtitle}>{errorMessage}</Text>
              <Pressable onPress={loadMedia} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : currentItems.length === 0 ? (
            <View style={styles.centerContent}>
              <Text style={styles.emptyText}>
                {selectedTab === 'video'
                  ? 'No videos available'
                  : 'No photos available'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={currentItems}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              numColumns={2}
              columnWrapperStyle={styles.columnWrapper}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              extraData={ownedIds}
            />
          )}

          {isPurchasing ? (
            <View style={styles.purchasingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          ) : null}
        </View>
        <ConfirmPurchasePortal hostId="media-sheet" active={isOpened} />
      </Modal>

      <MediaPreviewModal
        item={previewItem}
        onClose={() => setPreviewItem(null)}
      />
    </>
  );
};

const MediaPreviewModal: React.FC<{
  item: MediaItem | null;
  onClose: () => void;
}> = ({ item, onClose }) => {
  const videoRef = useRef<Video | null>(null);
  useEffect(() => {
    if (!item && videoRef.current) {
      videoRef.current.stopAsync().catch(() => undefined);
    }
  }, [item]);

  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.previewBackdrop}>
        <View style={styles.previewCard}>
          {item ? (
            isVideoItem(item) ? (
              <Video
                ref={ref => {
                  videoRef.current = ref;
                }}
                style={styles.previewVideo}
                source={{ uri: item.url }}
                useNativeControls
                resizeMode="contain"
                shouldPlay
                isLooping
              />
            ) : (
              <Image
                source={{ uri: item.url }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )
          ) : null}
          <Button
            size='md'
            variant='liquid'
            onPress={onClose}
            style={styles.previewCloseButton}
          >
            Close
          </Button>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    paddingTop: Platform.OS === 'android' ? 32 : 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitleWrapper: {
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: '#fff',
  },
  tabButtonText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  errorSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fff',
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  listContent: {
    paddingBottom: 48,
  },
  card: {
    gap: 8,
  },
  thumbnailWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 0.75,
  },
  thumbnailFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  badgeStack: {
    position: 'absolute',
    top: 8,
    right: 8,
    alignItems: 'flex-end',
    gap: 6,
  },
  lockBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    padding: 6,
  },
  priceBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  priceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  freeBadge: {
    backgroundColor: '#38ef7d',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  freeBadgeText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 11,
  },
  mediaTitle: {
    color: '#fff',
    fontWeight: '600',
  },
  mediaSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  purchasingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewCard: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#0a0a0a',
    padding: 16,
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 360,
    marginBottom: 16,
  },
  previewVideo: {
    width: '100%',
    height: 360,
    marginBottom: 16,
    backgroundColor: '#000',
  },
  previewCloseButton: {
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
});


