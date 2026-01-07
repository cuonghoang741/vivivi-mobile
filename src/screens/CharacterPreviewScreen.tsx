import React, { useRef, useState, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VRMWebView } from '../components/VRMWebView';
import { CharacterItem } from '../repositories/CharacterRepository';
import { brand } from '../styles/palette';
import { BackgroundRepository } from '../repositories/BackgroundRepository';
import { CustomSheet } from '../components/CustomSheet';
import Button from '../components/Button';
import { DiamondBadge } from '../components/DiamondBadge';
import { useVRMContext } from '../context/VRMContext';
import { UserCharacterPreferenceService } from '../services/UserCharacterPreferenceService';

const DIAMOND_ICON_URL = 'https://d1j8r0kxyu9tj8.cloudfront.net/files/gHCihrZqs0a7K0rms5qSXE1TRs8FuWwPWaEeLIey.png';

type RootStackParamList = {
    Experience: { purchaseCharacterId?: string; selectedCharacterId?: string };
    CharacterPreview: { characters: CharacterItem[]; initialIndex?: number; isViewMode?: boolean; ownedCharacterIds?: string[]; isPro?: boolean };
    OnboardingV2: { selectedCharacterId: string };
};

type CharacterPreviewRouteProp = RouteProp<RootStackParamList, 'CharacterPreview'>;
type CharacterPreviewNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CharacterPreview'>;

const DEFAULT_BACKGROUND_URL = 'https://d1j8r0kxyu9tj8.cloudfront.net/files/JAZHAJFvr2Lj8gtKb7cBPSnpPiQBPcNoG7tlEihj.jpg';
const FBX_BASE_URL = 'https://n6n.top/Anim/';
const DEFAULT_PREVIEW_ANIMATIONS = ['Standing Greeting.fbx', 'Hand Raising.fbx'];

// Get random animation from default list
const getRandomPreviewAnimation = () => {
    const randomIndex = Math.floor(Math.random() * DEFAULT_PREVIEW_ANIMATIONS.length);
    return DEFAULT_PREVIEW_ANIMATIONS[randomIndex];
};


interface CharacterPreviewScreenProps {
    characters?: CharacterItem[];
    initialIndex?: number;
    isViewMode?: boolean;
    ownedCharacterIds?: string[];
    isPro?: boolean;
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
    // PRO users or owned characters can be selected
    const canSelect = isOwned || isPro;


    const webViewRef = useRef<WebView>(null);
    const hasLoadedModelRef = useRef(false);
    const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>(DEFAULT_BACKGROUND_URL);
    const [isDarkBackground, setIsDarkBackground] = useState(true);
    const insets = useSafeAreaInsets();
    const { height: screenHeight } = useWindowDimensions();

    // Calculate thumbnails position above the lowest snap point (0.25 = 25% of screen)
    const lowestSnapHeight = screenHeight * 0.25;
    const thumbnailsBottomPosition = !isOnboardingFlow ? lowestSnapHeight + 20 : insets.bottom + 60; // 20px padding above sheet

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

