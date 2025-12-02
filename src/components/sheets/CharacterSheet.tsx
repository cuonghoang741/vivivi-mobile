import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CharacterRepository, type CharacterItem } from '../../repositories/CharacterRepository';
import AssetRepository from '../../repositories/AssetRepository';
import * as Haptics from 'expo-haptics';
import Button from '../Button';
import { CharacterCard } from '../characters/CharacterCard';
import { useSceneActions } from '../../context/SceneActionsContext';
import { ConfirmPurchasePortal } from '../../context/PurchaseContext';

interface CharacterSheetProps {
  isOpened: boolean;
  onIsOpenedChange: (isOpened: boolean) => void;
}

const STORAGE_KEY_USE_GRID = 'characterSheetUseGrid';

export const CharacterSheet: React.FC<CharacterSheetProps> = ({
  isOpened,
  onIsOpenedChange,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<CharacterItem[]>([]);
  const [ownedCharacterIds, setOwnedCharacterIds] = useState<Set<string>>(new Set());
  const [useGrid, setUseGrid] = useState(true);
  const { width } = useWindowDimensions();
  const { selectCharacter } = useSceneActions();

  const loadGridPreference = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_USE_GRID);
      if (stored !== null) {
        setUseGrid(stored === 'true');
      }
    } catch (error) {
      console.warn('Failed to load grid preference:', error);
    }
  }, []);

  const saveGridPreference = useCallback(async (value: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_USE_GRID, String(value));
    } catch (error) {
      console.warn('Failed to save grid preference:', error);
    }
  }, []);

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
      const characterRepository = new CharacterRepository();
      let loadedItems = await characterRepository.fetchAllCharacters();

      // Filter by available
      loadedItems = loadedItems.filter((item) => item.available !== false);

      // Sort: Owned first, then by price
      const sortedItems = loadedItems.sort((char1, char2) => {
        const isOwned1 = ownedCharacterIds.has(char1.id);
        const isOwned2 = ownedCharacterIds.has(char2.id);

        if (isOwned1 !== isOwned2) {
          return isOwned1 ? -1 : 1;
        }

        const price1 = (char1.price_vcoin ?? 0) + (char1.price_ruby ?? 0);
        const price2 = (char2.price_vcoin ?? 0) + (char2.price_ruby ?? 0);
        return price1 - price2;
      });

      setItems(sortedItems);
    } catch (error: any) {
      console.error('❌ [CharacterSheet] Failed to load characters:', error);
      setErrorMessage(error.message || 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, ownedCharacterIds]);

  useEffect(() => {
    loadGridPreference();
  }, [loadGridPreference]);

  useEffect(() => {
    if (isOpened) {
      if (items.length === 0) {
        fetchOwnedCharacterIds(() => {
          load();
        });
      } else {
        fetchOwnedCharacterIds();
      }
    }
  }, [isOpened, items.length, fetchOwnedCharacterIds, load]);

  const handleSelect = (item: CharacterItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void selectCharacter(item);
  };

  const handleToggleView = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newValue = !useGrid;
    setUseGrid(newValue);
    saveGridPreference(newValue);
  };

  const renderGridItem = ({ item }: { item: CharacterItem }) => {
    const isOwned = ownedCharacterIds.has(item.id);
    const itemWidth = (width - 32 - 14) / 2; // 32 padding, 14 gap

    return (
      <Pressable
        onPress={() => handleSelect(item)}
        style={({ pressed }) => [
          styles.gridItemContainer,
          { width: itemWidth },
          pressed && styles.pressed,
        ]}
      >
        <CharacterCard item={item} isOwned={isOwned} />
      </Pressable>
    );
  };

  const renderListItem = ({ item }: { item: CharacterItem }) => {
    const isOwned = ownedCharacterIds.has(item.id);

    return (
      <Pressable
        onPress={() => handleSelect(item)}
        style={({ pressed }) => [
          styles.listItemContainer,
          !isOwned && styles.listItemDimmed,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.listItemContent}>
          <View style={styles.listItemAvatar}>
            {item.avatar || item.thumbnail_url ? (
              <Image
                source={{ uri: item.avatar || item.thumbnail_url }}
                style={styles.listItemAvatarImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.listItemAvatarPlaceholder} />
            )}
          </View>
          <View style={styles.listItemText}>
            <View style={styles.listItemNameRow}>
              <Text style={styles.listItemName} numberOfLines={1}>
                {item.name}
              </Text>
              {item.tier && item.tier !== 'free' && (
                <View style={styles.listItemProBadge}>
                  <Text style={styles.listItemProBadgeText}>{item.tier.toUpperCase()}</Text>
                </View>
              )}
            </View>
            {item.description ? (
              <Text style={styles.listItemDescription} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderSkeleton = () => {
    if (useGrid) {
      const itemWidth = (width - 32 - 14) / 2;
      return (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={[styles.skeletonCard, { width: itemWidth }]} />
          ))}
        </View>
      );
    } else {
      return (
        <View style={styles.skeletonList}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={styles.skeletonListItem} />
          ))}
        </View>
      );
    }
  };

  return (
    <Modal
      visible={isOpened}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => onIsOpenedChange(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <Button
            size="md"
            variant="liquid"
            onPress={handleToggleView}
            startIconName={useGrid ? 'list-outline' : 'grid-outline'}
            isIconOnly
          />
          <Text style={styles.headerTitle}>Girl friends</Text>
          <Button
            size="md"
            variant="liquid"
            onPress={() => onIsOpenedChange(false)}
            startIconName="close"
            isIconOnly
          />
        </View>

        {isLoading && items.length === 0 ? (
          <View style={styles.centerContainer}>{renderSkeleton()}</View>
        ) : errorMessage ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>Failed to load</Text>
            <Text style={styles.errorDetailText}>{errorMessage}</Text>
            <Pressable onPress={load} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No characters available</Text>
            <Pressable onPress={load} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Reload</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={items}
            renderItem={useGrid ? renderGridItem : renderListItem}
            keyExtractor={item => item.id}
            extraData={useGrid}
            numColumns={useGrid ? 2 : 1}
            columnWrapperStyle={useGrid ? styles.columnWrapper : undefined}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            key={`character-sheet-${useGrid ? 'grid' : 'list'}`}
          />
        )}
      </View>
      <ConfirmPurchasePortal hostId="character-sheet" active={isOpened} />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorDetailText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.8)',
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
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  gridItemContainer: {
    marginBottom: 14,
  },
  listItemContainer: {
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  listItemDimmed: {
    opacity: 0.5,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  listItemAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  listItemAvatarImage: {
    width: '100%',
    height: '100%',
  },
  listItemAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  listItemText: {
    flex: 1,
  },
  listItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  listItemName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listItemProBadge: {
    backgroundColor: 'rgba(160,104,255,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  listItemProBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  listItemDescription: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.85,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingHorizontal: 16,
  },
  skeletonCard: {
    aspectRatio: 1,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  skeletonList: {
    width: '100%',
    paddingHorizontal: 16,
  },
  skeletonListItem: {
    height: 80,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
  },
});

