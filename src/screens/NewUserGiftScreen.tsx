import React, { useState, useEffect } from 'react';
import {
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
import { AssetRepository } from '../repositories/AssetRepository';
import { CurrencyRepository } from '../repositories/CurrencyRepository';
import { BackgroundRepository } from '../repositories/BackgroundRepository';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  onComplete: (characterId: string | null) => void;
};

export const NewUserGiftScreen: React.FC<Props> = ({ onComplete }) => {
  const [freeCharacters, setFreeCharacters] = useState<CharacterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [isGifting, setIsGifting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadFreeCharacters();
  }, []);

  const loadFreeCharacters = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const characterRepo = new CharacterRepository();
      // Fetch free characters using repository method (like Swift version)
      const free = await characterRepo.fetchFreeCharacters();
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

  const claimGift = async (characterId: string) => {
    if (!characterId) return;
    setIsGifting(true);
    setErrorMessage(null);

    try {
      console.log('🎁 [NewUserGiftScreen] Starting gift claim for character:', characterId);
      const assetRepo = new AssetRepository();
      const currencyRepo = new CurrencyRepository();
      const backgroundRepo = new BackgroundRepository();

      // Gift character
      console.log('🎁 [NewUserGiftScreen] Gifting character...');
      await assetRepo.createAsset(characterId, 'character');

      // Get character to find default costume
      const characterRepo = new CharacterRepository();
      const character = await characterRepo.fetchCharacter(characterId);

      // Gift default costume if available
      if (character?.default_costume_id) {
        try {
          console.log('🎁 [NewUserGiftScreen] Gifting default costume...');
          await assetRepo.createAsset(character.default_costume_id, 'character_costume');
        } catch (err) {
          console.warn('[NewUserGiftScreen] Could not gift default costume:', err);
        }
      }

      // Gift 3 random backgrounds
      // Fetch more backgrounds than needed, then shuffle to randomize selection (like Swift version)
      console.log('🎁 [NewUserGiftScreen] Gifting backgrounds...');
      const allBackgrounds = await backgroundRepo.fetchAllBackgrounds();
      // Shuffle array to randomize selection
      const shuffledBackgrounds = [...allBackgrounds].sort(() => Math.random() - 0.5);
      const backgroundsToGift = shuffledBackgrounds.slice(0, 3);
      
      for (const bg of backgroundsToGift) {
        try {
          await assetRepo.createAsset(bg.id, 'background');
        } catch (err) {
          console.warn('[NewUserGiftScreen] Could not gift background:', err);
        }
      }

      // Gift currency
      console.log('🎁 [NewUserGiftScreen] Gifting currency...');
      const currentCurrency = await currencyRepo.fetchCurrency();
      await currencyRepo.updateCurrency(currentCurrency.vcoin + 10000, currentCurrency.ruby + 100);

      // Verify assets were created (retry up to 3 times with delay)
      console.log('🎁 [NewUserGiftScreen] Verifying assets were created...');
      let verified = false;
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
        const ownedCharacterIds = await assetRepo.fetchOwnedAssets('character');
        if (ownedCharacterIds.has(characterId)) {
          verified = true;
          console.log('✅ [NewUserGiftScreen] Assets verified after', i + 1, 'attempt(s)');
          break;
        }
      }
      if (!verified) {
        console.warn('⚠️ [NewUserGiftScreen] Assets verification failed, but continuing...');
      }

      console.log('✅ [NewUserGiftScreen] Gift claim completed, calling onComplete...');
      setIsGifting(false);
      onComplete(characterId);
    } catch (error: any) {
      console.error('[NewUserGiftScreen] Failed to claim gift:', error);
      setErrorMessage(error.message || 'Failed to claim gift');
      setIsGifting(false);
    }
  };

  const selectedCharacter = freeCharacters.find((c) => c.id === selectedCharacterId);

  return (
    <LinearGradient
      colors={['#FF8587', '#8F0039']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
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
            <Button variant="solid" color="primary" onPress={loadFreeCharacters} style={styles.retryButton}>
              Retry
            </Button>
          </View>
        ) : (
          <>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>Welcome Gift!</Text>
                <Text style={styles.subtitle}>Choose your first character to get started</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.characterScrollContent}
                style={styles.characterScroll}
              >
                {freeCharacters.map((character) => (
                  <Pressable
                    key={character.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                      setSelectedCharacterId(character.id);
                    }}
                    style={[
                      styles.characterCard,
                      selectedCharacterId === character.id && styles.characterCardSelected,
                    ]}
                  >
                    {character.thumbnail_url || character.avatar ? (
                      <Image
                        source={{ uri: character.thumbnail_url || character.avatar }}
                        style={styles.characterImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.characterImagePlaceholder}>
                        <Ionicons name="person" size={40} color="#fff" />
                      </View>
                    )}
                    <Text style={styles.characterName} numberOfLines={1}>
                      {character.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {selectedCharacter && (
                <View style={styles.descriptionCard}>
                  <Text style={styles.descriptionTitle}>{selectedCharacter.name}</Text>
                  <Text style={styles.descriptionText} numberOfLines={3}>
                    {selectedCharacter.description || 'No description available.'}
                  </Text>
                </View>
              )}

              <View style={styles.giftDetailsCard}>
                <Text style={styles.giftDetailsTitle}>You'll receive:</Text>
                <View style={styles.giftItems}>
                  <GiftItem icon="person-outline" text="1 Character" />
                  <GiftItem icon="shirt-outline" text="1 Costume" />
                  <GiftItem icon="grid-outline" text="3 Rooms" />
                  <GiftItem icon="cash-outline" text="10,000 VCoin" />
                  <GiftItem icon="diamond-outline" text="100 Ruby" />
                </View>
              </View>
            </ScrollView>

            <View style={styles.buttonContainer}>
              <Button
                variant="liquid"
                fullWidth
                onPress={() => selectedCharacterId && claimGift(selectedCharacterId)}
                disabled={!selectedCharacterId || isGifting}
                loading={isGifting}
                startIconName={isGifting ? undefined : 'gift'}
                style={styles.claimButton}
              >
                {isGifting ? 'Claiming...' : 'Claim Gift'}
              </Button>
            </View>
          </>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
};

const GiftItem: React.FC<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = ({ icon, text }) => (
  <View style={styles.giftItem}>
    <Ionicons name={icon} size={20} color="#fff" />
    <Text style={styles.giftItemText}>{text}</Text>
  </View>
);

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
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 120,
  },
  titleContainer: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  characterScroll: {
    height: 230,
  },
  characterScrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  characterCard: {
    width: 160,
    height: 200,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  characterCardSelected: {
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  characterImage: {
    width: '100%',
    height: 160,
  },
  characterImagePlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  characterName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    padding: 12,
    textAlign: 'center',
  },
  descriptionCard: {
    marginHorizontal: 16,
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
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
  giftDetailsCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  giftDetailsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  giftItems: {
    gap: 8,
  },
  giftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  giftItemText: {
    fontSize: 14,
    color: '#fff',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    alignSelf: 'center',
    width: '100%',
  },
  claimButton: {
    backgroundColor: '#fff',
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  } as any,
});