    // Reload VRM model (animation will be triggered by modelLoaded event)
    useEffect(() => {
        if (character && webViewRef.current && hasLoadedModelRef.current) {
            // Update background if it changed
            const jsBackground = `
                if (typeof window.setBackgroundImage === 'function') {
                   window.setBackgroundImage("${backgroundImageUrl}");
                } else {
                   document.body.style.backgroundImage = 'url("${backgroundImageUrl}")';
                }
                true;
            `;
            webViewRef.current.injectJavaScript(jsBackground);

            const escapedURL = character.base_model_url?.replace(/\\/g, '\\\\').replace(/"/g, '\\"') || '';
            const escapedName = (character.name || 'Character').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

            const js = `
                (async () => {
                    if (typeof window.loadModelByURL === 'function') {
                        await window.loadModelByURL("${escapedURL}", "${escapedName}");
                    }
                })();
                true;
            `;
            webViewRef.current.injectJavaScript(js);
        }
    }, [currentIndex, character, backgroundImageUrl]);

    const handleSelectCharacter = useCallback(() => {
        if (character) {
            navigation.navigate('OnboardingV2', { selectedCharacterId: character.id });
        }
    }, [navigation, character]);

    const handleUpgradeToPro = useCallback(() => {
        // Navigate to subscription screen or show upgrade modal
        // For now, just show an alert
        Alert.alert(
            'Upgrade to Roxie Pro',
            'Unlock all characters, costumes, and backgrounds with a Pro subscription.',
            [
                { text: 'Maybe Later', style: 'cancel' },
                { text: 'Upgrade Now', onPress: () => navigation.goBack() },
            ]
        );
    }, [navigation]);

    // Hide default navigation header
    useEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    // Check if we should show back button
    const showBackButton = isViewMode || !isOnboardingFlow;

    // Price info for header right
    const hasRuby = (character?.price_ruby ?? 0) > 0;
    const hasCoin = (character?.price_vcoin ?? 0) > 0;
    const showPrices = !isViewMode && !isOnboardingFlow && !isOwned && (hasRuby || hasCoin);

    const handleVRMMessage = useCallback((message: string) => {
        console.log('[CharacterPreview] Received VRM message:', message);

        // Handle model loaded event - play greeting
        if (message === 'modelLoaded') {
            console.log('[CharacterPreview] Model loaded, playing random greeting');
            const js = `
                if (typeof window.playRandomGreeting === 'function') {
                    window.playRandomGreeting();
                }
                true;
            `;
            webViewRef.current?.injectJavaScript(js);
            return;
        }

        if (message === 'initialReady' && !hasLoadedModelRef.current) {
            hasLoadedModelRef.current = true;

            // Set background
            const bgUrl = backgroundImageUrl;

            const jsBackground = `
                // Set background image
                if (typeof window.setBackgroundImage === 'function') {
                   window.setBackgroundImage("${bgUrl}");
                } else {
                   document.body.style.backgroundImage = 'url("${bgUrl}")';
                }
                true;
            `;
            webViewRef.current?.injectJavaScript(jsBackground);

            if (character.base_model_url) {
                const escapedURL = character.base_model_url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                const escapedName = (character.name || 'Character').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

                const js = `
                    (async () => {
                        // Load VRM model
                        if (typeof window.loadModelByURL === 'function') {
                            await window.loadModelByURL("${escapedURL}", "${escapedName}");
                        }
                    })();
                    true;
                `;

                webViewRef.current?.injectJavaScript(js);
            }
        }
    }, [character.base_model_url, character.name, backgroundImageUrl]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isDarkBackground ? "light-content" : "dark-content"} />

            {/* Custom Header */}
            <View style={[styles.customHeader, { paddingTop: insets.top }]}>
                {/* Left: Back button */}
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

                {/* Center: Title */}
                <View style={styles.headerCenter}>

                </View>

                {/* Right: PRO badge for unowned characters */}
                <View style={styles.headerRight}>
                    {!isOwned && !isOnboardingFlow && (
                        <DiamondBadge size="md" />
                    )}
                </View>
            </View>

            {/* Full Screen VRM WebView */}
            <View style={styles.webViewContainer}>
                <VRMWebView
                    ref={webViewRef}
                    onMessage={handleVRMMessage}
                    enableDebug={false}
                />


            </View>

            {/* Floating Prev/Next Navigation Buttons */}
            {characters.length > 1 && (
                <>
                    {currentIndex > 0 && (
                        <View
                            style={[styles.floatingNavButton, styles.floatingNavButtonLeft]}
                        >
                            <Button
                                onPress={() => setCurrentIndex(currentIndex - 1)}
                                variant='liquid'
                                startIconName='chevron-back'
                                iconColor={isDarkBackground ? 'white' : 'black'}
                                isIconOnly
                                size='lg'
                            >
                            </Button>
                        </View>
                    )}
                    {currentIndex < characters.length - 1 && (
                        <View
                            style={[styles.floatingNavButton, styles.floatingNavButtonRight]}
                        >
                            <Button
                                onPress={() => setCurrentIndex(currentIndex + 1)}
                                variant='liquid'
                                startIconName='chevron-forward'
                                iconColor={isDarkBackground ? 'white' : 'black'}
                                isIconOnly
                                size='lg'
                            >
                            </Button>
                        </View>
                    )}
                </>
            )}


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
                        <TouchableOpacity style={styles.selectButton} onPress={handleSelectCharacter}>
                            <Text style={styles.selectButtonText}>Continue</Text>
                        </TouchableOpacity>
                    )}

                    {/* From CharacterSheet: show Upgrade to Pro for unowned characters (non-PRO users) */}
                    {!isOnboardingFlow && !canSelect && (
                        <TouchableOpacity style={styles.goProButton} onPress={handleUpgradeToPro}>
                            <DiamondBadge size="lg" />
                            <Text style={styles.goProButtonText}>Go Unlimited</Text>
                        </TouchableOpacity>
                    )}

                    {/* Owned characters OR PRO users: show Select button */}
                    {!isOnboardingFlow && canSelect && (
                        <TouchableOpacity
                            style={styles.selectButton}
                            onPress={async () => {
                                // Update global state directly
                                setCurrentCharacterState(character);

                                // Persist selection
                                try {
                                    await UserCharacterPreferenceService.saveUserCharacterPreference(character.id, {});
                                } catch (e) {
                                    console.warn('Failed to save character preference:', e);
                                }

                                // Navigate back like a standard back action
                                navigation.goBack();
                            }}
                        >
                            <Text style={styles.selectButtonText}>Select</Text>
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
        backgroundColor: 'rgba(255, 87, 154, 0.6)',
        paddingVertical: 16,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
        gap: 9,
    },
    goProButtonText: {
        color: '#fff',
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
