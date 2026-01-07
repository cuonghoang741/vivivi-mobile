import React, { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { CharacterRepository, type CharacterItem } from '../../repositories/CharacterRepository';
import { MediaRepository, type MediaItem } from '../../repositories/MediaRepository';
import { BottomSheet, type BottomSheetRef } from '../BottomSheet';



type CharacterDetailSheetProps = {
  isOpened?: boolean;
  onIsOpenedChange?: (opened: boolean) => void;
  characterId: string;
  characterName: string;
  characterAvatarURL?: string | null;
  characterDescription?: string | null;
  isDarkBackground?: boolean;
  onDismiss?: () => void;
};

export type CharacterDetailSheetRef = BottomSheetRef;

type Tab = 'information' | 'gallery';

export const CharacterDetailSheet = forwardRef<CharacterDetailSheetRef, CharacterDetailSheetProps>(({
  isOpened,
  onIsOpenedChange,
  characterId,
  characterName,
  characterDescription,
  isDarkBackground = true,
  onDismiss,
}, ref) => {
  const sheetRef = useRef<BottomSheetRef>(null);
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();

  const [character, setCharacter] = useState<CharacterItem | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('information');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);

  // Dynamic colors
  const textColor = isDarkBackground ? '#fff' : '#000';
  const secondaryTextColor = isDarkBackground ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
  const tertiaryTextColor = isDarkBackground ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const cardBgColor = isDarkBackground ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const activeTabBgColor = isDarkBackground ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';

  // Expose present/dismiss via ref
  useImperativeHandle(ref, () => ({
    present: (index?: number) => sheetRef.current?.present(index),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const loadCharacter = useCallback(async () => {
    console.log('[CharacterDetailSheet] Loading character:', characterId);
    try {
      const characterRepo = new CharacterRepository();
      const loaded = await characterRepo.fetchCharacter(characterId);
      console.log('[CharacterDetailSheet] Loaded character:', loaded?.name, 'data:', loaded?.data);
      setCharacter(loaded);
    } catch (error) {
      console.warn('[CharacterDetailSheet] Failed to load character', error);
    }
  }, [characterId]);

  const loadMedia = useCallback(async () => {
    setIsLoadingMedia(true);
    try {
      const mediaRepo = new MediaRepository();
      const fetched = await mediaRepo.fetchAllMedia(characterId);
      setMedia(fetched);
    } catch (error) {
      console.warn('[CharacterDetailSheet] Failed to load media', error);
    } finally {
      setIsLoadingMedia(false);
    }
  }, [characterId]);

  useEffect(() => {
    if (isOpened) {
      loadCharacter();
      loadMedia();
    }
  }, [isOpened, loadCharacter, loadMedia]);

  const handleTabChange = (tab: Tab) => {
    Haptics.selectionAsync();
    setActiveTab(tab);
  };

  // Parse data if it's a string (though it should be an object from Supabase)
  const characterData = typeof character?.data === 'string'
    ? JSON.parse(character.data)
    : character?.data || {};

  const description = characterDescription || character?.description;
  const heightCm = characterData?.height_cm;
  const age = characterData?.old || characterData?.age;

  console.log('[CharacterDetailSheet] Render info:', { heightCm, age, description });

  const renderInformationTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Profile</Text>
        <View style={styles.profileRow}>
          <View style={[styles.profileCard, { backgroundColor: cardBgColor }]}>
            <View style={styles.profileIconContainer}>
              <Ionicons name="body" size={20} color={textColor} />
            </View>
            <View>
              <Text style={[styles.profileLabel, { color: secondaryTextColor }]}>Height</Text>
              <Text style={[styles.profileValue, { color: textColor }]}>
                {heightCm ? `${heightCm} cm` : 'Unknown'}
              </Text>
            </View>
          </View>

          <View style={[styles.profileCard, { backgroundColor: cardBgColor }]}>
            <View style={styles.profileIconContainer}>
              <Ionicons name="calendar-outline" size={20} color={textColor} />
            </View>
            <View>
              <Text style={[styles.profileLabel, { color: secondaryTextColor }]}>Age</Text>
              <Text style={[styles.profileValue, { color: textColor }]}>
                {age ? `${age} years old` : 'Unknown'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {description ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Backstory</Text>
          <Text style={[styles.descriptionText, { color: secondaryTextColor }]}>
            {description}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );

  const renderGalleryTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {media.length > 0 ? (
        <View style={styles.galleryGrid}>
          {media.map((item) => (
            <View key={item.id} style={[styles.galleryItem, { backgroundColor: cardBgColor, width: (SCREEN_WIDTH - 40 - 12) / 2 }]}>
              <ExpoImage
                source={{ uri: item.thumbnail || item.url }}
                style={styles.galleryImage}
                contentFit="cover"
              />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: tertiaryTextColor }]}>No media found</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <BottomSheet
      ref={sheetRef}
      isOpened={isOpened}
      onIsOpenedChange={onIsOpenedChange}
      onDismiss={onDismiss}
      title={characterName || character?.name || 'Character'}
      isDarkBackground={isDarkBackground}
      detents={[0.45, 0.75]}
    >
      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: cardBgColor }]}>
        <Pressable
          style={[
            styles.tabButton,
            activeTab === 'information' && { backgroundColor: activeTabBgColor }
          ]}
          onPress={() => handleTabChange('information')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'information' ? textColor : secondaryTextColor }
          ]}>
            Information
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.tabButton,
            activeTab === 'gallery' && { backgroundColor: activeTabBgColor }
          ]}
          onPress={() => handleTabChange('gallery')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'gallery' ? textColor : secondaryTextColor }
          ]}>
            Gallery
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {activeTab === 'information' ? renderInformationTab() : renderGalleryTab()}
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 24,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  profileRow: {
    flexDirection: 'row',
    gap: 12,
  },
  profileCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  profileIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  profileLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 24,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  galleryItem: {
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
