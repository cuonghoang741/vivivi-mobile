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
import Ionicons from '@expo/vector-icons/Ionicons';

import { GoProButton } from '../GoProButton';
import { CostumeRepository, type CostumeItem } from '../../repositories/CostumeRepository';
import AssetRepository from '../../repositories/AssetRepository';
import { useSceneActions } from '../../context/SceneActionsContext';
import { DiamondBadge } from '../DiamondBadge';
import { BottomSheet, type BottomSheetRef } from '../BottomSheet';

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

  // Dynamic colors
  const textColor = isDarkBackground ? '#fff' : '#000';
  const secondaryTextColor = isDarkBackground ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';

  // Expose present/dismiss via ref
  useImperativeHandle(ref, () => ({
    present: (index?: number) => sheetRef.current?.present(index),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const effectiveCharacterId = useMemo(() => {
    if (characterId && characterId.trim().length > 0) {
      return characterId;
    }
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

      // Sort: Owned first, then streak items, then others
      const sorted = filtered.sort((a, b) => {
        const ownedA = ownedSet.has(a.id);
        const ownedB = ownedSet.has(b.id);
        if (ownedA !== ownedB) return ownedA ? -1 : 1;

        // Streak items after owned but before regular locked
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
    if (isOpened) {
      load();
    }
  }, [isOpened, load]);

  const handleSelect = useCallback(async (item: CostumeItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    const isOwned = ownedCostumeIds.has(item.id);
    const isStreakItem = typeof item.streak_days === 'number' && item.streak_days > 0;
    // If PRO, ignore streak requirements
    const isStreakLocked = !isPro && isStreakItem && !isOwned && streakDays < (item.streak_days ?? 0);

    // Streak locked items - open streak sheet
    if (isStreakLocked) {
      sheetRef.current?.dismiss();
      setTimeout(() => onOpenStreak?.(), 300);
      return;
    }

    // If PRO or already owned, can select directly
    if (isPro || isOwned) {
      // If PRO but not owned, auto-add to owned assets
      if (isPro && !isOwned) {
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
      // Not PRO and not owned - open subscription
      sheetRef.current?.dismiss();
      setTimeout(() => onOpenSubscription?.(), 300);
    }
  }, [isPro, ownedCostumeIds, selectCostume, onOpenSubscription, onOpenStreak, streakDays]);

  const renderItem = useCallback(
    ({ item }: { item: CostumeItem }) => {
      const isOwned = ownedCostumeIds.has(item.id);
      const isStreakItem = typeof item.streak_days === 'number' && item.streak_days > 0;
      const isStreakLocked = !isPro && isStreakItem && !isOwned && streakDays < (item.streak_days ?? 0);
      const isProLocked = !isPro && !isOwned && !isStreakItem;

      const itemWidth = (width - 40 - 24) / 3;
      const itemHeight = itemWidth / 0.7;

      const borderColor = !isDarkBackground ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';

      return (
        <Pressable
          onPress={() => handleSelect(item)}
          style={({ pressed }) => [
            styles.itemContainer,
            { width: itemWidth },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.imageContainer, { width: itemWidth, height: itemHeight, borderColor }]}>
            <View style={[styles.placeholder, { width: itemWidth, height: itemHeight }]} />

            {item.thumbnail ? (
              <Image
                source={{ uri: item.thumbnail }}
                style={[
                  styles.image,
                  { width: itemWidth, height: itemHeight },
                  isStreakLocked && styles.imageBlurred
                ]}
                resizeMode="cover"
                blurRadius={isStreakLocked ? 10 : 0}
              />
            ) : null}

            {(isProLocked || isStreakLocked) && (
              <View style={[styles.darkenOverlay, { width: itemWidth, height: itemHeight }]} />
            )}

            {/* Diamond Badge for PRO locked items */}
            {isProLocked && (
              <DiamondBadge size="sm" style={styles.diamondBadgeContainer} />
            )}

            {/* Diamond badge for Streak items */}
            {isStreakItem && !isOwned && (
              <DiamondBadge size="sm" style={styles.streakBadgeContainer} />
            )}

            {/* Lock overlay content */}
            {(isProLocked || isStreakLocked) ? (
              <View style={styles.lockContentContainer}>
                <View style={[styles.lockIconCircle, isStreakLocked && styles.glassCircle]}>
                  <Ionicons name="lock-closed" size={16} color="#fff" />
                </View>

                {isStreakLocked && (
                  <Text style={styles.streakLockText}>
                    Hit {item.streak_days}-day{'\n'}streak
                  </Text>
                )}
              </View>
            ) : null}
          </View>
          <Text style={[styles.itemName, { color: secondaryTextColor }]} numberOfLines={1}>
            {item.costume_name}
          </Text>
        </Pressable>
      );
    },
    [handleSelect, ownedCostumeIds, width, secondaryTextColor, isPro, streakDays, isDarkBackground]
  );

  const renderContent = () => {
    if (isLoading && items.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={textColor} />
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
          <Text style={[styles.emptyText, { color: secondaryTextColor }]}>No costumes</Text>
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
          keyExtractor={item => item.id}
          numColumns={3}
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
      title="Costumes"
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
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  columnWrapper: {
    gap: 12,
    marginBottom: 16,
  },
  itemContainer: {
    alignItems: 'center',
    gap: 8,
  },
  imageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  placeholder: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  image: {
    borderRadius: 16,
  },
  imageBlurred: {
    opacity: 0.6,
  },
  darkenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
  },
  itemName: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 4,
  },
  errorDetailText: {
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
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
  diamondBadgeContainer: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
  },
  streakBadgeContainer: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
  },
  lockContentContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 5,
  },
  lockIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassCircle: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  streakLockText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
