import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
  ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Button } from '../components/commons/Button';
import { CharacterRepository, type CharacterItem } from '../repositories/CharacterRepository';
import AssetRepository from '../repositories/AssetRepository';
import { CurrencyRepository } from '../repositories/CurrencyRepository';
import { BackgroundRepository } from '../repositories/BackgroundRepository';

const STARS_IMAGE = require('../assets/images/stars.png');
const WHITE_LOGO = require('../assets/images/white_vivivi.png');

type Props = {
  onComplete: (characterId: string | null) => void;
};

export const NewUserGiftScreen: React.FC<Props> = ({ onComplete }) => {
  const [freeCharacters, setFreeCharacters] = useState<CharacterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [isGifting, setIsGifting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backgroundThumbnails, setBackgroundThumbnails] = useState<string[]>([]);

  useEffect(() => {
    loadFreeCharacters();
    loadBackgroundThumbnails();
  }, []);

  const loadFreeCharacters = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const characterRepo = new CharacterRepository();
      const characters = await characterRepo.fetchAllCharacters();
      const free = characters.filter((c) => c.tier === 'free' && c.available).slice(0, 3);
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

  const loadBackgroundThumbnails = async () => {
    try {
      const backgroundRepo = new BackgroundRepository();
      const backgrounds = await backgroundRepo.fetchAllBackgrounds();
      const thumbnails = backgrounds
        .map((bg) => bg.thumbnail || bg.image)
        .filter((uri): uri is string => Boolean(uri));
      const shuffled = thumbnails.sort(() => 0.5 - Math.random());
      setBackgroundThumbnails(shuffled.slice(0, 3));
    } catch (error) {
      console.warn('[NewUserGiftScreen] Failed to load background previews', error);
    }
  };

  const claimGift = async (characterId: string) => {
    if (!characterId) return;
    setIsGifting(true);
    setErrorMessage(null);

    try {
      const assetRepo = new AssetRepository();
      const currencyRepo = new CurrencyRepository();
      const backgroundRepo = new BackgroundRepository();

      // Gift character
      await assetRepo.createAsset(characterId, 'character');

      // Get character to find default costume
      const characterRepo = new CharacterRepository();
      const character = await characterRepo.fetchCharacter(characterId);

      // Gift default costume if available
      if (character?.default_costume_id) {
        try {
          await assetRepo.createAsset(character.default_costume_id, 'character_costume');
        } catch (err) {
          console.warn('[NewUserGiftScreen] Could not gift default costume:', err);
        }
      }

      // Gift default background for character
      const backgrounds = await backgroundRepo.fetchAllBackgrounds();
      const freeBackgrounds = backgrounds.filter((b) => b.available && b.tier === 'free').slice(0, 3);
      for (const bg of freeBackgrounds) {
        try {
          await assetRepo.createAsset(bg.id, 'background');
        } catch (err) {
          console.warn('[NewUserGiftScreen] Could not gift background:', err);
        }
      }

      // Gift currency
      const currentCurrency = await currencyRepo.fetchCurrency();
      await currencyRepo.updateCurrency(currentCurrency.vcoin + 10000, currentCurrency.ruby + 100);

      onComplete(characterId);
    } catch (error: any) {
      console.error('[NewUserGiftScreen] Failed to claim gift:', error);
      setErrorMessage(error.message || 'Failed to claim gift');
      setIsGifting(false);
    }
  };

  const selectedCharacter = freeCharacters.find((c) => c.id === selectedCharacterId);

  return (
    <LinearGradient colors={['#CE0053', '#FF2F71', '#FFE3EE']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.container}>
      <Image source={STARS_IMAGE} style={styles.starsOverlay} resizeMode="cover" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {isLoading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.loadingText}>Loading characters...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.centerContent}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Button variant="solid" color="primary" onPress={loadFreeCharacters} style={styles.retryButton}>
              Retry
            </Button>
          </View>
        ) : (
          <>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.logoHeader}>
                <Image source={WHITE_LOGO} style={styles.logo} resizeMode="contain" />
              </View>

              <View style={styles.titleContainer}>
                <Text style={styles.title}>Welcome Gift</Text>
                <Text style={styles.subtitle}>Select your first character</Text>
              </View>

              <View style={styles.characterRow}>
                {freeCharacters.slice(0, 3).map((character) => (
                  <View style={styles.characterCell} key={character.id}>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
                        setSelectedCharacterId(character.id);
                      }}
                      style={[
                        styles.characterCircle,
                        selectedCharacterId === character.id && styles.characterCircleSelected,
                      ]}
                    >
                      {character.thumbnail_url || character.avatar ? (
                        <Image
                          source={{ uri: character.thumbnail_url || character.avatar }}
                          style={styles.characterCircleImage}
                        />
                      ) : (
                        <Ionicons name="person" size={36} color="#fff" />
                      )}
                    </Pressable>
                    <Text
                      style={[styles.characterLabel, selectedCharacterId === character.id && styles.characterLabelSelected]}
                      numberOfLines={1}
                    >
                      {character.name}
                    </Text>
                  </View>
                ))}
              </View>

              {selectedCharacter && (
                <View style={styles.descriptionCard}>
                  <Text style={styles.descriptionTitle}>{selectedCharacter.name}</Text>
                  <Text style={styles.descriptionText} numberOfLines={3}>
                    {selectedCharacter.description || 'No description available.'}
                  </Text>
                </View>
              )}

              <View style={styles.receiveBlock}>
                <Text style={styles.receiveTitle}>You will also receive</Text>
                <Text style={styles.receiveSubtitle}>3 stunning backgrounds</Text>

                <View style={styles.backgroundRow}>
                  {backgroundThumbnails.map((uri, index) => (
                    <Image key={`${uri}-${index}`} source={{ uri }} style={styles.backgroundImage} />
                  ))}
                  {Array.from({ length: Math.max(0, 3 - backgroundThumbnails.length) }).map((_, idx) => (
                    <View style={styles.backgroundPlaceholder} key={`placeholder-${idx}`}>
                      <Ionicons name="image" size={20} color="rgba(255,255,255,0.6)" />
                    </View>
                  ))}
                </View>

                <View style={styles.currencyRow}>
                </View>
              </View>
            </ScrollView>

            <View style={styles.buttonContainer}>
              <Pressable
                style={[
                  styles.claimButton,
                  (!selectedCharacterId || isGifting) && styles.claimButtonDisabled,
                ]}
                disabled={!selectedCharacterId || isGifting}
                onPress={() => selectedCharacterId && claimGift(selectedCharacterId)}
              >
                {isGifting ? (
                  <>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.claimLabel}>Claiming...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="gift" size={20} color="#fff" />
                    <Text style={styles.claimLabel}>Claim</Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
};

