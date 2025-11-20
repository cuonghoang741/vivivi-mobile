import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Button } from '../components/Button';
import { CharacterRepository, type CharacterItem } from '../repositories/CharacterRepository';
import AssetRepository from '../repositories/AssetRepository';
import { CurrencyRepository } from '../repositories/CurrencyRepository';
import { BackgroundRepository, BackgroundItem } from '../repositories/BackgroundRepository';
import { UserCharacterPreferenceService } from '../services/UserCharacterPreferenceService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const VCOIN_ICON = require('../assets/images/VCoin.png');
const RUBY_ICON = require('../assets/images/Ruby.png');

type Props = {
  onComplete: (characterId: string | null) => void;
};

// Calculate gradient points matching Swift version (angle: 189.19 degrees)
const calculateGradientPoints = () => {
  const angleDegrees = 189.19;
  const angleRadians = (angleDegrees * Math.PI) / 180.0;
  const dx = Math.sin(angleRadians);
  const dy = -Math.cos(angleRadians);
  const center = 0.5;
  const length = 0.7;
  const startX = center - dx * length;
  const startY = center - dy * length;
  const endX = center + dx * length;
  const endY = center + dy * length;
  return {
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
  };
};

export const NewUserGiftScreen: React.FC<Props> = ({ onComplete }) => {
  const [freeCharacters, setFreeCharacters] = useState<CharacterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [isGifting, setIsGifting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backgroundThumbnails, setBackgroundThumbnails] = useState<string[]>([]);

  const gradientPoints = calculateGradientPoints();

  useEffect(() => {
    loadFreeCharacters();
    loadBackgroundThumbnails();
  }, []);

  const loadBackgroundThumbnails = async () => {
    try {
      const backgroundRepo = new BackgroundRepository();
      const backgrounds = await backgroundRepo.fetchAllBackgrounds();
      
      // Filter available and public backgrounds, shuffle and take 3
      const available = backgrounds
        .filter((b) => b.available && b.public)
        .map((b) => b.thumbnail || b.image)
        .filter((url): url is string => !!url);
      
      // Shuffle array
      const shuffled = available.sort(() => Math.random() - 0.5);
      setBackgroundThumbnails(shuffled.slice(0, 3));
    } catch (error) {
      console.error('[NewUserGiftScreen] Failed to load background thumbnails:', error);
    }
  };

  const loadFreeCharacters = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const characterRepo = new CharacterRepository();
      const characters = await characterRepo.fetchAllCharacters();
      const free = characters
        .filter((c) => c.tier === 'free' && c.available)
        .slice(0, 3);
      setFreeCharacters(free);
      if (free.length > 0) {
        setSelectedCharacterId(free[0].id);
      }
    } catch (error: any) {
      console.error('[NewUserGiftScreen] Failed to load characters:', error);
      setErrorMessage(error.message || 'Failed to load characters');
    } finally {
      setIsLoading(false);
    }
  };

  const getDefaultBackgroundId = async (): Promise<string | null> => {
    try {
      const backgroundRepo = new BackgroundRepository();
      const backgrounds = await backgroundRepo.fetchAllBackgrounds();
      const freeBackground = backgrounds.find(
        (b) => b.available && b.public && b.tier === 'free' && !b.price_vcoin && !b.price_ruby
      );
      return freeBackground?.id || null;
    } catch (error) {
      console.error('[NewUserGiftScreen] Failed to get default background:', error);
      return null;
    }
  };

  const getDefaultCostumeId = async (characterId: string): Promise<string | null> => {
    try {
      const { CostumeRepository } = await import('../repositories/CostumeRepository');
      const costumeRepo = new CostumeRepository();
      const costumes = await costumeRepo.fetchCostumes(characterId);
      const freeCostume = costumes.find(
        (c) => c.available && !c.price_vcoin && !c.price_ruby
      );
      return freeCostume?.id || null;
    } catch (error) {
      console.error('[NewUserGiftScreen] Failed to get default costume:', error);
      return null;
    }
  };

  const giftRandomBackgrounds = async (
    count: number,
    excludeIds: Set<string> = new Set()
  ): Promise<string[]> => {
    const backgroundRepo = new BackgroundRepository();
    const assetRepo = new AssetRepository();

    const backgrounds = await backgroundRepo.fetchAllBackgrounds();
    const available = backgrounds.filter((b) => b.available && b.public && !excludeIds.has(b.id));

    if (available.length < count) {
      throw new Error('Not enough backgrounds available to gift.');
    }

    const shuffled = available.sort(() => Math.random() - 0.5);
    const giftedIds: string[] = [];

    for (const bg of shuffled) {
      const success = await assetRepo.createAsset(bg.id, 'background');
      if (!success) {
        throw new Error(`Failed to gift background ${bg.id}.`);
      }
      giftedIds.push(bg.id);
      if (giftedIds.length === count) {
        break;
      }
    }

    if (giftedIds.length < count) {
      throw new Error('Failed to gift all backgrounds.');
    }

    return giftedIds;
  };

  const applyGiftedBackground = async (backgroundId: string, characterId: string) => {
    try {
      const backgroundRepo = new BackgroundRepository();
      const background = await backgroundRepo.fetchBackground(backgroundId);
      
      if (background) {
        // Save to user_character.current_background_id
        await UserCharacterPreferenceService.saveUserCharacterPreference(characterId, {
          current_background_id: backgroundId,
        });
        console.log('✅ [NewUserGiftScreen] Applied background to user_character:', backgroundId);
      }
    } catch (error) {
      console.error('[NewUserGiftScreen] Failed to apply background:', error);
    }
  };

  const claimGift = async (characterId: string) => {
    if (!characterId) return;
    setIsGifting(true);
    setErrorMessage(null);

    try {
      const assetRepo = new AssetRepository();
      const currencyRepo = new CurrencyRepository();
      const characterRepo = new CharacterRepository();

      const characterGifted = await assetRepo.createAsset(characterId, 'character');
      if (!characterGifted) {
        throw new Error('Failed to gift the character.');
      }

      const character = await characterRepo.fetchCharacter(characterId);
      if (!character) {
        throw new Error('Character not found');
      }

      const costumeId =
        character.default_costume_id || (await getDefaultCostumeId(characterId));
      if (!costumeId) {
        throw new Error('Unable to determine a costume to gift.');
      }
      const costumeGifted = await assetRepo.createAsset(costumeId, 'character_costume');
      if (!costumeGifted) {
        throw new Error('Failed to gift the costume.');
      }

      const giftedBackgroundIds: string[] = [];
      const defaultBackgroundId = await getDefaultBackgroundId();
      if (defaultBackgroundId) {
        const backgroundGifted = await assetRepo.createAsset(defaultBackgroundId, 'background');
        if (!backgroundGifted) {
          throw new Error('Failed to gift the default background.');
        }
        giftedBackgroundIds.push(defaultBackgroundId);
      }

      const randomBackgroundIds = await giftRandomBackgrounds(
        3,
        new Set(giftedBackgroundIds)
      );
      giftedBackgroundIds.push(...randomBackgroundIds);

      const currentCurrency = await currencyRepo.fetchCurrency();
      await currencyRepo.updateCurrency(
        currentCurrency.vcoin + 10000,
        currentCurrency.ruby + 100
      );

      const backgroundToApply = giftedBackgroundIds[0];
      if (backgroundToApply) {
        await applyGiftedBackground(backgroundToApply, characterId);
      }

      setIsGifting(false);
      onComplete(characterId);
    } catch (error: any) {
      console.error('[NewUserGiftScreen] Failed to claim gift:', error);
      setErrorMessage(
        error?.message ?? 'Failed to deliver the full welcome gift. Please try again.'
      );
      setIsGifting(false);
    }
  };

  const selectedCharacter = freeCharacters.find((c) => c.id === selectedCharacterId);

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={['#CE0053', '#FF2F71', '#FFE3EE']}
        locations={[0.0538, 0.2023, 0.8667]}
        start={gradientPoints.start}
        end={gradientPoints.end}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {isLoading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.loadingText}>Loading characters...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.centerContent}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable onPress={loadFreeCharacters} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Logo placeholder - can add white_vivivi logo later */}
              <View style={styles.logoContainer} />

              {/* Title */}
              <View style={styles.titleContainer}>
                <Text style={styles.title}>Welcome Gift</Text>
                <Text style={styles.subtitle}>Select your first character</Text>
              </View>

              {/* Character selection - circular avatars */}
              <View style={styles.characterSelectionContainer}>
                {freeCharacters.slice(0, 3).map((character) => (
                  <CharacterCircleAvatar
                    key={character.id}
                    character={character}
                    isSelected={selectedCharacterId === character.id}
                    onSelect={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                      setSelectedCharacterId(character.id);
                    }}
                  />
                ))}
              </View>

              {/* You will also receive section */}
              <View style={styles.receiveSection}>
                <View style={styles.receiveTitleContainer}>
                  <Text style={styles.receiveTitle}>You will also receive</Text>
                  <Text style={styles.receiveSubtitle}>3 stunning backgrounds</Text>
                </View>

                {/* Background thumbnails */}
                <View style={styles.backgroundThumbnailsContainer}>
                  {backgroundThumbnails.slice(0, 3).map((thumbnailUrl, index) => (
                    <View key={index} style={styles.backgroundThumbnail}>
                      <Image
                        source={{ uri: thumbnailUrl }}
                        style={styles.backgroundThumbnailImage}
                        resizeMode="cover"
                      />
                    </View>
                  ))}
                  {/* Placeholders if we don't have 3 backgrounds yet */}
                  {backgroundThumbnails.length < 3 &&
                    Array.from({ length: 3 - backgroundThumbnails.length }).map((_, index) => (
                      <View key={`placeholder-${index}`} style={styles.backgroundThumbnail}>
                        <View style={styles.backgroundThumbnailPlaceholder}>
                          <Ionicons name="image-outline" size={24} color="rgba(255,255,255,0.5)" />
                        </View>
                      </View>
                    ))}
                </View>

                {/* Currency rewards */}
                <View style={styles.currencyRewardsContainer}>
                  <View style={styles.currencyBadge}>
                    <Image source={VCOIN_ICON} style={styles.currencyIcon} />
                    <Text style={styles.currencyText}>+10,000</Text>
                  </View>
                  <View style={styles.currencyBadge}>
                    <Image source={RUBY_ICON} style={styles.currencyIcon} />
                    <Text style={styles.currencyText}>+100</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Claim button - fixed at bottom */}
            <View style={styles.buttonContainer}>
              <Pressable
                onPress={() => selectedCharacterId && claimGift(selectedCharacterId)}
                disabled={!selectedCharacterId || isGifting}
                style={[
                  styles.claimButton,
                  (!selectedCharacterId || isGifting) && styles.claimButtonDisabled,
                ]}
              >
                {isGifting ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" style={styles.buttonLoader} />
                    <Text style={styles.claimButtonText}>Claiming...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="gift" size={18} color="#fff" style={styles.buttonIcon} />
                    <Text style={styles.claimButtonText}>Claim</Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
};

