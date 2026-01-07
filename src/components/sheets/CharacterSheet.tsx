import React, { useEffect, useState, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { CharacterRepository, type CharacterItem } from '../../repositories/CharacterRepository';
import AssetRepository from '../../repositories/AssetRepository';
import { BackgroundRepository } from '../../repositories/BackgroundRepository';
import { UserCharacterPreferenceService } from '../../services/UserCharacterPreferenceService';
import { Persistence } from '../../utils/persistence';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useSceneActions } from '../../context/SceneActionsContext';
import { GoProButton } from '../GoProButton';
import { BottomSheet, type BottomSheetRef } from '../BottomSheet';

import { DiamondBadge } from '../DiamondBadge';
import VolumeMixedIcon from '../../assets/icons/volume-mixed.svg';
import Button from '../Button';

interface CharacterSheetProps {
  isOpened: boolean;
  onIsOpenedChange: (isOpened: boolean) => void;
  onOpenSubscription?: () => void;
  isDarkBackground?: boolean;
  isPro?: boolean;
}

export type CharacterSheetRef = BottomSheetRef;

export const CharacterSheet = forwardRef<CharacterSheetRef, CharacterSheetProps>(({
  isOpened,
  onIsOpenedChange,
  onOpenSubscription,
  isDarkBackground = true,
  isPro = false,
}, ref) => {
  const sheetRef = useRef<BottomSheetRef>(null);
  const [isLoading, setIsLoading] = useState(false);
  const shimmerOpacity = useRef(new Animated.Value(0.3)).current;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<CharacterItem[]>([]);
  const [ownedCharacterIds, setOwnedCharacterIds] = useState<Set<string>>(new Set());

  const { width, height } = useWindowDimensions();
  const { selectCharacter } = useSceneActions();
  const navigation = useNavigation<any>();

  // Dynamic colors - but force dark overlay on cards for readability
  const textColor = isDarkBackground ? '#fff' : '#000';
  const secondaryTextColor = isDarkBackground ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
  // Always use dark gradient for card overlay to ensure text readability
  const overlayColors = ['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)'] as const;
  const actionButtonBg = isDarkBackground ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';

  // Expose present/dismiss via ref
  useImperativeHandle(ref, () => ({
    present: (index?: number) => sheetRef.current?.present(index),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const fetchOwnedCharacterIds = useCallback(async (completion?: () => void) => {
    try {
      const assetRepository = new AssetRepository();
      const characterIds = await assetRepository.fetchOwnedAssets('character');
      setOwnedCharacterIds(new Set(characterIds));
      completion?.();
    } catch (error) {
      console.error('Failed to fetch owned characters:', error);
      completion?.();
    }
  }, []);

  const load = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    setItems([]);

    try {
      // 1. Fetch ownership first
      const assetRepository = new AssetRepository();
      const characterIds = await assetRepository.fetchOwnedAssets('character');
      const newOwnedSet = new Set(characterIds);
      setOwnedCharacterIds(newOwnedSet);

      // 2. Fetch characters
      const characterRepository = new CharacterRepository();
      let loadedItems = await characterRepository.fetchAllCharacters();

      loadedItems = loadedItems.filter((item) => item.available !== false);

      // 3. Sort using the freshly fetched ownership
      const sortedItems = loadedItems.sort((char1, char2) => {
        const isOwned1 = newOwnedSet.has(char1.id);
        const isOwned2 = newOwnedSet.has(char2.id);
        if (isOwned1 !== isOwned2) return isOwned1 ? -1 : 1;
        return 0;
      });

      setItems(sortedItems);
    } catch (error: any) {
      console.error('❌ [CharacterSheet] Failed to load characters:', error);
      setErrorMessage(error.message || 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  useEffect(() => {
    if (isOpened) {
      if (items.length === 0) {
        load();
      } else {
        fetchOwnedCharacterIds();
      }
    }
  }, [isOpened, items.length, fetchOwnedCharacterIds, load]);

  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerOpacity, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      shimmerOpacity.stopAnimation();
      shimmerOpacity.setValue(0.3);
    }
  }, [isLoading]);

  const filteredItems = useMemo(() => items, [items]);

  const handlePreview = (item: CharacterItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const index = items.findIndex(c => c.id === item.id);

    onIsOpenedChange(false);
    sheetRef.current?.dismiss();

    setTimeout(() => {
      navigation.navigate('CharacterPreview', {
        characters: items,
        initialIndex: index !== -1 ? index : 0,
        isViewMode: true,
        ownedCharacterIds: Array.from(ownedCharacterIds),
        isPro: isPro,
      });
    }, 300);
  };

  const handleSelect = async (item: CharacterItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const index = items.findIndex(c => c.id === item.id);
    const isOwned = ownedCharacterIds.has(item.id);

    onIsOpenedChange(false);
    sheetRef.current?.dismiss();

    if (isOwned) {
      selectCharacter(item);
    } else if (isPro) {
      // PRO user: Auto unlock and select immediately
      try {
        const assetRepository = new AssetRepository();

        // 1. Grant character ownership
        await assetRepository.createAsset(item.id, 'character');
        setOwnedCharacterIds(prev => new Set([...prev, item.id]));

        // 2. Handle default background
        if (item.background_default_id) {
          // Grant background ownership if needed
          const ownedBg = await assetRepository.fetchOwnedAssets('background');
          if (!ownedBg.has(item.background_default_id)) {
            await assetRepository.createAsset(item.background_default_id, 'background');
            console.log('[CharacterSheet] Granted ownership of default background:', item.background_default_id);
          }

          // Save preference
          await UserCharacterPreferenceService.saveUserCharacterPreference(item.id, {
            current_background_id: item.background_default_id,
          });

          // Persist to local storage
          const bgRepo = new BackgroundRepository();
          const bg = await bgRepo.fetchBackground(item.background_default_id);
          if (bg) {
            await Persistence.setBackgroundURL(bg.image || '');
            await Persistence.setBackgroundName(bg.name || '');
            await Persistence.setCharacterBackgroundSelection(item.id, {
              backgroundId: item.background_default_id,
              backgroundURL: bg.image || '',
              backgroundName: bg.name || '',
            });
          }
        }

        selectCharacter(item);
      } catch (error) {
        console.error('Failed to auto-unlock PRO character:', error);
        selectCharacter(item);
      }
    } else {
      setTimeout(() => {
        onOpenSubscription?.();
      }, 300);
    }
  };

  const renderItem = ({ item }: { item: CharacterItem }) => {
    const isOwned = ownedCharacterIds.has(item.id);
    const itemWidth = (width - 40 - 12) / 2;

    return (
      <Pressable
        onPress={() => handleSelect(item)}
        style={({ pressed }) => [
          styles.cardContainer,
          { width: itemWidth },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.imageBackground}>
          {item.default_background?.image && (
            <Image
              source={{ uri: item.default_background.image }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
          )}

          {item.thumbnail_url || item.avatar ? (
            <Image
              source={{ uri: item.thumbnail_url || item.avatar }}
              style={styles.cardImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.cardImagePlaceholder} />
          )}

          {!isOwned && (
            <DiamondBadge size="md" style={styles.diamondBadgeContainer} />
          )}

          <LinearGradient
            colors={overlayColors}
            style={styles.cardContentOverlay}
            locations={[0, 0.5, 1]}
          >
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              {item?.data?.characteristics && (
                <Text style={styles.cardDescription} numberOfLines={1}>
                  {item?.data?.characteristics}
                </Text>
              )}
            </View>

            {isOwned && (
              <View style={styles.actionButtonsRow}>
                <Button
                  variant='liquid'
                  size="lg"
                  style={[styles.actionButtonCircle, { backgroundColor: actionButtonBg }]}
                  onPress={() => {
                    handlePreview(item);
                  }}
                  startIconName='chatbubble-outline'
                >
                </Button>
                <Button
                  size="lg"
                  variant='liquid'
                  fullWidth
                  style={styles.actionButtonPill}
                  onPress={() => {
                    handleSelect(item);
                  }}
                >
                  <VolumeMixedIcon width={24} height={24} fill="#000" />
                </Button>
              </View>
            )}
          </LinearGradient>
        </View>
      </Pressable>
    );
  };

  const renderSkeleton = () => {
    const itemWidth = (width - 40 - 12) / 2;
    return (
      <View style={styles.skeletonGrid}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.skeletonCard,
              { width: itemWidth, opacity: shimmerOpacity }
            ]}
          />
        ))}
      </View>
    );
  };

  const renderContent = () => {
    if (isLoading && items.length === 0) {
      return (
        <View style={{ flex: 1, maxHeight: height * 0.9 }}>
          {renderSkeleton()}
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

    if (filteredItems.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, { color: secondaryTextColor }]}>No characters available</Text>
          <Pressable onPress={load} style={styles.retryButton}>
            <Text style={[styles.retryButtonText, { color: textColor }]}>Reload</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, maxHeight: height * 0.9 }}>
        <FlatList
          data={filteredItems}
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
      title="Characters"
      isDarkBackground={isDarkBackground}
      detents={[0.7, 0.95]}
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
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  columnWrapper: {
    gap: 12,
    marginBottom: 12,
  },
  cardContainer: {
    aspectRatio: 0.6,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  imageBackground: {
    flex: 1,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cardContentOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 40,
    justifyContent: 'flex-end',
  },
  cardInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  cardName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDescription: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textAlign: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    paddingHorizontal: 28
  },
  actionButtonCircle: {
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonPill: {
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  diamondBadgeContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
  },
  skeletonCard: {
    aspectRatio: 0.6,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