const CurrencyChip: React.FC<{ icon: ImageSourcePropType; label: string }> = ({ icon, label }) => (
  <View style={styles.currencyChip}>
    <Image source={icon} style={styles.currencyIcon} resizeMode="contain" />
    <Text style={styles.currencyLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
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
    backgroundColor: '#fff',
  },
  starsOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.7,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 140,
    gap: 24,
  },
  logoHeader: {
    alignItems: 'center',
  },
  logo: {
    width: 80,
    height: 40,
  },
  titleContainer: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  characterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  characterCell: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  characterCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  characterCircleSelected: {
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  characterCircleImage: {
    width: '100%',
    height: '100%',
  },
  characterLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  characterLabelSelected: {
    color: '#fff',
  },
  descriptionCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  receiveBlock: {
    marginTop: 12,
    padding: 20,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.12)',
    gap: 16,
  },
  receiveTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  receiveSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  backgroundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  backgroundImage: {
    width: 100,
    height: 120,
    borderRadius: 16,
  },
  backgroundPlaceholder: {
    width: 100,
    height: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  currencyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  currencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    gap: 8,
  },
  currencyIcon: {
    width: 20,
    height: 20,
  },
  currencyLabel: {
    color: '#fff',
    fontWeight: '700',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FF2F71',
    paddingHorizontal: 48,
    paddingVertical: 18,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 6,
  },
  claimButtonDisabled: {
    opacity: 0.6,
  },
  claimLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});

