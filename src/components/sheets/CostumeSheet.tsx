import React, { useCallback, useEffect, useMemo, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Skeleton } from '../ui/Skeleton';
import { LinearGradient } from 'expo-linear-gradient';

import { GoProButton } from '../commons/GoProButton';
import { CostumeRepository, type CostumeItem } from '../../repositories/CostumeRepository';
import AssetRepository from '../../repositories/AssetRepository';
import { useSceneActions } from '../../context/SceneActionsContext';
import { DiamondBadge } from '../commons/DiamondBadge';
import { BottomSheet, type BottomSheetRef } from '../commons/BottomSheet';
import { LiquidGlass } from '../commons/LiquidGlass';
import { useVRMContext } from '../../context/VRMContext';
import { IconLock, IconCheck, IconShirt } from '@tabler/icons-react-native';

interface CostumeSheetProps {
  isOpened: boolean;
  onIsOpenedChange: (isOpened: boolean) => void;
  characterId?: string | null;
  onOpenSubscription?: () => void;
  streakDays?: number;
  onOpenStreak?: () => void;
  isDarkBackground?: boolean;
  isPro?: boolean;
}

export type CostumeSheetRef = BottomSheetRef;

export const CostumeSheet = forwardRef<CostumeSheetRef, CostumeSheetProps>(({
  isOpened,
  onIsOpenedChange,
  characterId,
  onOpenSubscription,
  streakDays = 0,
  onOpenStreak,
  isDarkBackground = true,
  isPro = false,
}, ref) => {
  const sheetRef = useRef<BottomSheetRef>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<CostumeItem[]>([]);
  const [ownedCostumeIds, setOwnedCostumeIds] = useState<Set<string>>(new Set());
  const { width, height } = useWindowDimensions();
  const { selectCostume } = useSceneActions();
  const { currentCostume } = useVRMContext();

  const textColor = isDarkBackground ? '#fff' : '#000';
  const secondaryTextColor = isDarkBackground ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';

  useImperativeHandle(ref, () => ({
    present: (index?: number) => sheetRef.current?.present(index),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const effectiveCharacterId = useMemo(() => {
    if (characterId && characterId.trim().length > 0) return characterId;
    return undefined;
  }, [characterId]);

  const load = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const costumeRepository = new CostumeRepository();
      const assetRepository = new AssetRepository();
      const [costumes, ownedIds] = await Promise.all([
        costumeRepository.fetchCostumes(effectiveCharacterId),
        assetRepository.fetchOwnedAssets('character_costume'),
      ]);

      const ownedSet = ownedIds instanceof Set ? ownedIds : new Set(ownedIds as Iterable<string>);
      setOwnedCostumeIds(new Set(ownedSet));

      const filtered = costumes.filter(costume => costume.available !== false);

      const sorted = filtered.sort((a, b) => {
        const ownedA = ownedSet.has(a.id);
        const ownedB = ownedSet.has(b.id);
        if (ownedA !== ownedB) return ownedA ? -1 : 1;
        if (a.streak_days && !b.streak_days) return -1;
        if (!a.streak_days && b.streak_days) return 1;
        if (a.streak_days && b.streak_days) return (a.streak_days ?? 0) - (b.streak_days ?? 0);
        return 0;
      });

      setItems(sorted);
    } catch (error: any) {
      console.error('❌ [CostumeSheet] Failed to load:', error);
      setErrorMessage(error?.message ?? 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveCharacterId]);

  useEffect(() => {
    if (isOpened) load();
  }, [isOpened, load]);

  const handleSelect = useCallback(async (item: CostumeItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    const isOwned = ownedCostumeIds.has(item.id);
    const isStreakItem = typeof item.streak_days === 'number' && item.streak_days > 0;
    const isFree = item.tier === 'free';

    if (isStreakItem && !isPro && !isOwned) {
      sheetRef.current?.dismiss();
      setTimeout(() => onOpenStreak?.(), 300);
      return;
    }

    if (isPro || isOwned || isFree) {
      if ((isPro || isFree) && !isOwned) {
        try {
          const assetRepository = new AssetRepository();
          await assetRepository.createAsset(item.id, 'character_costume');
          setOwnedCostumeIds(prev => new Set([...prev, item.id]));
        } catch (error) {
          console.error('Failed to add costume to owned:', error);
        }
      }
      void selectCostume(item);
    } else {
      sheetRef.current?.dismiss();
      setTimeout(() => onOpenSubscription?.(), 300);
    }
  }, [isPro, ownedCostumeIds, selectCostume, onOpenSubscription, onOpenStreak, streakDays]);

  const renderItem = useCallback(
    ({ item }: { item: CostumeItem }) => {
      const isOwned = ownedCostumeIds.has(item.id);
      const isStreakItem = typeof item.streak_days === 'number' && item.streak_days > 0;
      const isFree = item.tier === 'free';
      const isStreakLocked = !isPro && isStreakItem && !isOwned && streakDays < (item.streak_days ?? 0);
      const isProLocked = !isPro && !isOwned && !isStreakItem && !isFree;
      const isLocked = isProLocked || isStreakLocked;

      // 2 columns Logic
      const cardWidth = (width - 48) / 2; // 48 = 20 (left) + 20 (right) + 8 (gap)
      const cardHeight = cardWidth * 1.5;

      const isSelected = currentCostume ? item.id === currentCostume.id : false;

      return (
        <Pressable
          onPress={() => handleSelect(item)}
          style={[styles.itemWrapper, { width: cardWidth }]}
        >
          <LiquidGlass
            style={[
              styles.cardContainer,
              { height: cardHeight },
              isSelected && styles.selectedBorder
            ]}
            intensity={20}
          >
            {/* Background Image */}
            {item.thumbnail ? (
              <Image
                source={{ uri: item.thumbnail }}
                style={[
                  styles.cardImage,
                  { width: cardWidth, height: cardHeight },
                  isLocked && { opacity: 0.5 }
                ]}
                resizeMode="cover"
                blurRadius={isLocked ? 15 : 0}
              />
            ) : (
              <View style={[styles.placeholder, { width: cardWidth, height: cardHeight }]}>
                <IconShirt size={32} color="rgba(255,255,255,0.2)" />
              </View>
            )}

            {/* Gradient & Overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={StyleSheet.absoluteFill}
            />

            {/* Status Badges (Top Right) */}
            <View style={styles.topRightBadges}>
              {isProLocked && <DiamondBadge size="sm" />}
              {isStreakItem && !isOwned && <DiamondBadge size="sm" />}
            </View>

            {/* Center Lock Status */}
            {isLocked && (
              <View style={StyleSheet.absoluteFill}>
                <View style={styles.centerLockContent}>
                  <View style={styles.lockIconCircle}>
                    <IconLock size={20} color="#fff" />
                  </View>
                  {isStreakLocked && (
                    <Text style={styles.lockLabel}>
                      {item.streak_days} Day Streak
                    </Text>
                  )}
                  {isProLocked && (
                    <Text style={styles.lockLabel}>
                      VIP Only
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Selected Checkmark Overlay */}
            {isSelected && (
              <View style={styles.selectedOverlay}>
                <View style={styles.checkCircle}>
                  <IconCheck size={16} color="#fff" />
                </View>
              </View>
            )}

            {/* Bottom Text Info */}
            <View style={styles.bottomInfo}>
              <Text style={styles.costumeName} numberOfLines={1}>
                {item.costume_name}
              </Text>
              <Text style={styles.costumeTier}>
                {isFree ? 'Free' : isStreakItem ? 'Streak Reward' : 'Premium'}
              </Text>
            </View>

          </LiquidGlass>
        </Pressable>
      );
    },
    [handleSelect, ownedCostumeIds, width, secondaryTextColor, isPro, streakDays, isDarkBackground, currentCostume]
  );

  const renderContent = () => {
    if (isLoading && items.length === 0) {
      const cardWidth = (width - 48) / 2;
      const cardHeight = cardWidth * 1.5;
      const skeletons = Array.from({ length: 6 }).map((_, i) => ({ id: i.toString() }));
      return (
        <View style={{ flex: 1 }}>
          <FlatList
            data={skeletons}
            keyExtractor={(i) => i.id}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            renderItem={() => (
              <View style={{ width: cardWidth, marginBottom: 12 }}>
                <Skeleton width={cardWidth} height={cardHeight} borderRadius={20} />
              </View>
            )}
          />
        </View>
      )
    }

    if (items.length === 0 && !isLoading) {
      return (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, { color: secondaryTextColor }]}>No costumes found.</Text>
          <Pressable onPress={load} style={styles.retryButton}>
            <Text style={[styles.retryButtonText, { color: textColor }]}>Refresh</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  };

  return (
    <BottomSheet
      ref={sheetRef}
      isOpened={isOpened}
      onIsOpenedChange={onIsOpenedChange}
      title="Wardrobe"
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
    padding: 20,
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
  itemWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  cardContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectedBorder: {
    borderWidth: 2,
    borderColor: '#8b5cf6',
  },
  cardImage: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  placeholder: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRightBadges: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'column',
    gap: 4,
  },
  centerLockContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  lockIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  lockLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  selectedOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  costumeName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  costumeTier: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
  },
});
