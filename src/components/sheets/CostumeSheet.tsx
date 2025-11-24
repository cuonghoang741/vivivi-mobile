import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';

import Button from '../Button';
import { CostumeRepository, type CostumeItem } from '../../repositories/CostumeRepository';
import AssetRepository from '../../repositories/AssetRepository';
import { useSceneActions } from '../../context/SceneActionsContext';
import { ConfirmPurchasePortal } from '../../context/PurchaseContext';

interface CostumeSheetProps {
  isOpened: boolean;
  onIsOpenedChange: (isOpened: boolean) => void;
  characterId?: string | null;
}

const formatNumber = (value?: number | null) =>
  typeof value === 'number' ? value.toLocaleString('en-US') : '0';

export const CostumeSheet: React.FC<CostumeSheetProps> = ({
  isOpened,
  onIsOpenedChange,
  characterId,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<CostumeItem[]>([]);
  const [ownedCostumeIds, setOwnedCostumeIds] = useState<Set<string>>(new Set());
  const { width } = useWindowDimensions();
  const { selectCostume } = useSceneActions();

  const effectiveCharacterId = useMemo(() => {
    if (characterId && characterId.trim().length > 0) {
      return characterId;
    }
    return undefined;
  }, [characterId]);

  const load = useCallback(async () => {
    if (isLoading) {
      return;
    }
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
        if (ownedA !== ownedB) {
          return ownedA ? -1 : 1;
        }
        const priceA = (a.price_vcoin ?? 0) + (a.price_ruby ?? 0);
        const priceB = (b.price_vcoin ?? 0) + (b.price_ruby ?? 0);
        return priceA - priceB;
      });

      setItems(sorted);
    } catch (error: any) {
      console.error('❌ [CostumeSheet] Failed to load costumes:', error);
      setErrorMessage(error?.message ?? 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveCharacterId, isLoading]);

  useEffect(() => {
    if (isOpened) {
      load();
    }
  }, [isOpened, load]);

  const handleSelect = useCallback(
    (item: CostumeItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      void selectCostume(item);
    },
    [selectCostume]
  );

  const renderItem = useCallback(
    ({ item }: { item: CostumeItem }) => {
      const isOwned = ownedCostumeIds.has(item.id);
      const itemWidth = (width - 32 - 28) / 3;
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
            {item.thumbnail ? (
              <Image
                source={{ uri: item.thumbnail }}
                style={[styles.image, { width: itemWidth, height: itemWidth }]}
                resizeMode="cover"
              />
            ) : null}

            {!isOwned && (
              <View style={[styles.darkenOverlay, { width: itemWidth, height: itemWidth }]} />
            )}

            <View style={styles.proBadgeContainer}>
              <ProBadge tier={item.tier} />
            </View>

            {!isOwned && (item.price_vcoin || item.price_ruby) ? (
              <View style={styles.priceBadgesContainer}>
                <PriceBadgesView vcoin={item.price_vcoin} ruby={item.price_ruby} />
              </View>
            ) : null}

            {!isOwned ? (
              <View style={styles.lockIconContainer}>
                <LockIcon />
              </View>
            ) : null}
          </View>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.costume_name}
          </Text>
        </Pressable>
      );
    },
    [handleSelect, ownedCostumeIds, width]
  );

  const renderContent = () => {
    if (isLoading && items.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load</Text>
          <Text style={styles.errorDetailText}>{errorMessage}</Text>
          <Pressable onPress={load} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    if (items.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No costumes</Text>
          <Pressable onPress={load} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Reload</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        numColumns={3}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
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
          <Text style={styles.headerTitle}>Change Costume</Text>
          <Button
            size="md"
            variant="liquid"
            onPress={() => onIsOpenedChange(false)}
            startIconName="close"
            isIconOnly
          />
        </View>
        {renderContent()}
      </View>
      <ConfirmPurchasePortal hostId="costume-sheet" active={isOpened} />
    </Modal>
  );
};

const ProBadge = ({ tier }: { tier?: string | null }) => {
  if (!tier || tier === 'free') {
    return null;
  }
  return (
    <View style={styles.proBadge}>
      <Text style={styles.proBadgeText}>{tier.toUpperCase()}</Text>
    </View>
  );
};

const PriceBadgesView = ({ vcoin, ruby }: { vcoin?: number | null; ruby?: number | null }) => (
  <View style={styles.priceBadges}>
    {vcoin ? (
      <View style={styles.priceBadge}>
        <Text style={styles.priceBadgeText}>V {formatNumber(vcoin)}</Text>
      </View>
    ) : null}
    {ruby ? (
      <View style={[styles.priceBadge, styles.rubyBadge]}>
        <Text style={styles.priceBadgeText}>R {formatNumber(ruby)}</Text>
      </View>
    ) : null}
  </View>
);

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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
    textAlign: 'center',
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
  pressed: {
    opacity: 0.85,
  },
});
