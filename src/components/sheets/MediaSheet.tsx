import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

import AssetRepository from '../../repositories/AssetRepository';
import { MediaRepository, type MediaItem } from '../../repositories/MediaRepository';
import { usePurchaseContext, ConfirmPurchasePortal } from '../../context/PurchaseContext';

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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isUnlockingAll, setIsUnlockingAll] = useState(false);

  const mediaRepositoryRef = useRef(new MediaRepository());
  const assetRepositoryRef = useRef(new AssetRepository());

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
      const owned = await assetRepositoryRef.current.fetchOwnedAssets('media');
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
        mediaRepositoryRef.current.fetchAllMedia(characterId),
        assetRepositoryRef.current.fetchOwnedAssets('media'),
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
      if (!items.length) {
        loadMedia();
      } else {
        fetchOwned();
      }
    } else {
      setLightboxIndex(null);
    }
  }, [fetchOwned, isOpened, items.length, loadMedia]);

  const closeSheet = useCallback(() => {
    onIsOpenedChange(false);
  }, [onIsOpenedChange]);

  const handleUnlockAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    setIsUnlockingAll(true);
    Alert.alert(
      'Unlock All Media',
      'Subscriptions are not available yet in the native build. Please use the Swift version for now.'
    );
    setTimeout(() => setIsUnlockingAll(false), 700);
  }, []);

  const ensureOwnership = useCallback(
    async (item: MediaItem) => {
      if ((item.price_vcoin ?? 0) === 0 && (item.price_ruby ?? 0) === 0) {
        const success = await assetRepositoryRef.current.createAsset(item.id, 'media');
        if (success) {
          setOwnedIds(prev => new Set(prev).add(item.id));
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
      const index = sortedItems.findIndex(entry => entry.id === item.id);
      if (index === -1) return;

      if (ownedIds.has(item.id)) {
        setLightboxIndex(index);
        return;
      }

      const granted = await ensureOwnership(item);
      if (granted) {
        setLightboxIndex(index);
      }
    },
    [ensureOwnership, ownedIds, sortedItems]
  );

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => {
      const owned = ownedIds.has(item.id);
      const thumb = item.thumbnail || item.url;
      const cardWidth = (width - 48) / 2;

      return (
        <Pressable onPress={() => handleSelect(item)} style={[styles.card, { width: cardWidth }]}>
          <View style={styles.thumbnailWrapper}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.thumbnail} resizeMode="cover" />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailFallback]}>
                <Ionicons name="image" color="#999" size={26} />
              </View>
            )}
            {!owned && <View style={styles.lockOverlay} />}
            <View style={styles.badgeStack}>
              {!owned ? (
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={14} color="#fff" />
                </View>
              ) : (
                <View style={styles.ownedBadge}>
                  <Ionicons name="sparkles" size={12} color="#ffaadf" />
                  <Text style={styles.ownedBadgeText}>OWNED</Text>
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
            {owned ? 'Unlocked' : ''}
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
        <LinearGradient
          colors={['#06000C', '#1B001E', '#320E31', '#07000B']}
          style={styles.gradient}
        >
          <View style={styles.topBar}>
            <Pressable
              onPress={handleUnlockAll}
              style={({ pressed }) => [
                styles.unlockButton,
                (pressed || isUnlockingAll) && styles.unlockButtonActive,
              ]}
            >
              <Ionicons name="sparkles" size={14} color="#fff" />
              <Text style={styles.unlockLabel}>Unlock All</Text>
            </Pressable>

            <View style={styles.segmentedControl}>
              {(['video', 'photo'] as TabKey[]).map(tab => {
                const active = selectedTab === tab;
                return (
                  <Pressable
                    key={tab}
                    onPress={() => setSelectedTab(tab)}
                    style={[styles.segmentButton, active && styles.segmentButtonActive]}
                  >
                    <Text
                      style={[styles.segmentLabel, active && styles.segmentLabelActive]}
                    >
                      {tab === 'video' ? 'Videos' : 'Photos'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={closeSheet}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            >
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.hero}>
            <Text style={styles.heroOverline}>{characterName || 'Vivivi'}</Text>
            <Text style={styles.heroTitle}>Media Gallery</Text>
            <Text style={styles.heroSubtitle}>Unlocked memories, ready to binge</Text>
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
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : currentItems.length === 0 ? (
            <View style={styles.centerContent}>
              <Text style={styles.emptyText}>
                {selectedTab === 'video' ? 'No videos available' : 'No photos available'}
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
        </LinearGradient>
        <ConfirmPurchasePortal hostId="media-sheet" active={isOpened} />
      </Modal>

      <MediaLightbox
        visible={lightboxIndex !== null}
        items={sortedItems}
        startIndex={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  );
};

const MediaLightbox: React.FC<{
  visible: boolean;
  items: MediaItem[];
  startIndex: number;
  onClose: () => void;
}> = ({ visible, items, startIndex, onClose }) => {
  const listRef = useRef<FlatList<MediaItem>>(null);
  const [index, setIndex] = useState(startIndex);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setIndex(startIndex);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: startIndex, animated: false });
    });
  }, [startIndex, visible]);

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => {
      if (isVideoItem(item)) {
        return (
          <Video
            source={{ uri: item.url }}
            style={styles.lightboxVideo}
            shouldPlay
            isLooping
            resizeMode="contain"
            isMuted={muted}
            useNativeControls={false}
          />
        );
      }
      return <Image source={{ uri: item.url }} style={styles.lightboxImage} resizeMode="contain" />;
    },
    [muted]
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} transparent>
      <View style={styles.lightboxBackdrop}>
        <FlatList
          ref={listRef}
          data={items}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={event => {
            const next = Math.round(
              event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width
            );
            setIndex(next);
          }}
        />
        <View style={styles.lightboxActions}>
          <Pressable
            onPress={() => setMuted(prev => !prev)}
            style={({ pressed }) => [
              styles.lightboxIconButton,
              pressed && styles.lightboxIconButtonPressed,
            ]}
          >
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#fff" />
          </Pressable>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.lightboxIconButton,
              pressed && styles.lightboxIconButtonPressed,
            ]}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.lightboxCounter}>
          <Text style={styles.lightboxCounterText}>
            {index + 1}/{items.length}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 48 : 32,
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  unlockButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  unlockLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 3,
  },
  segmentButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  segmentButtonActive: {
    backgroundColor: '#fff',
  },
  segmentLabel: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    fontWeight: '600',
  },
  segmentLabelActive: {
    color: '#06000C',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  closeButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 12,
  },
  heroOverline: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 2,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    marginTop: 4,
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
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 18,
  },
  listContent: {
    paddingBottom: 64,
  },
  card: {
    gap: 8,
  },
  thumbnailWrapper: {
    borderRadius: 18,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  ownedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ownedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  priceBadge: {
    backgroundColor: 'rgba(0,0,0,0.65)',
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
    fontSize: 13,
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
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  lightboxVideo: {
    width: '100%',
    height: '100%',
  },
  lightboxImage: {
    width: '100%',
    height: '100%',
  },
  lightboxActions: {
    position: 'absolute',
    top: 48,
    right: 24,
    flexDirection: 'row',
    gap: 12,
  },
  lightboxIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  lightboxIconButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  lightboxCounter: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  lightboxCounterText: {
    color: '#fff',
    fontWeight: '600',
  },
});


