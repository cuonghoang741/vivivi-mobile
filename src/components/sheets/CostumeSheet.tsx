import React, { useCallback, useEffect, useMemo, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Skeleton } from '../ui/Skeleton';

import { GoProButton } from '../GoProButton';
import { CostumeRepository, type CostumeItem } from '../../repositories/CostumeRepository';
import AssetRepository from '../../repositories/AssetRepository';
import { useSceneActions } from '../../context/SceneActionsContext';
import { DiamondBadge } from '../DiamondBadge';
import { BottomSheet, type BottomSheetRef } from '../BottomSheet';
import { LiquidGlass } from '../LiquidGlass';
import { useVRMContext } from '../../context/VRMContext';

type CostumeListItem =
  | { type: 'costume'; data: CostumeItem }
  | { type: 'secret'; count: number };

interface CostumeSheetProps {
  isOpened: boolean;
  onIsOpenedChange: (isOpened: boolean) => void;
  characterId?: string | null;
  onOpenSubscription?: () => void;
  streakDays?: number;
  onOpenStreak?: () => void;
  isDarkBackground?: boolean;
  isPro?: boolean;
  preloadedCostumes?: CostumeItem[];
  preloadedOwnedCostumeIds?: Set<string>;
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
  preloadedCostumes,
  preloadedOwnedCostumeIds,
}, ref) => {
  const sheetRef = useRef<BottomSheetRef>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<CostumeItem[]>([]);
  const [ownedCostumeIds, setOwnedCostumeIds] = useState<Set<string>>(new Set());
  const { width, height } = useWindowDimensions();
  const { selectCostume } = useSceneActions();
  const { currentCostume } = useVRMContext();

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
    // If we have preloaded data, just set it and return
    if (preloadedCostumes && preloadedOwnedCostumeIds) {
      setOwnedCostumeIds(new Set(preloadedOwnedCostumeIds));
      
      const filtered = preloadedCostumes.filter(costume =>
        costume.available !== false || (costume.metadata && costume.metadata.isLocked !== undefined)
      );

      const sorted = filtered.sort((a, b) => {
        const ownedA = preloadedOwnedCostumeIds.has(a.id);
        const ownedB = preloadedOwnedCostumeIds.has(b.id);
        const lockedA = a.metadata?.isLocked === true;
        const lockedB = b.metadata?.isLocked === true;
        
        if (lockedA !== lockedB) return lockedA ? 1 : -1;
        if (ownedA !== ownedB) return ownedA ? -1 : 1;
        if (a.streak_days && !b.streak_days) return -1;
        if (!a.streak_days && b.streak_days) return 1;
        if (a.streak_days && b.streak_days) return (a.streak_days ?? 0) - (b.streak_days ?? 0);
        return 0;
      });

      setItems(sorted);
      return;
    }

    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const costumeRepository = new CostumeRepository();
      const assetRepository = new AssetRepository();
      const [costumes, ownedIds] = await Promise.all([
        costumeRepository.fetchCostumes(effectiveCharacterId, true),
        assetRepository.fetchOwnedAssets('character_costume'),
      ]);

      const ownedSet = ownedIds instanceof Set ? ownedIds : new Set(ownedIds as Iterable<string>);
      setOwnedCostumeIds(new Set(ownedSet));

      const filtered = costumes.filter(costume =>
        costume.available !== false || (costume.metadata && costume.metadata.isLocked !== undefined)
      );

      const sorted = filtered.sort((a, b) => {
        const ownedA = ownedSet.has(a.id);
        const ownedB = ownedSet.has(b.id);

        const lockedA = a.metadata?.isLocked === true;
        const lockedB = b.metadata?.isLocked === true;
        if (lockedA !== lockedB) return lockedA ? 1 : -1;

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
  }, [effectiveCharacterId, preloadedCostumes, preloadedOwnedCostumeIds]);

  useEffect(() => {
    if (isOpened) {
      load();
    }
  }, [isOpened, load]);

  const handleSecretPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    Alert.alert(
      '🔒',
      "This is a secret that you'll surely love, do your best to unlock it.",
      [{ text: 'OK' }]
    );
  }, []);

  const handleSelect = useCallback(async (item: CostumeItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    const isOwned = ownedCostumeIds.has(item.id);
    const isStreakItem = typeof item.streak_days === 'number' && item.streak_days > 0;
    // User request: trigger StreakSheet for any unowned streak item if not Pro
    if (isStreakItem && !isPro && !isOwned) {
      sheetRef.current?.dismiss();
      setTimeout(() => onOpenStreak?.(), 300);
      return;
    }

    // If PRO or already owned, can select directly
    if (isPro || isOwned) {
      // Trigger visually immediately
      void selectCostume(item);
      
      // If PRO but not owned, auto-add to owned assets in background
      if (isPro && !isOwned) {
        setTimeout(async () => {
          try {
            const assetRepository = new AssetRepository();
            await assetRepository.createAsset(item.id, 'character_costume');
            setOwnedCostumeIds(prev => new Set([...prev, item.id]));
          } catch (error) {
            console.error('Failed to add costume to owned:', error);
          }
        }, 0);
      }
    } else {
      // Not PRO and not owned - open subscription
      sheetRef.current?.dismiss();
      setTimeout(() => onOpenSubscription?.(), 300);
    }
  }, [isPro, ownedCostumeIds, selectCostume, onOpenSubscription, onOpenStreak, streakDays]);

  const renderCostumeCard = useCallback(
    (item: CostumeItem) => {
      const isOwned = ownedCostumeIds.has(item.id);
      const isStreakItem = typeof item.streak_days === 'number' && item.streak_days > 0;
      const isStreakLocked = !isPro && isStreakItem && !isOwned && streakDays < (item.streak_days ?? 0);
      const isProLocked = !isPro && !isOwned && !isStreakItem;

      const itemWidth = (width - 40 - 24) / 3;
      const itemHeight = itemWidth / 0.7;

      const isSelected = currentCostume ? item.id === currentCostume.id : false;

      return (
        <View style={[styles.itemContainer, { width: itemWidth }]}>
          <LiquidGlass
            onPress={() => handleSelect(item)}
            style={[
              styles.imageContainer,
              { width: itemWidth, height: itemHeight },
              isSelected && { borderWidth: 2, borderColor: isDarkBackground ? '#fff' : 'rgba(0,0,0,0.5)' }
            ]}
          >
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
                {isStreakLocked && (
                  <Text style={styles.streakLockText}>
                    Hit {item.streak_days}-day{'\n'}streak
                  </Text>
                )}
              </View>
            ) : null}
          </LiquidGlass>
          <Text style={[styles.itemName, { color: secondaryTextColor }]} numberOfLines={1}>
            {item.costume_name}
          </Text>
        </View>
      );
    },
    [handleSelect, ownedCostumeIds, width, secondaryTextColor, isPro, streakDays, isDarkBackground, currentCostume]
  );

  const renderSecretCard = useCallback(
    (count: number) => {
      const itemWidth = (width - 40 - 24) / 3;
      const itemHeight = itemWidth / 0.7;

      return (
        <View style={[styles.itemContainer, { width: itemWidth }]}>
          <Pressable onPress={handleSecretPress}>
            <LinearGradient
              colors={['rgba(255, 130, 180, 0.15)', 'rgba(255, 87, 154, 0.1)', 'rgba(200, 60, 120, 0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.secretCard,
                { width: itemWidth, height: itemHeight },
              ]}
            >
              {/* Sparkle decorations */}
              <View style={[styles.sparkle, { top: '15%', left: '18%' }]}>
                <Ionicons name="sparkles" size={10} color="rgba(255, 130, 180, 0.35)" />
              </View>
              <View style={[styles.sparkle, { top: '25%', right: '15%' }]}>
                <Ionicons name="sparkles" size={8} color="rgba(255, 150, 200, 0.3)" />
              </View>
              <View style={[styles.sparkle, { bottom: '20%', left: '22%' }]}>
                <Ionicons name="sparkles" size={7} color="rgba(255, 120, 170, 0.3)" />
              </View>

              {/* Key icon */}
              <View style={styles.secretIconContainer}>
                <LinearGradient
                  colors={['rgba(255, 130, 180, 0.2)', 'rgba(255, 87, 154, 0.12)']}
                  style={styles.secretIconGlow}
                >
                  <Ionicons name="key" size={22} color="rgba(255, 120, 170, 0.7)" />
                </LinearGradient>
              </View>

              {/* Secret count text */}
              <Text style={styles.secretLabel}>
                {count} {count === 1 ? 'secret' : 'secrets'}
              </Text>
            </LinearGradient>
          </Pressable>
          <Text style={[styles.itemName, { color: secondaryTextColor }]} numberOfLines={1}>
            Secret
          </Text>
        </View>
      );
    },
    [width, secondaryTextColor, handleSecretPress]
  );

  // Build the list data with secret card appended
  const listData = useMemo((): CostumeListItem[] => {
    if (isPro) {
      // PRO users see all costumes directly
      return items.map(item => ({ type: 'costume' as const, data: item }));
    }

    // Free users see normal items, and one secret card for locked ones
    const normalItems = items.filter(c => c.metadata?.isLocked !== true);
    const hiddenCount = items.filter(c => c.metadata?.isLocked === true).length;

    const costumeItems: CostumeListItem[] = normalItems.map(item => ({ type: 'costume' as const, data: item }));
    if (hiddenCount > 0) {
      costumeItems.push({ type: 'secret' as const, count: hiddenCount });
    }
    return costumeItems;
  }, [items, isPro]);

  const renderListItem = useCallback(
    ({ item }: { item: CostumeListItem }) => {
      if (item.type === 'secret') {
        return renderSecretCard(item.count);
      }
      return renderCostumeCard(item.data);
    },
    [renderCostumeCard, renderSecretCard]
  );

  const renderContent = () => {
    if (isLoading && items.length === 0) {
      const itemWidth = (width - 40 - 24) / 3;
      const itemHeight = itemWidth / 0.7;
      const skeletons = Array.from({ length: 15 }).map((_, i) => ({ id: i.toString() }));

      return (
        <View style={{ flex: 1, maxHeight: height * 0.9 }}>
          <FlatList
            data={skeletons}
            keyExtractor={(item) => item.id}
            numColumns={3}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={() => (
              <View style={[styles.itemContainer, { width: itemWidth }]}>
                <Skeleton width={itemWidth} height={itemHeight} borderRadius={16} />
                <Skeleton width="80%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
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
          data={listData}
          renderItem={renderListItem}
          keyExtractor={(item, index) => item.type === 'costume' ? item.data.id : `secret-${index}`}
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
    // borderRadius handled by container overflow: 'hidden'
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
  // Secret card styles
  secretCard: {
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 130, 180, 0.15)',
  },
  sparkle: {
    position: 'absolute',
  },
  secretIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  secretIconGlow: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secretLabel: {
    color: 'rgba(255, 130, 180, 0.8)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
