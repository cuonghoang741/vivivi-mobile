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
import { CharacterRepository, type CharacterItem } from '../../repositories/CharacterRepository';
import AssetRepository from '../../repositories/AssetRepository';
import { BackgroundRepository } from '../../repositories/BackgroundRepository';
import { UserCharacterPreferenceService } from '../../services/UserCharacterPreferenceService';
import { Persistence } from '../../utils/persistence';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useSceneActions } from '../../context/SceneActionsContext';
import { useVRMContext } from '../../context/VRMContext';
import { GoProButton } from '../commons/GoProButton';
import { BottomSheet, type BottomSheetRef } from '../commons/BottomSheet';
import { DiamondBadge } from '../commons/DiamondBadge';
import { LiquidGlassView } from '@callstack/liquid-glass';
import { useVideoPreloader } from '../../hook/useVideoPreloader';
import { IconWoman } from '@tabler/icons-react-native';
import { brand } from '../../styles/palette';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

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
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  const { height } = useWindowDimensions();
  const { selectCharacter } = useSceneActions();
  const { currentCharacter } = useVRMContext();
  const navigation = useNavigation<any>();

  // Dynamic colors
  const textColor = isDarkBackground ? '#fff' : '#000';
  const secondaryTextColor = isDarkBackground ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';

  // Sync current selection
  useEffect(() => {
    if (currentCharacter) {
      setSelectedCharacterId(currentCharacter.id);
    }
  }, [currentCharacter]);

  // Preload character videos
  useVideoPreloader({
    characters: items,
    autoStart: isOpened && items.length > 0,
  });

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
      // 1. Fetch ownership
      const assetRepository = new AssetRepository();
      const characterIds = await assetRepository.fetchOwnedAssets('character');
      const newOwnedSet = new Set(characterIds);
      setOwnedCharacterIds(newOwnedSet);

      // 2. Fetch characters
      const characterRepository = new CharacterRepository();
      let loadedItems = await characterRepository.fetchAllCharacters();

      // Auto-grant for PRO user
      if (isPro) {
        const unownedItems = loadedItems.filter(
          (item) => item.available !== false && !newOwnedSet.has(item.id)
        );

        if (unownedItems.length > 0) {
          await Promise.all(
            unownedItems.map(async (item) => {
              try {
                await assetRepository.createAsset(item.id, 'character');
                newOwnedSet.add(item.id);
              } catch (err) { }
            })
          );
          setOwnedCharacterIds(new Set(newOwnedSet));
        }
      }

      // 3. Sort: Owned first
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
  }, [isLoading, isPro]);

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
          Animated.timing(shimmerOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(shimmerOpacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      shimmerOpacity.stopAnimation();
      shimmerOpacity.setValue(0.3);
    }
  }, [isLoading]);

  const handleSelect = async (item: CharacterItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isOwned = ownedCharacterIds.has(item.id);

    // Close sheet immediately
    onIsOpenedChange(false);
    sheetRef.current?.dismiss();

    if (isOwned) {
      selectCharacter(item);
    } else if (isPro) {
      // Auto-unlock logic for PRO
      (async () => {
        try {
          const assetRepository = new AssetRepository();
          await assetRepository.createAsset(item.id, 'character');
          setOwnedCharacterIds(prev => new Set([...prev, item.id]));
          selectCharacter(item);

          if (item.background_default_id) {
            const ownedBg = await assetRepository.fetchOwnedAssets('background');
            if (!ownedBg.has(item.background_default_id)) {
              await assetRepository.createAsset(item.background_default_id, 'background');
            }
            await UserCharacterPreferenceService.saveUserCharacterPreference(item.id, {
              current_background_id: item.background_default_id,
            });
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
        } catch (error) {
          console.error('Failed to auto-unlock:', error);
        }
      })();
    } else {
      setTimeout(() => {
        onOpenSubscription?.();
      }, 300);
    }
  };

  const renderItem = ({ item }: { item: CharacterItem }) => {
    const isOwned = ownedCharacterIds.has(item.id);
    const isComingSoon = item.available === false;
    const isSelected = selectedCharacterId === item.id;
    const isLocked = !isOwned && !isPro && item.tier !== 'free';

    return (
      <Pressable
        onPress={() => !isComingSoon && handleSelect(item)}
        style={({ pressed }) => [
          styles.rowItem,
          isSelected && styles.rowItemSelected,
          pressed && !isComingSoon && styles.pressed,
          isComingSoon && { opacity: 0.7 },
        ]}
      >
        {/* Avatar Image */}
        <View style={styles.rowAvatarContainer}>
          <Image
            source={{ uri: item.thumbnail_url || item.avatar }}
            style={styles.rowAvatar}
            contentFit="cover"
            transition={200}
          />
          {isSelected && (
            <View style={styles.selectedBadge}>
              <Ionicons name="checkmark" size={14} color="#fff" />
            </View>
          )}
        </View>

        {/* Content Info */}
        <View style={styles.rowContent}>
          <View style={styles.rowTitleContainer}>
            <Text style={[styles.rowName, { color: textColor }]} numberOfLines={1}>{item.name}</Text>
            {!isOwned && !isComingSoon && !isPro && item.tier !== 'free' && (
              <View style={styles.proPill}>
                <Text style={styles.proPillText}>PRO</Text>
              </View>
            )}
            {isComingSoon && (
              <View style={styles.pillBadge}>
                <Text style={styles.pillText}>SOON</Text>
              </View>
            )}
          </View>

          {item.description && (
            <Text style={[styles.rowDescription, { color: secondaryTextColor }]} numberOfLines={1}>
              {item.description}
            </Text>
          )}

          {/* Detailed Stats: Height & Measurements */}
          <View style={styles.rowStats}>
            {/* Height */}
            {item.data?.height_cm && (
              <View style={styles.statChip}>
                <MaterialCommunityIcons name="human-male-height" size={12} color={secondaryTextColor} />
                <Text style={[styles.statValue, { color: secondaryTextColor }]}>{item.data.height_cm}cm</Text>
              </View>
            )}

            {/* Measurements */}
            {item.data?.rounds && (
              <View style={styles.statChip}>
                <IconWoman size={12} color={secondaryTextColor as string} />
                <Text style={[styles.statValue, { color: secondaryTextColor }]}>
                  {item.data.rounds.r1}-{item.data.rounds.r2}-{item.data.rounds.r3}
                </Text>
              </View>
            )}

            {/* Age - Optional */}
            {item.data?.old && (
              <View style={styles.statChip}>
                <Text style={[styles.statValue, { color: secondaryTextColor }]}>{item.data.old} yr</Text>
              </View>
            )}
          </View>
        </View>

        {/* Right Action / Status */}
        <View style={styles.rowRight}>
          {isLocked ? (
            <View style={[styles.actionButton, styles.lockedButton]}>
              <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.5)" />
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.2)" />
          )}
        </View>

      </Pressable>
    );
  };

  const renderSkeleton = () => {
    return (
      <View style={styles.skeletonContainer}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.skeletonRow,
              { opacity: shimmerOpacity }
            ]}
          />
        ))}
      </View>
    );
  };

  const renderContent = () => {
    if (isLoading && items.length === 0) {
      return (
        <View style={{ flex: 1 }}>
          {renderSkeleton()}
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: textColor }]}>Failed</Text>
          <Pressable onPress={load}><Text style={[styles.retryButtonText, { color: brand[500] }]}>Retry</Text></Pressable>
        </View>
      );
    }

    if (items.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={{ color: secondaryTextColor }}>No characters found</Text>
        </View>
      )
    }

    return (
      <View style={{ flex: 1 }}>
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      </View>
    );
  };

  return (
    <BottomSheet
      ref={sheetRef}
      isOpened={isOpened}
      onIsOpenedChange={onIsOpenedChange}
      backgroundBlur='system-thick-material-dark'
      title="Characters"
      isDarkBackground={isDarkBackground}
      detents={[0.85, 0.95]}
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
  errorText: { fontSize: 16, marginBottom: 8 },
  retryButtonText: { fontSize: 16, fontWeight: '600' },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
  },

  // Row Styles
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  rowItemSelected: {
    backgroundColor: 'rgba(230, 85, 197, 0.15)', // brand color tint
    borderColor: brand[500],
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // Avatar
  rowAvatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  rowAvatar: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  selectedBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    backgroundColor: brand[500],
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },

  // Content
  rowContent: {
    flex: 1,
    justifyContent: 'center',
  },
  rowTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rowName: {
    fontSize: 18,
    fontWeight: '700',
  },
  rowDescription: {
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },

  // Stats
  rowStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statValue: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.9,
  },

  // Right Area
  rowRight: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Badges
  proPill: {
    backgroundColor: '#FF416C',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,1)',
  },
  proPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#fff',
  },
  pillBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  pillText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.8)',
  },

  // Skeleton
  skeletonContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  skeletonRow: {
    width: '100%',
    height: 96,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
