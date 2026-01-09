import React, { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  FlatList,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Video } from 'expo-av';
import { CharacterRepository, type CharacterItem } from '../../repositories/CharacterRepository';
import { MediaItem } from '../../repositories/MediaRepository';
import { BottomSheet, type BottomSheetRef } from '../BottomSheet';
import { DiamondBadge } from '../DiamondBadge';
import { getSupabaseClient, getAuthenticatedUserId } from '../../services/supabase';



type CharacterDetailSheetProps = {
  isOpened?: boolean;
  onIsOpenedChange?: (opened: boolean) => void;
  characterId: string;
  characterName: string;
  characterAvatarURL?: string | null;
  characterDescription?: string | null;
  isDarkBackground?: boolean;
  onDismiss?: () => void;
  isPro?: boolean;
  onOpenSubscription?: () => void;
};

export type CharacterDetailSheetRef = BottomSheetRef;

type Tab = 'information' | 'gallery';

type GalleryMediaItem = MediaItem & {
  conversationId: string;
};

const isVideoItem = (item: GalleryMediaItem) => {
  const mediaType = item.media_type?.toLowerCase();
  if (mediaType) {
    return mediaType === 'video' || mediaType === 'dance';
  }
  const url = item.url.toLowerCase();
  return url.endsWith('.mp4') || url.includes('video');
};

export const CharacterDetailSheet = forwardRef<CharacterDetailSheetRef, CharacterDetailSheetProps>(({
  isOpened,
  onIsOpenedChange,
  characterId,
  characterName,
  characterDescription,
  isDarkBackground = true,
  onDismiss,
  isPro = false,
  onOpenSubscription,
}, ref) => {
  const sheetRef = useRef<BottomSheetRef>(null);
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();

  const [character, setCharacter] = useState<CharacterItem | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('information');
  const [media, setMedia] = useState<GalleryMediaItem[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [previewItem, setPreviewItem] = useState<GalleryMediaItem | null>(null);

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

  // Fetch media from conversation table - only media sent by the character (is_agent = true)
  const loadMedia = useCallback(async () => {
    setIsLoadingMedia(true);
    try {
      const client = getSupabaseClient();
      const userId = await getAuthenticatedUserId();

      const { data, error } = await client
        .from('conversation')
        .select('id, media_id, medias(*)')
        .eq('character_id', characterId)
        .eq('user_id', userId)
        .eq('is_agent', true)
        .not('media_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[CharacterDetailSheet] Failed to load media from conversation', error);
        setMedia([]);
        return;
      }

      // Map conversation rows to GalleryMediaItem
      const mediaItems: GalleryMediaItem[] = (data || [])
        .filter((row: any) => row.medias) // Only rows with valid media
        .map((row: any) => ({
          ...row.medias,
          conversationId: row.id,
        }));

      setMedia(mediaItems);
    } catch (error) {
      console.warn('[CharacterDetailSheet] Failed to load media', error);
      setMedia([]);
    } finally {
      setIsLoadingMedia(false);
    }
  }, [characterId]);

  useEffect(() => {
    if (isOpened) {
      loadCharacter();
      loadMedia();
    } else {
      setPreviewItem(null);
    }
  }, [isOpened, loadCharacter, loadMedia]);

  const handleTabChange = (tab: Tab) => {
    Haptics.selectionAsync();
    setActiveTab(tab);
  };

  const handleMediaSelect = useCallback((item: GalleryMediaItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);

    if (isPro) {
      setPreviewItem(item);
    } else {
      // Not pro -> Upsell
      sheetRef.current?.dismiss();
      setTimeout(() => {
        onOpenSubscription?.();
      }, 300);
    }
  }, [isPro, onOpenSubscription]);

  // Parse data if it's a string (though it should be an object from Supabase)
  const characterData = typeof character?.data === 'string'
    ? JSON.parse(character.data)
    : character?.data || {};

  const description = characterDescription || character?.description;
  const heightCm = characterData?.height_cm;
  const age = characterData?.old || characterData?.age;

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

  const renderGalleryItem = useCallback(({ item }: { item: GalleryMediaItem }) => {
    const isUnlocked = isPro;
    const thumb = item.thumbnail || item.url;
    const cardWidth = (SCREEN_WIDTH - 40 - 12) / 2;

    return (
      <Pressable
        onPress={() => handleMediaSelect(item)}
        style={[styles.galleryItem, { backgroundColor: cardBgColor, width: cardWidth }]}
      >
        <ExpoImage
          source={{ uri: thumb }}
          style={styles.galleryImage}
          contentFit="cover"
          blurRadius={!isUnlocked ? 50 : 0}
        />

        {!isUnlocked && (
          <View style={styles.lockOverlay}>
            <DiamondBadge size="md" />
          </View>
        )}

        {isVideoItem(item) && isUnlocked && (
          <View style={styles.videoIndicator}>
            <Ionicons name="play-circle" size={24} color="#fff" />
          </View>
        )}
      </Pressable>
    );
  }, [isPro, SCREEN_WIDTH, handleMediaSelect, cardBgColor]);

  const renderGalleryTab = () => (
    <View style={{ flex: 1, maxHeight: SCREEN_HEIGHT * 0.9 }}>
      <FlatList<GalleryMediaItem>
        data={media}
        keyExtractor={(item) => item.conversationId}
        numColumns={2}
        renderItem={renderGalleryItem}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        columnWrapperStyle={{ gap: 12, marginBottom: 12 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: tertiaryTextColor }]}>
              {isLoadingMedia ? 'Loading...' : 'No media received yet'}
            </Text>
            <Text style={[styles.emptySubtext, { color: tertiaryTextColor }]}>
              Chat with {characterName} to receive photos and videos
            </Text>
          </View>
        }
      />
    </View>
  );

  return (
    <>
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

      <MediaPreviewModal
        item={previewItem}
        onClose={() => setPreviewItem(null)}
      />
    </>
  );
});

// Media Preview Modal
const MediaPreviewModal: React.FC<{
  item: GalleryMediaItem | null;
  onClose: () => void;
}> = ({ item, onClose }) => {
  const videoRef = useRef<Video | null>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!item && videoRef.current) {
      videoRef.current.stopAsync().catch(() => undefined);
    }
  }, [item]);

  if (!item) return null;

  const isVideo = isVideoItem(item);

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.lightboxContainer}>
        <Pressable
          style={[styles.lightboxCloseButton, { top: insets.top + 10 }]}
          onPress={onClose}
          hitSlop={20}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>

        {isVideo ? (
          <Video
            ref={ref => {
              videoRef.current = ref;
            }}
            style={{ width, height: height * 0.8 }}
            source={{ uri: item.url }}
            useNativeControls
            resizeMode="contain"
            shouldPlay
            isLooping
          />
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              alignItems: 'center',
              minWidth: width,
              minHeight: height,
            }}
            maximumZoomScale={5}
            minimumZoomScale={1}
            bouncesZoom
            bounces
            centerContent
            pinchGestureEnabled
          >
            <ExpoImage
              source={{ uri: item.url }}
              style={{ width, height: height * 0.9 }}
              contentFit="contain"
            />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

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
  galleryItem: {
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    padding: 4,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
  lightboxContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxCloseButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
});
