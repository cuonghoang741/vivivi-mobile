import React, { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { Skeleton } from '../ui/Skeleton';
import { BackgroundRepository, BackgroundItem } from '../../repositories/BackgroundRepository';
import AssetRepository from '../../repositories/AssetRepository';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { GoProButton } from '../commons/GoProButton';
import { useSceneActions } from '../../context/SceneActionsContext';
import { useVRMContext } from '../../context/VRMContext';
import { DiamondBadge } from '../commons/DiamondBadge';
import { BottomSheet, type BottomSheetRef } from '../commons/BottomSheet';
import { IconCarambolaFilled, IconMovie, IconMoon, IconSun, IconLock } from '@tabler/icons-react-native';
import { LiquidGlass } from '../commons/LiquidGlass';
import Button from '../commons/Button';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface BackgroundSheetProps {
  isOpened: boolean;
  onIsOpenedChange: (isOpened: boolean) => void;
  onOpenSubscription?: () => void;
  isDarkBackground?: boolean;
  isPro?: boolean;
  currentBackgroundId?: string | null;
}

export type BackgroundSheetRef = BottomSheetRef;

export const BackgroundSheet = forwardRef<BackgroundSheetRef, BackgroundSheetProps>(({
  isOpened,
  onIsOpenedChange,
  onOpenSubscription,
  isDarkBackground = true,
  isPro = false,
  currentBackgroundId,
}, ref) => {
  const sheetRef = useRef<BottomSheetRef>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<BackgroundItem[]>([]);
  const [ownedBackgroundIds, setOwnedBackgroundIds] = useState<Set<string>>(new Set());
  const { width, height } = useWindowDimensions();
  const { selectBackground } = useSceneActions();
  const { initialData } = useVRMContext();

  // Dynamic colors
  const textColor = isDarkBackground ? '#fff' : '#1A1A1A';
  const secondaryTextColor = isDarkBackground ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
  const cardBg = isDarkBackground ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)';
  const cardBorder = isDarkBackground ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';

  // Expose present/dismiss via ref
  useImperativeHandle(ref, () => ({
    present: (index?: number) => sheetRef.current?.present(index),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const load = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    setItems([]);

    try {
      const backgroundRepository = new BackgroundRepository();
      const assetRepository = new AssetRepository();

      const [backgrounds, ownedIds] = await Promise.all([
        backgroundRepository.fetchAllBackgrounds(),
        assetRepository.fetchOwnedAssets('background'),
      ]);

      const availableBackgrounds = backgrounds.filter((b) => b.available);
      const ownedSet = new Set(ownedIds);
      setOwnedBackgroundIds(ownedSet);

      // Sort: Owned first, then natural order (Tier ASC from DB)
      const sorted = availableBackgrounds.sort((a, b) => {
        const isOwned1 = ownedSet.has(a.id);
        const isOwned2 = ownedSet.has(b.id);
        if (isOwned1 !== isOwned2) return isOwned1 ? -1 : 1;
        return 0;
      });

      setItems(sorted);
    } catch (error: any) {
      console.error('❌ [BackgroundSheet] Failed to load:', error);
      setErrorMessage(error.message || 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const fetchOwnedBackgrounds = useCallback(async () => {
    try {
      const assetRepository = new AssetRepository();
      const ownedIds = await assetRepository.fetchOwnedAssets('background');
      setOwnedBackgroundIds(new Set(ownedIds));
    } catch (error) {
      console.error('Failed to fetch owned backgrounds:', error);
    }
  }, []);

  useEffect(() => {
    if (isOpened) {
      if (items.length === 0) {
        load();
      } else {
        fetchOwnedBackgrounds();
      }
    }
  }, [isOpened, items.length, load, fetchOwnedBackgrounds]);

  // Prefetch images for caching
  useEffect(() => {
    if (items.length > 0) {
      const urlsToPrefetch: string[] = [];
      items.forEach((item) => {
        if (item.thumbnail) urlsToPrefetch.push(item.thumbnail);
        if (item.image) urlsToPrefetch.push(item.image);
      });

      if (urlsToPrefetch.length > 0) {
        Image.prefetch(urlsToPrefetch);
      }
    }
  }, [items]);

  const handleSelect = useCallback(async (item: BackgroundItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const isOwned = ownedBackgroundIds.has(item.id);
    const isFree = item.tier === 'free';

    // If PRO, Free tier, or already owned, can select directly
    if (isPro || isOwned || isFree) {
      // If (PRO or Free) but not owned, auto-add to owned assets
      if ((isPro || isFree) && !isOwned) {
        try {
          const assetRepository = new AssetRepository();
          await assetRepository.createAsset(item.id, 'background');
          setOwnedBackgroundIds(prev => new Set([...prev, item.id]));
        } catch (error) {
          console.error('Failed to add background to owned:', error);
        }
      }
      void selectBackground(item);
    } else {
      // Not PRO, Not Free, not owned - open subscription
      sheetRef.current?.dismiss();
      setTimeout(() => onOpenSubscription?.(), 300);
    }
  }, [isPro, ownedBackgroundIds, selectBackground, onOpenSubscription]);

  const Badge = ({ icon, label, color = secondaryTextColor }: { icon: React.ReactNode, label: string, color?: string }) => (
    <View style={[styles.badge, { borderColor: isDarkBackground ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
      {icon}
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );

  const renderItem = ({ item }: { item: BackgroundItem }) => {
    const isOwned = ownedBackgroundIds.has(item.id);
    const isFree = item.tier === 'free';
    const isLocked = !isPro && !isOwned && !isFree;

    // 2 Columns
    const gap = 12;
    const padding = 20;
    const itemWidth = (width - padding * 2 - gap) / 2;

    const isSelected = currentBackgroundId ? currentBackgroundId === item.id : initialData?.preference?.backgroundId === item.id;

    return (
      <Pressable
        onPress={() => handleSelect(item)}
        style={({ pressed }) => [
          styles.cardContainer,
          {
            width: itemWidth,
            backgroundColor: isSelected
              ? (isDarkBackground ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)')
              : cardBg,
            borderColor: isSelected
              ? (isDarkBackground ? '#fff' : '#000')
              : cardBorder,
            borderWidth: isSelected ? 1.5 : 1,
          },
          pressed && styles.pressed,
        ]}
      >
        {/* Image Section */}
        <View style={[styles.imageWrapper, { height: itemWidth }]}>
          {(item.thumbnail || item.image) ? (
            <Image
              source={{ uri: item.thumbnail || item.image }}
              style={styles.image}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.image, { backgroundColor: isDarkBackground ? '#333' : '#eee' }]} />
          )}

          {/* Overlay Gradient for text readability if needed, or status */}
          {isLocked && (
            <View style={styles.lockedOverlay}>
              <View style={styles.lockCircle}>
                <IconLock size={16} color="#fff" />
              </View>
            </View>
          )}

          {isSelected && (
            <View style={styles.selectedCheck}>
              <Ionicons name="checkmark-circle" size={24} color={isDarkBackground ? "#fff" : "#000"} />
            </View>
          )}
        </View>

        {/* Content Section */}
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: textColor }]} numberOfLines={1}>
            {item.name}
          </Text>

          <View style={styles.badgesRow}>
            {/* Type Badge (Video/Image) */}
            {item.video_url ? (
              <Badge
                icon={<IconCarambolaFilled size={10} color={isDarkBackground ? "#FFD700" : "#F59E0B"} />}
                label="Dynamic"
                color={isDarkBackground ? "#DDD" : "#444"}
              />
            ) : (
              <Badge
                icon={<Ionicons name="image" size={10} color={secondaryTextColor} />}
                label="Static"
                color={secondaryTextColor}
              />
            )}

            {/* Theme Badge */}
            <Badge
              icon={item.is_dark
                ? <IconMoon size={10} color={isDarkBackground ? "#A5B4FC" : "#6366F1"} />
                : <IconSun size={10} color={isDarkBackground ? "#FDBA74" : "#F97316"} />
              }
              label={item.is_dark ? "Dark" : "Light"}
              color={secondaryTextColor}
            />
          </View>

          {/* Pro Tag if locked */}
          {isLocked && (
            <View style={styles.proTagContainer}>
              <DiamondBadge size="sm" />
              <Text style={styles.proText}>Pro</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  const renderContent = () => {
    if (isLoading && items.length === 0) {
      const gap = 12;
      const padding = 20;
      const itemWidth = (width - padding * 2 - gap) / 2;
      const skeletons = Array.from({ length: 6 }).map((_, i) => ({ id: i.toString() }));

      return (
        <View style={{ flex: 1, maxHeight: height * 0.9 }}>
          <FlatList
            data={skeletons}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={() => (
              <View style={[styles.cardContainer, { width: itemWidth, height: itemWidth + 80, backgroundColor: cardBg, borderColor: cardBorder }]}>
                <Skeleton width="100%" height={itemWidth} style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
                <View style={{ padding: 12, gap: 8 }}>
                  <Skeleton width="60%" height={16} borderRadius={4} />
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Skeleton width={40} height={16} borderRadius={4} />
                    <Skeleton width={40} height={16} borderRadius={4} />
                  </View>
                </View>
              </View>
            )}
          />
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: textColor }]}>Failed to load</Text>
          <Text style={[styles.errorDetailText, { color: secondaryTextColor }]}>{errorMessage}</Text>
          <Pressable onPress={load} style={styles.retryButton}>
            <Text style={[styles.retryButtonText, { color: textColor }]}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    if (items.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, { color: secondaryTextColor }]}>No backgrounds found</Text>
          <Pressable onPress={load} style={styles.retryButton}>
            <Text style={[styles.retryButtonText, { color: textColor }]}>Reload</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, maxHeight: height * 0.9 }}>
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
        />
      </View>
    );
  };

  return (
    <BottomSheet
      ref={sheetRef}
      isOpened={isOpened}
      onIsOpenedChange={onIsOpenedChange}
      title="Place"
      isDarkBackground={isDarkBackground}
      headerLeft={
        !isPro ? (
          <GoProButton onPress={() => {
            sheetRef.current?.dismiss();
            setTimeout(() => onOpenSubscription?.(), 300);
          }} />
        ) : undefined
      }
    >
      {renderContent()}
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    minHeight: 200,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  columnWrapper: {
    gap: 12,
    marginBottom: 12,
  },
  cardContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  imageWrapper: {
    width: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  cardContent: {
    padding: 12,
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  lockCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  selectedCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  proTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  proText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFD700', // Gold/Yellow
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorDetailText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
