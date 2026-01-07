import React, { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Image,
  useWindowDimensions,
  FlatList,
} from 'react-native';
import { BackgroundRepository, BackgroundItem } from '../../repositories/BackgroundRepository';
import AssetRepository from '../../repositories/AssetRepository';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { GoProButton } from '../GoProButton';
import { useSceneActions } from '../../context/SceneActionsContext';
import { DiamondBadge } from '../DiamondBadge';
import { BottomSheet, type BottomSheetRef } from '../BottomSheet';

interface BackgroundSheetProps {
  isOpened: boolean;
  onIsOpenedChange: (isOpened: boolean) => void;
  onOpenSubscription?: () => void;
  isDarkBackground?: boolean;
  isPro?: boolean;
}

export type BackgroundSheetRef = BottomSheetRef;

export const BackgroundSheet = forwardRef<BackgroundSheetRef, BackgroundSheetProps>(({
  isOpened,
  onIsOpenedChange,
  onOpenSubscription,
  isDarkBackground = true,
  isPro = false,
}, ref) => {
  const sheetRef = useRef<BottomSheetRef>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<BackgroundItem[]>([]);
  const [ownedBackgroundIds, setOwnedBackgroundIds] = useState<Set<string>>(new Set());
  const { width, height } = useWindowDimensions();
  const { selectBackground } = useSceneActions();

  // Dynamic colors
  const textColor = isDarkBackground ? '#fff' : '#000';
  const secondaryTextColor = isDarkBackground ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';

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

      // Sort: Owned first, then others
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

  const handleSelect = useCallback(async (item: BackgroundItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const isOwned = ownedBackgroundIds.has(item.id);

    // If PRO or already owned, can select directly
    if (isPro || isOwned) {
      // If PRO but not owned, auto-add to owned assets
      if (isPro && !isOwned) {
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
      // Not PRO and not owned - open subscription
      sheetRef.current?.dismiss();
      setTimeout(() => onOpenSubscription?.(), 300);
    }
  }, [isPro, ownedBackgroundIds, selectBackground, onOpenSubscription]);

  const renderItem = ({ item }: { item: BackgroundItem }) => {
    const isOwned = ownedBackgroundIds.has(item.id);
    const isLocked = !isPro && !isOwned;
    const itemWidth = (width - 40 - 24) / 3;

    return (
      <Pressable
        onPress={() => handleSelect(item)}
        style={({ pressed }) => [
          styles.itemContainer,
          { width: itemWidth },
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.imageContainer, { width: itemWidth, height: itemWidth }]}>
          <View style={[styles.placeholder, { width: itemWidth, height: itemWidth }]} />
          {(item.thumbnail || item.image) ? (
            <Image
              source={{ uri: item.thumbnail || item.image }}
              style={[styles.image, { width: itemWidth, height: itemWidth }]}
              resizeMode="cover"
            />
          ) : null}

          {item.video_url && (
            <View style={styles.videoIconContainer}>
              <Ionicons name="videocam" size={14} color="rgba(255,255,255,0.9)" />
            </View>
          )}

          {isLocked && (
            <View style={[styles.darkenOverlay, { width: itemWidth, height: itemWidth }]} />
          )}

          {isLocked && (
            <DiamondBadge size="sm" style={styles.diamondBadgeContainer} />
          )}

          {isLocked ? (
            <View style={styles.lockIconContainer}>
              <View style={styles.lockIconCircle}>
                <Ionicons name="lock-closed" size={16} color="#fff" />
              </View>
            </View>
          ) : null}
        </View>

        <Text style={[styles.itemName, { color: secondaryTextColor }]} numberOfLines={1}>
          {item.name}
        </Text>
      </Pressable>
    );
  };

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
          <Text style={[styles.emptyText, { color: secondaryTextColor }]}>No backgrounds</Text>
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
      title="Backgrounds"
      isDarkBackground={isDarkBackground}
      headerRight={
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
  lockIconContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  videoIconContainer: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 6,
    padding: 3,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