// Character Circle Avatar Component
const CharacterCircleAvatar: React.FC<{
  character: CharacterItem;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ character, isSelected, onSelect }) => {
  const size = isSelected ? 115 : 82;
  const scale = useRef(new Animated.Value(isSelected ? 1 : 0.92)).current;
  const glowOpacity = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isSelected ? 1 : 0.92,
      friction: 6,
      tension: 150,
      useNativeDriver: true,
    }).start();

    Animated.timing(glowOpacity, {
      toValue: isSelected ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [glowOpacity, isSelected, scale]);

  const renderAvatar = () => {
    if (character.avatar || character.thumbnail_url) {
      return (
        <Image
          source={{ uri: character.avatar || character.thumbnail_url }}
          style={[styles.avatarImage, { opacity: isSelected ? 1 : 0.65 }]}
          resizeMode="cover"
        />
      );
    }

    return (
      <View style={[styles.avatarPlaceholder, { opacity: isSelected ? 1 : 0.65 }]}>
        <Ionicons name="person" size={size * 0.4} color="rgba(255,255,255,0.5)" />
      </View>
    );
  };

  return (
    <Pressable onPress={onSelect} style={styles.avatarContainer}>
      <Animated.View
        style={[
          styles.avatarWrapper,
          {
            width: size + 12,
            height: size + 12,
            transform: [{ scale }],
          },
        ]}
      >
        <Animated.View style={[styles.avatarGlow, { opacity: glowOpacity }]} />
        <View style={[styles.avatarInner, { width: size, height: size }]}>
          {renderAvatar()}
          <View style={styles.badge18}>
            <Text style={styles.badge18Text}>18+</Text>
          </View>
        </View>
      </Animated.View>
      <Text
        style={[
          styles.characterName,
          { width: size + 12, fontSize: isSelected ? 16 : 14 },
        ]}
        numberOfLines={1}
      >
        {character.name}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 20,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  errorText: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 100,
  },
  logoContainer: {
    height: 40,
    marginTop: 20,
    // Logo can be added here later
  },
  titleContainer: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },
  characterSelectionContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  avatarContainer: {
    alignItems: 'center',
    gap: 8,
  },
  avatarWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarGlow: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#FF9CC9',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  avatarInner: {
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge18: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badge18Text: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  characterName: {
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  receiveSection: {
    paddingTop: 8,
    paddingBottom: 100,
    gap: 24,
  },
  receiveTitleContainer: {
    alignItems: 'center',
    gap: 4,
  },
  receiveTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  receiveSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },
  backgroundThumbnailsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  backgroundThumbnail: {
    width: 100,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  backgroundThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  backgroundThumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currencyRewardsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 20,
  },
  currencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
  },
  currencyIcon: {
    width: 24,
    height: 24,
  },
  currencyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 18,
    backgroundColor: '#FF2F71',
    borderRadius: 999,
    maxWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  claimButtonDisabled: {
    opacity: 0.5,
  },
  buttonLoader: {
    marginRight: 0,
  },
  buttonIcon: {
    marginRight: 0,
  },
  claimButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
});
