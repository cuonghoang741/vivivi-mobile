import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
    StatusBar,
    ScrollView,
    Image,
    Pressable,
    useWindowDimensions,
    Alert,
    Animated,
    ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CharacterItem } from '../repositories/CharacterRepository';
import { brand } from '../styles/palette';
import { BackgroundRepository } from '../repositories/BackgroundRepository';
import { CostumeRepository } from '../repositories/CostumeRepository';
import { CustomSheet } from '../components/CustomSheet';
import Button from '../components/Button';
import { DiamondBadge } from '../components/DiamondBadge';
import DiamondIcon from '../assets/icons/diamond.svg';
import { useVRMContext } from '../context/VRMContext';
import { UserCharacterPreferenceService } from '../services/UserCharacterPreferenceService';
import { VideoCacheService } from '../services/VideoCacheService';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const DIAMOND_ICON_URL = 'https://d1j8r0kxyu9tj8.cloudfront.net/files/gHCihrZqs0a7K0rms5qSXE1TRs8FuWwPWaEeLIey.png';

// Map of local video assets by character order
const LOCAL_VIDEOS: Record<number, any> = {
    1: require('../assets/videos/1.mp4'),
    2: require('../assets/videos/2.mp4'),
    3: require('../assets/videos/3.mp4'),
};

type RootStackParamList = {
    Experience: { purchaseCharacterId?: string; selectedCharacterId?: string };
    CharacterPreview: { characters: CharacterItem[]; initialIndex?: number; isViewMode?: boolean; ownedCharacterIds?: string[]; isPro?: boolean };
    OnboardingV2: { selectedCharacterId: string };
};

type CharacterPreviewRouteProp = RouteProp<RootStackParamList, 'CharacterPreview'>;
type CharacterPreviewNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CharacterPreview'>;

const DEFAULT_BACKGROUND_URL = 'https://d1j8r0kxyu9tj8.cloudfront.net/files/JAZHAJFvr2Lj8gtKb7cBPSnpPiQBPcNoG7tlEihj.jpg';

interface CharacterPreviewScreenProps {
    characters?: CharacterItem[];
    initialIndex?: number;
    isViewMode?: boolean;
    ownedCharacterIds?: string[];
    isPro?: boolean;
    onSelect?: (character: CharacterItem) => void;
}

