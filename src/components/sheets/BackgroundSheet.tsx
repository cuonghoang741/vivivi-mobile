import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Image,
  useWindowDimensions,
  FlatList,
  Modal,
} from 'react-native';
import { BackgroundRepository, BackgroundItem } from '../../repositories/BackgroundRepository';
import AssetRepository from '../../repositories/AssetRepository';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import Button from '../Button';
import { useSceneActions } from '../../context/SceneActionsContext';
import { ConfirmPurchasePortal } from '../../context/PurchaseContext';

interface BackgroundSheetProps {
  isOpened: boolean;
  onIsOpenedChange: (isOpened: boolean) => void;
}

export const BackgroundSheet: React.FC<BackgroundSheetProps> = ({
  isOpened,
  onIsOpenedChange,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<BackgroundItem[]>([]);
  const [ownedBackgroundIds, setOwnedBackgroundIds] = useState<Set<string>>(new Set());
  const { width } = useWindowDimensions();
  const { selectBackground } = useSceneActions();

  const load = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    setItems([]);

    try {
      const backgroundRepository = new BackgroundRepository();
      const assetRepository = new AssetRepository();

      // Fetch backgrounds and owned IDs in parallel
      const [backgrounds, ownedIds] = await Promise.all([
        backgroundRepository.fetchAllBackgrounds(),
        assetRepository.fetchOwnedAssets('background'),
      ]);

      console.log('📋 [BackgroundSheet] Fetched backgrounds:', backgrounds.length);
      console.log('✅ [BackgroundSheet] Owned background IDs:', Array.from(ownedIds));

      // Filter available
      const availableBackgrounds = backgrounds.filter((b) => b.available);
      console.log('📋 [BackgroundSheet] Available backgrounds:', availableBackgrounds.length);

      // Create a Set for easier lookup
      const ownedSet = new Set(ownedIds);
      setOwnedBackgroundIds(ownedSet);

      // Sort: Owned first, then by price
      const sorted = availableBackgrounds.sort((a, b) => {
        const isOwned1 = ownedSet.has(a.id);
        const isOwned2 = ownedSet.has(b.id);

        if (isOwned1 !== isOwned2) {
          return isOwned1 ? -1 : 1;
        }

        const price1 = (a.price_vcoin ?? 0) + (a.price_ruby ?? 0);
        const price2 = (b.price_vcoin ?? 0) + (b.price_ruby ?? 0);
        return price1 - price2;
      });

      const ownedCount = sorted.filter(b => ownedSet.has(b.id)).length;
      console.log(`📊 [BackgroundSheet] Sorted: ${ownedCount} owned, ${sorted.length - ownedCount} unowned`);

      setItems(sorted);
    } catch (error: any) {
      console.error('❌ [BackgroundSheet] Failed to load backgrounds:', error);
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
        // Refresh owned status if already loaded
        fetchOwnedBackgrounds();
      }
    }
  }, [isOpened, items.length, load, fetchOwnedBackgrounds]);

  const handleSelect = (item: BackgroundItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void selectBackground(item);
  };

  const renderItem = ({ item }: { item: BackgroundItem }) => {
    const isOwned = ownedBackgroundIds.has(item.id);
    const itemWidth = (width - 32 - 28) / 3; // 32 padding horizontal, 28 gap (14 * 2)

    return (
      <Pressable
        onPress={() => handleSelect(item)}
        style={[
          styles.itemContainer,
          { width: itemWidth },
        ]}
      >
        <View style={[styles.imageContainer, { width: itemWidth, height: itemWidth }]}>
          <View style={[styles.placeholder, { width: itemWidth, height: itemWidth }]} />
          {item.thumbnail ? (
            <Image
              source={{ uri: item.thumbnail }}
              style={[styles.image, { width: itemWidth, height: itemWidth }]}
              resizeMode="cover"
            />
          ) : null}
          
          {/* Dark overlay for unowned items (simulates brightness(-0.2)) */}
          {!isOwned && (
            <View style={[styles.darkenOverlay, { width: itemWidth, height: itemWidth }]} />
          )}
          
          {/* Pro Badge */}
          <View style={styles.proBadgeContainer}>
            <ProBadge tier={item.tier} />
          </View>

          {/* Price Badges (Top-Left) */}
          {!isOwned && (item.price_vcoin || item.price_ruby) ? (
            <View style={styles.priceBadgesContainer}>
              <PriceBadgesView vcoin={item.price_vcoin} ruby={item.price_ruby} />
            </View>
          ) : null}

          {/* Lock Icon (Center) */}
          {!isOwned ? (
            <View style={styles.lockIconContainer}>
              <LockIcon />
            </View>
          ) : null}
        </View>
        
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
      </Pressable>
    );
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
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>Change Background</Text>
          <Button
            size="md"
            variant="liquid"
            onPress={() => onIsOpenedChange(false)}
            startIconName="close"
            isIconOnly
          />
        </View>
        {isLoading && items.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
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
            <Text style={styles.emptyText}>No backgrounds</Text>
            <Pressable onPress={load} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Reload</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={3}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
      <ConfirmPurchasePortal hostId="background-sheet" active={isOpened} />
    </Modal>
  );
};

const ProBadge = ({ tier }: { tier?: string }) => {
  if (!tier || tier === 'free') return null;
  
  return (
    <View style={styles.proBadge}>
      <Text style={styles.proBadgeText}>{tier.toUpperCase()}</Text>
    </View>
  );
};

const PriceBadgesView = ({ vcoin, ruby }: { vcoin?: number; ruby?: number }) => {
  return (
    <View style={styles.priceBadges}>
      {vcoin ? (
        <View style={styles.priceBadge}>
          <Text style={styles.priceBadgeText}>V {vcoin}</Text>
        </View>
      ) : null}
      {ruby ? (
        <View style={[styles.priceBadge, styles.rubyBadge]}>
          <Text style={styles.priceBadgeText}>R {ruby}</Text>
        </View>
      ) : null}
    </View>
  );
};

const LockIcon = () => (
  <View style={styles.lockIconCircle}>
    <Ionicons name="lock-closed" size={20} color="#fff" />
  </View>
);

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  contentContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  columnWrapper: {
    gap: 14,
    marginBottom: 14,
  },
  itemContainer: {
    alignItems: 'center',
    gap: 8,
  },
  imageContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    position: 'relative',
  },
  placeholder: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  image: {
    borderRadius: 14,
  },
  darkenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Simulates brightness(-0.2) + opacity(0.5)
    borderRadius: 14,
  },
  itemName: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 4,
  },
  errorDetailText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginBottom: 12,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.8)',
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
    color: '#fff',
    fontSize: 14,
  },
  proBadgeContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  proBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  priceBadgesContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  priceBadges: {
    gap: 4,
  },
  priceBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rubyBadge: {
    backgroundColor: 'rgba(220, 20, 60, 0.8)',
  },
  priceBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