export const CharacterPreviewScreen: React.FC<CharacterPreviewScreenProps> = (props) => {
    const navigation = useNavigation<CharacterPreviewNavigationProp>();
    const route = useRoute<CharacterPreviewRouteProp>();
    const { setCurrentCharacterState } = useVRMContext();

    // Support both props (embedded mode) and route params (navigation mode)
    const characters = props.characters || route.params?.characters || [];
    const initialIdx = props.initialIndex ?? route.params?.initialIndex ?? 0;
    const isViewMode = props.isViewMode ?? route.params?.isViewMode ?? false;

    // Determine if this is onboarding flow (no ownedCharacterIds provided)
    const rawOwnedIds = props.ownedCharacterIds ?? route.params?.ownedCharacterIds;
    const isOnboardingFlow = rawOwnedIds === undefined || rawOwnedIds === null;
    const ownedCharacterIds = new Set(rawOwnedIds ?? []);
    const isPro = props.isPro ?? route.params?.isPro ?? false;

    const [currentIndex, setCurrentIndex] = useState(initialIdx);
    const character = characters[currentIndex];
    const isOwned = character ? ownedCharacterIds.has(character.id) : false;
    const canSelect = isOwned || isPro;

    // Store all video sources (URL string or Asset ID number)
    const [characterVideoSources, setCharacterVideoSources] = useState<Map<string, any>>(new Map());
    // Store cached local URIs for remote URLs
    const [cachedVideoUris, setCachedVideoUris] = useState<Map<string, string | null>>(new Map());
    const [isLoadingVideos, setIsLoadingVideos] = useState(true);
    const [isSelectingCharacter, setIsSelectingCharacter] = useState(false);
    const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>(DEFAULT_BACKGROUND_URL);
    const [isDarkBackground, setIsDarkBackground] = useState(true);
    const insets = useSafeAreaInsets();
    const { height: screenHeight } = useWindowDimensions();

    // Fade animation
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const prevIndexRef = useRef(currentIndex);

    // Calculate thumbnails position
    const lowestSnapHeight = screenHeight * 0.25;
    const thumbnailsBottomPosition = !isOnboardingFlow ? lowestSnapHeight + 20 : insets.bottom + 60;

    // Load all character videos once on mount and preload to cache
    useEffect(() => {
        const loadAllVideos = async () => {
            if (characters.length === 0) return;
            setIsLoadingVideos(true);

            const costumeRepo = new CostumeRepository();
            const videoMap = new Map<string, any>();

            // Step 1: Collect all video sources
            await Promise.all(
                characters.map(async (char) => {
                    try {
                        // 0. Check for local video asset first (NEW)
                        // Debug log for order check
                        if (char.order && char.order <= 3) {
                            console.log(`[CharacterPreview] Checking local video for ${char.name} (id:${char.id}, order:${char.order}, type:${typeof char.order})`);
                        }

                        // 0. Check for local video asset first (NEW)
                        // Parse order to number to handle cases like "0001" -> 1
                        const orderNum = char.order ? parseInt(String(char.order), 10) : null;

                        console.log(`[CharacterPreview] Checking local video for ${char.name}, order raw: "${char.order}", parsed: ${orderNum}`);

                        if (orderNum && LOCAL_VIDEOS[orderNum]) {
                            console.log(`[CharacterPreview] ✅ Found local video for ${char.name} (order ${orderNum})`);
                            videoMap.set(char.id, LOCAL_VIDEOS[orderNum]);
                            return;
                        } else {
                            console.log(`[CharacterPreview] ❌ No local video found for order ${orderNum} (keys: ${Object.keys(LOCAL_VIDEOS).join(',')})`);
                        }

                        let targetVideoUrl: string | null = null;

                        // 1. Try character video URL
                        if (char.video_url) {
                            targetVideoUrl = char.video_url;
                        }

                        // 2. If no character video, try default costume
                        if (!targetVideoUrl && char.default_costume_id) {
                            const defaultCostume = await costumeRepo.fetchCostumeById(char.default_costume_id);
                            if (defaultCostume?.video_url) {
                                targetVideoUrl = defaultCostume.video_url;
                            }
                        }

                        // 3. Fallback: try fetching all costumes
                        if (!targetVideoUrl) {
                            const costumes = await costumeRepo.fetchCostumes(char.id);
                            const costumeWithVideo = costumes.find(c => c.video_url);
                            if (costumeWithVideo) {
                                targetVideoUrl = costumeWithVideo.video_url ?? null;
                            }
                        }

                        if (targetVideoUrl) {
                            console.log(`[CharacterPreview] ⚠️ Using REMOTE URL for ${char.name}: ${targetVideoUrl}`);
                        }

                        videoMap.set(char.id, targetVideoUrl);
                    } catch (err) {
                        console.warn('[CharacterPreview] Failed to fetch video for character:', char.name, err);
                        videoMap.set(char.id, null);
                    }
                })
            );

            setCharacterVideoSources(videoMap);
            console.log('[CharacterPreview] Loaded video URLs for', videoMap.size, 'characters');

            // Step 2: Preload and cache all REMOTE videos in background
            const videoUrls = [...videoMap.values()].filter((source): source is string => typeof source === 'string' && !!source);
            if (videoUrls.length > 0) {
                console.log('[CharacterPreview] Starting video preload for', videoUrls.length, 'videos');

                // Preload videos and update cached URIs
                VideoCacheService.preloadVideos(videoUrls).then((cachedResults) => {
                    const newCachedUris = new Map<string, string | null>();

                    // Map character IDs to their cached local URIs (only for string URLs)
                    for (const [charId, source] of videoMap.entries()) {
                        if (typeof source === 'string') {
                            const localUri = cachedResults.get(source) || null;
                            newCachedUris.set(charId, localUri);
                        }
                    }

                    setCachedVideoUris(newCachedUris);
                    console.log('[CharacterPreview] Video caching complete. Cached:', newCachedUris.size, 'videos');
                });
            }

            setIsLoadingVideos(false);
        };

        loadAllVideos();
    }, [characters]);

    // Get current video source - prefer cached local URI for instant playback
    const currentVideoSource = useMemo(() => {
        if (!character) return null;

        // Check our resolved source logic
        const source = characterVideoSources.get(character.id);

        // If it's a number, it's a local assert (require)
        if (typeof source === 'number') {
            console.log('[CharacterPreview] Using local asset video for', character.name);
            return source;
        }

        // If it's a string, check if we have a cached local URI
        if (typeof source === 'string') {
            const cachedUri = cachedVideoUris.get(character.id);
            if (cachedUri) {
                console.log('[CharacterPreview] Using cached video for', character.name);
                return { uri: cachedUri };
            }
            return { uri: source };
        }

        return null;
    }, [character, cachedVideoUris, characterVideoSources]);

    // Fade animation when switching characters
    useEffect(() => {
        if (prevIndexRef.current !== currentIndex) {
            // Fade out
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }).start(() => {
                // After fade out, fade in
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }).start();
            });
            prevIndexRef.current = currentIndex;
        }
    }, [currentIndex, fadeAnim]);

    // Fetch background when character changes
    useEffect(() => {
        const fetchBackground = async () => {
            if (character?.background_default_id) {
                try {
                    const bgRepo = new BackgroundRepository();
                    const bg = await bgRepo.fetchBackground(character.background_default_id);
                    if (bg && bg.image) {
                        setBackgroundImageUrl(bg.image);
                        setIsDarkBackground(bg.is_dark !== false);
                    }
                } catch (err) {
                    console.warn('[CharacterPreview] Failed to fetch default background', err);
                }
            } else {
                setBackgroundImageUrl(DEFAULT_BACKGROUND_URL);
                setIsDarkBackground(true);
            }
        };
        fetchBackground();
    }, [character?.background_default_id]);

    // Reset loading state when screen gains focus (e.g. if navigation failed or user went back)
    useFocusEffect(
        useCallback(() => {
            setIsSelectingCharacter(false);
        }, [])
    );

    const handleSelectCharacter = useCallback(async () => {
        if (character && !isSelectingCharacter) {
            setIsSelectingCharacter(true);
            try {
                if (props.onSelect) {
                    await props.onSelect(character);
                    if (!isOnboardingFlow) {
                        // Only reset if likely staying on this screen or if onSelect handles navigation synchronously (and returns)
                        // But for safety in other flows, we might want to rely on useFocusEffect or reset here?
                        // If we are waiting for a prop function, it's safer to reset after it's done unless we know it navigates away.
                        setIsSelectingCharacter(false);
                    }
                } else {
                    navigation.navigate('OnboardingV2', { selectedCharacterId: character.id });
                    // Do NOT reset isSelectingCharacter here. Let it spin until unmount or screen blur.
                    // The useFocusEffect will reset it if we come back.
                }
            } catch (error) {
                console.error('Error selecting character:', error);
                setIsSelectingCharacter(false);
            }
        }
    }, [navigation, character, props.onSelect, isSelectingCharacter, isOnboardingFlow]);

    const handleUpgradeToPro = useCallback(() => {
        Alert.alert(
            'Upgrade to Roxie Pro',
            'Unlock all characters, costumes, and backgrounds with a Pro subscription.',
            [
                { text: 'Maybe Later', style: 'cancel' },
                { text: 'Upgrade Now', onPress: () => navigation.goBack() },
            ]
        );
    }, [navigation]);

    useEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const showBackButton = isViewMode || !isOnboardingFlow;
    const hasRuby = (character?.price_ruby ?? 0) > 0;
    const hasCoin = (character?.price_vcoin ?? 0) > 0;

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isDarkBackground ? "light-content" : "dark-content"} />

            {/* Custom Header */}
            <View style={[styles.customHeader, { paddingTop: insets.top }]}>
                <View style={styles.headerLeft}>
                    {showBackButton && (
                        <Button
                            onPress={() => navigation.goBack()}
                            variant="liquid"
                            startIconName="arrow-back"
                            iconColor={isDarkBackground ? 'white' : 'black'}
                            isIconOnly
                            size="lg"
                        />
                    )}
                </View>

                <View style={styles.headerCenter} />

                <View style={styles.headerRight}>
                    {!isOwned && !isOnboardingFlow && (
                        <DiamondBadge size="md" />
                    )}
                </View>
            </View>

            {/* Full Screen Video Player with Fade */}
            <View style={styles.webViewContainer}>
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
                    {currentVideoSource ? (
                        <Video
                            source={typeof currentVideoSource === 'number' ? currentVideoSource : currentVideoSource}
                            style={StyleSheet.absoluteFill}
                            resizeMode={ResizeMode.COVER}
                            isLooping
                            shouldPlay
                            isMuted={true}
                        />
                    ) : (
                        <Image
                            source={{ uri: character?.avatar || character?.thumbnail_url || backgroundImageUrl }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                        />
                    )}
                </Animated.View>
            </View>


            {/* Floating Prev/Next Navigation Buttons - Hidden */}
            {/* Navigation is handled via thumbnail row at bottom */}

            {/* Bottom Blur Overlay - always dark */}
            <View style={styles.bottomBlurOverlay} pointerEvents="none">
                <MaskedView
                    style={StyleSheet.absoluteFill}
                    maskElement={
                        <LinearGradient
                            colors={['transparent', '#000']}
                            locations={[0, 0.6]}
                            style={StyleSheet.absoluteFill}
                        />
                    }
                >
                    <BlurView
                        intensity={15}
                        tint="dark"
                        style={StyleSheet.absoluteFill}
                    />
                </MaskedView>
                <LinearGradient
                    colors={[
                        'transparent',
                        'rgba(0,0,0,0.3)',
                        'rgba(0,0,0,0.7)'
                    ]}
                    locations={[0, 0.4, 1]}
                    style={StyleSheet.absoluteFill}
                />
            </View>


            {/* Custom Bottom Sheet - Hide for onboarding flow */}
            {!isOnboardingFlow && (
                <CustomSheet
                    snapPoints={[0.27, 0.5, 0.85]}
                    initialSnapIndex={0}
                    isDark={isDarkBackground}
                >
                    <ScrollView
                        style={styles.sheetContent}
                        contentContainerStyle={[styles.sheetContentContainer, { paddingBottom: insets.bottom + 80 }]}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Sheet Header */}
                        <View style={styles.sheetHeader}>
                            <Text style={[styles.characterName, { color: isDarkBackground ? '#000' : '#fff' }]}>
                                {character.name}
                            </Text>
                        </View>

                        {/* Profile Section */}
                        <View style={styles.profileSection}>
                            <Text style={[styles.profileTitle, { color: isDarkBackground ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }]}>
                                Profile
                            </Text>
                            <View style={styles.statsRow}>
                                {character.data?.height_cm && (
                                    <View style={[styles.statItem, { backgroundColor: isDarkBackground ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)' }]}>
                                        <View style={[styles.iconWrapper, { backgroundColor: isDarkBackground ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)' }]}>
                                            <MaterialCommunityIcons name="human-male" size={20} color={isDarkBackground ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)'} />
                                        </View>
                                        <Text style={[styles.statValue, { color: isDarkBackground ? '#000' : '#fff' }]}>
                                            {character.data.height_cm} cm
                                        </Text>
                                    </View>
                                )}
                                {character.data?.old && (
                                    <View style={[styles.statItem, { backgroundColor: isDarkBackground ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)' }]}>
                                        <View style={[styles.iconWrapper, { backgroundColor: isDarkBackground ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)' }]}>
                                            <Ionicons name="information" size={18} color={isDarkBackground ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)'} />
                                        </View>
                                        <Text style={[styles.statValue, { color: isDarkBackground ? '#000' : '#fff' }]}>
                                            {character.data.old} years old
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Backstory */}
                        {character.description && (
                            <View style={styles.section}>
                                <Text style={[styles.sectionTitle, { color: isDarkBackground ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }]}>
                                    Backstory
                                </Text>
                                <Text style={[styles.characterDescription, { color: isDarkBackground ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }]}>
                                    {character.description}
                                </Text>
                            </View>
                        )}

                        {/* Characteristics */}
                        {character.data?.characteristics && (
                            <View style={styles.section}>
                                <Text style={[styles.sectionTitle, { color: isDarkBackground ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }]}>
                                    Personality
                                </Text>
                                <Text style={[styles.characteristicsText, { color: isDarkBackground ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)' }]}>
                                    {character.data.characteristics}
                                </Text>
                            </View>
                        )}

                        {/* Hobbies */}
                        {character.data?.hobbies && character.data.hobbies.length > 0 && (
                            <View style={styles.section}>
                                <Text style={[styles.sectionTitle, { color: isDarkBackground ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }]}>
                                    Hobbies
                                </Text>
                                <View style={styles.hobbiesContainer}>
                                    {character.data.hobbies.map((hobby: string, index: number) => (
                                        <View key={index} style={styles.hobbyTag}>
                                            <Text style={styles.hobbyText}>{hobby}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </CustomSheet>
            )}

            {/* Thumbnails Container - Lower zIndex (below sheet) */}
            {!isViewMode && characters.length > 1 && (
                <View style={[styles.thumbnailsContainer, { bottom: thumbnailsBottomPosition }]}>
                    {/* Title for onboarding flow */}
                    {isOnboardingFlow && (
                        <Text style={styles.onboardingTitle}>Who do you want to be with?</Text>
                    )}

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.thumbnailsRow}
                        style={styles.thumbnailsScrollView}
                    >
                        {characters.map((char, index) => (
                            <TouchableOpacity
                                key={char.id}
                                style={[
                                    styles.thumbnailItem,
                                    styles.thumbnailItemLarge,
                                    index === currentIndex && styles.thumbnailItemSelected,
                                ]}
                                onPress={() => setCurrentIndex(index)}
                            >
                                {char.thumbnail_url || char.avatar ? (
                                    <Image
                                        source={{ uri: char.thumbnail_url || char.avatar }}
                                        style={styles.thumbnailImage}
                                    />
                                ) : (
                                    <View style={styles.thumbnailPlaceholder}>
                                        <Ionicons name="person" size={20} color="#fff" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Button Container - Higher zIndex (above sheet) */}
            {!isViewMode && (
                <View style={[styles.buttonContainer, { bottom: insets.bottom + 0 }]}>
                    {/* Onboarding flow: always show Continue */}
                    {isOnboardingFlow && (
                        <TouchableOpacity
                            style={[styles.selectButton, isSelectingCharacter && styles.selectButtonDisabled]}
                            onPress={handleSelectCharacter}
                            disabled={isSelectingCharacter}
                        >
                            {isSelectingCharacter ? (
                                <ActivityIndicator size="small" color="#000" />
                            ) : (
                                <Text style={styles.selectButtonText}>Continue</Text>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* From CharacterSheet: show Upgrade to Pro for unowned characters (non-PRO users) */}
                    {!isOnboardingFlow && !canSelect && (
                        <TouchableOpacity style={styles.goProButton} onPress={handleUpgradeToPro}>
                            <DiamondIcon width={24} height={24} />
                            <Text style={styles.goProButtonText}>Go Pro</Text>
                        </TouchableOpacity>
                    )}

                    {/* Owned characters OR PRO users: show Select button */}
                    {!isOnboardingFlow && canSelect && (
                        <TouchableOpacity
                            style={[styles.selectButton, isSelectingCharacter && styles.selectButtonDisabled]}
                            disabled={isSelectingCharacter}
                            onPress={async () => {
                                if (isSelectingCharacter) return;
                                setIsSelectingCharacter(true);
                                try {
                                    // Update global state directly
                                    setCurrentCharacterState(character);

                                    // Persist selection
                                    await UserCharacterPreferenceService.saveUserCharacterPreference(character.id, {});

                                    // Navigate back like a standard back action
                                    navigation.goBack();
                                } catch (e) {
                                    console.warn('Failed to save character preference:', e);
                                    navigation.goBack();
                                    setIsSelectingCharacter(false);
                                }
                                // No finally block here to keep spinner during goBack transition
                            }}
                        >
                            {isSelectingCharacter ? (
                                <ActivityIndicator size="small" color="#000" />
                            ) : (
                                <Text style={styles.selectButtonText}>Select</Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    webViewContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    bottomBlurOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '45%',
        zIndex: 5,
    },
    floatingNavButton: {
        position: 'absolute',
        top: '45%',
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    floatingNavButtonLeft: {
        left: 12,
    },
    floatingNavButtonRight: {
        right: 12,
    },
    headerBackButton: {
        width: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCheckButton: {
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'center',
    },
    proBadgeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FFD700',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
    },
    proBadgeHeaderText: {
        color: '#000',
        fontSize: 12,
        fontWeight: '800',
    },
    sheetHeader: {
        marginTop: 8,
        marginBottom: 8,
        textAlign: 'center'
    },
    sheetCheckButton: {
        position: 'absolute',
        right: 0,
        padding: 6
    },
    sheetContent: {
        flex: 1,
    },
    sheetContentContainer: {
        paddingHorizontal: 24,
        paddingTop: 8,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
    },
    characterName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center'
    },
    occupationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    occupationText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '500',
    },
    characterDescription: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
        lineHeight: 24,
        marginBottom: 16,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 20,
    },

    iconWrapper: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 100
    },

    statItem: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8
    },
    statValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    statLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    characteristicsText: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.85)',
        lineHeight: 22,
    },
    hobbiesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    hobbyTag: {
        backgroundColor: brand[500] + '30',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: brand[500] + '50',
    },
    hobbyText: {
        fontSize: 14,
        color: brand[300],
        fontWeight: '500',
    },
    headerNavButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    thumbnailsOuterContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 20,
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    thumbnailsRow: {
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 4,
        paddingHorizontal: 16,
    },
    thumbnailItem: {
        width: 48,
        height: 48,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
        borderRadius: 16,
    },
    thumbnailItemSelected: {
        borderColor: '#fff',
    },
    thumbnailItemLarge: {
        width: 80,
        height: 80,
        borderRadius: 16,
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
        borderRadius: 16,
    },
    thumbnailPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    thumbnailsContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 50,
        alignItems: 'center',
    },
    buttonContainer: {
        position: 'absolute',
        left: 24,
        right: 24,
        zIndex: 200,
        alignItems: 'center',
    },
    onboardingTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 20,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    thumbnailsScrollView: {
        marginBottom: 16,
        alignSelf: 'center',
    },
    selectButtonContainer: {
        position: 'absolute',
        left: 24,
        right: 24,
        zIndex: 200,
    },
    selectButton: {
        backgroundColor: '#fff',
        paddingVertical: 16,
        borderRadius: 28,
        alignItems: 'center',
        alignSelf: 'stretch',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    selectButtonDisabled: {
        opacity: 0.7,
    },
    selectButtonText: {
        color: '#000',
        fontSize: 17,
        fontWeight: '700',
    },
    buyButton: {
        flexDirection: 'row',
        backgroundColor: '#FFD700',
        paddingVertical: 16,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
    },
    buyButtonText: {
        color: 'black',
        fontSize: 17,
        fontWeight: '700',
    },
    goProButton: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
        paddingVertical: 16,
        gap: 9,
    },
    goProButtonText: {
        fontSize: 17,
        fontWeight: '700',
    },
    profileSection: {
        marginBottom: 16,
    },
    profileTitle: {
        fontSize: 13,
        fontWeight: '500',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    headerPriceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    headerPriceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    headerPriceText: {
        fontSize: 13,
        fontWeight: '600',
    },
    customHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    headerLeft: {
        width: 80,
        alignItems: 'flex-start',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerRight: {
        width: 80,
        alignItems: 'flex-end',
    },
    priceBadgeContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
});
