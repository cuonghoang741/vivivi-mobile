import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
    StatusBar,
    ScrollView,
    useWindowDimensions,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CharacterItem } from '../repositories/CharacterRepository';
import { brand } from '../styles/palette';
import Button from '../components/Button';
import { DiamondBadge } from '../components/DiamondBadge';
import DiamondIcon from '../assets/icons/diamond.svg';
import { useVRMContext } from '../context/VRMContext';
import { UserCharacterPreferenceService } from '../services/UserCharacterPreferenceService';
import { LinearGradient } from 'expo-linear-gradient';

type RootStackParamList = {
    Experience: { purchaseCharacterId?: string; selectedCharacterId?: string };
    CharacterPreview: { characters: CharacterItem[]; initialIndex?: number; isViewMode?: boolean; ownedCharacterIds?: string[]; isPro?: boolean };
    OnboardingV2: { selectedCharacterId: string };
};

type CharacterPreviewRouteProp = RouteProp<RootStackParamList, 'CharacterPreview'>;
type CharacterPreviewNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CharacterPreview'>;

interface CharacterPreviewScreenProps {
    characters?: CharacterItem[];
    initialIndex?: number;
    isViewMode?: boolean;
    ownedCharacterIds?: string[];
    isPro?: boolean;
    onSelect?: (character: CharacterItem) => void;
}


interface CharacterGridItemProps {
    character: CharacterItem;
    itemWidth: number;
    isSelected: boolean;
    isOwned: boolean;
    isPro: boolean;
    onPress: (character: CharacterItem) => void;
}

const CharacterGridItem = React.memo(({
    character,
    itemWidth,
    isSelected,
    isOwned,
    isPro,
    onPress
}: CharacterGridItemProps) => {
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const videoUrl = character.video_url;

    // Reset video loaded state if character changes
    useEffect(() => {
        setIsVideoLoaded(false);
    }, [character.id]);

    const showVideo = isSelected && !!videoUrl;

    return (
        <TouchableOpacity
            style={[
                styles.gridItem,
                { width: itemWidth },
                isSelected && styles.gridItemSelected
            ]}
            onPress={() => onPress(character)}
            activeOpacity={0.7}
        >
            <View style={styles.imageContainer}>
                <Image
                    source={{ uri: character.thumbnail_url || character.avatar }}
                    style={[styles.characterImage, { opacity: (showVideo && isVideoLoaded) ? 0 : 1 }]}
                    contentFit="cover"
                    contentPosition="top center"
                    transition={200}
                />

                {showVideo && (
                    <Video
                        source={{ uri: videoUrl }}
                        style={[StyleSheet.absoluteFill, { opacity: isVideoLoaded ? 1 : 0 }]}
                        resizeMode={ResizeMode.COVER}
                        isLooping
                        shouldPlay={true}
                        isMuted={true}
                        onLoad={() => setIsVideoLoaded(true)}
                    />
                )}

                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                    style={styles.imageGradient}
                />

                {isSelected && (
                    <View style={styles.selectedOverlay}>
                        <View style={styles.selectedCheckmark}>
                            <Ionicons name="checkmark-circle" size={32} color={brand[500]} />
                        </View>
                    </View>
                )}

                <View style={styles.characterInfoOverlay}>
                    <Text style={styles.characterNameText} numberOfLines={1}>
                        {character.name}
                    </Text>
                    {!isOwned && !isPro && character.tier !== 'free' && (
                        <View style={styles.lockedBadge}>
                            <Ionicons name="lock-closed" size={12} color="#fff" />
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
});

export const CharacterPreviewScreen: React.FC<CharacterPreviewScreenProps> = (props) => {
    const navigation = useNavigation<CharacterPreviewNavigationProp>();
    const route = useRoute<CharacterPreviewRouteProp>();
    const { setCurrentCharacterState } = useVRMContext();

    // Support both props (embedded mode) and route params (navigation mode)
    const rawCharacters = props.characters || route.params?.characters || [];

    // Filter to only show FREE characters per user request
    const characters = useMemo(() => {
        const filtered = rawCharacters.filter(c => c.tier === 'free');
        console.log(`[CharacterPreview] Filtering: ${filtered.length} free characters out of ${rawCharacters.length} total`);
        return filtered;
    }, [rawCharacters]);

    const isViewMode = props.isViewMode ?? route.params?.isViewMode ?? false;

    // Determine if this is onboarding flow (no ownedCharacterIds provided)
    const rawOwnedIds = props.ownedCharacterIds ?? route.params?.ownedCharacterIds;
    const isOnboardingFlow = rawOwnedIds === undefined || rawOwnedIds === null;
    const ownedCharacterIds = new Set(rawOwnedIds ?? []);
    const isPro = props.isPro ?? route.params?.isPro ?? false;

    const [selectedCharacter, setSelectedCharacter] = useState<CharacterItem | null>(null);
    const [isSelectingCharacter, setIsSelectingCharacter] = useState(false);
    const insets = useSafeAreaInsets();
    const { width: screenWidth } = useWindowDimensions();

    // Calculate grid item size (2 columns with padding)
    const numColumns = 2;
    const gridPadding = 24;
    const gridGap = 16;
    const itemWidth = (screenWidth - gridPadding * 2 - gridGap * (numColumns - 1)) / numColumns;

    // Reset loading state when screen gains focus
    useFocusEffect(
        useCallback(() => {
            setIsSelectingCharacter(false);
        }, [])
    );

    useEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    useEffect(() => {
        if (!selectedCharacter && characters.length > 0) {
            setSelectedCharacter(characters[0]);
        }
    }, [characters, selectedCharacter]);

    const handleCharacterPress = useCallback((character: CharacterItem) => {
        setSelectedCharacter(character);
    }, []);

    const handleContinue = useCallback(async () => {
        if (!selectedCharacter || isSelectingCharacter) return;

        setIsSelectingCharacter(true);
        try {
            if (isOnboardingFlow) {
                // Onboarding flow
                if (props.onSelect) {
                    await props.onSelect(selectedCharacter);
                } else {
                    navigation.navigate('OnboardingV2', { selectedCharacterId: selectedCharacter.id });
                }
            } else {
                // Regular selection flow
                const canSelect = ownedCharacterIds.has(selectedCharacter.id) || isPro || selectedCharacter.tier === 'free';

                if (!canSelect) {
                    // Show upgrade prompt
                    Alert.alert(
                        'Upgrade to Lusty Pro',
                        'Unlock all characters, costumes, and backgrounds with a Pro subscription.',
                        [
                            { text: 'Maybe Later', style: 'cancel' },
                            { text: 'Upgrade Now', onPress: () => navigation.goBack() },
                        ]
                    );
                    setIsSelectingCharacter(false);
                    return;
                }

                // Update global state directly
                setCurrentCharacterState(selectedCharacter);

                // Persist selection
                await UserCharacterPreferenceService.saveUserCharacterPreference(selectedCharacter.id, {});

                // Navigate back
                navigation.goBack();
            }
        } catch (error) {
            console.error('Error selecting character:', error);
            setIsSelectingCharacter(false);
        }
    }, [selectedCharacter, isSelectingCharacter, isOnboardingFlow, props, navigation, setCurrentCharacterState, ownedCharacterIds, isPro]);

    const showBackButton = isViewMode || !isOnboardingFlow;
    const isOwned = selectedCharacter ? ownedCharacterIds.has(selectedCharacter.id) : false;
    const canSelect = isOwned || isPro || selectedCharacter?.tier === 'free';

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <ScrollView
                contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Custom Header */}
                <View style={[styles.customHeader, { paddingTop: insets.top }]}>
                    <View style={styles.headerLeft}>
                        {showBackButton && (
                            <Button
                                onPress={() => navigation.goBack()}
                                variant="liquid"
                                startIconName="arrow-back"
                                iconColor="white"
                                isIconOnly
                                size="lg"
                            />
                        )}
                    </View>

                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>
                            {isOnboardingFlow ? 'Choose Your Character' : 'Characters'}
                        </Text>
                    </View>

                    <View style={styles.headerRight}>
                        {!isOnboardingFlow && (
                            <DiamondBadge size="md" />
                        )}
                    </View>
                </View>

                {/* Title for onboarding */}
                {isOnboardingFlow && (
                    <View style={styles.titleContainer}>
                        <Text style={styles.onboardingTitle}>Who do you want to be with?</Text>
                        <Text style={styles.onboardingSubtitle}>Select a character to continue</Text>
                    </View>
                )}

                {/* Character Grid */}
                <View style={styles.gridContainer}>
                    {characters.reduce((rows: CharacterItem[][], character, index) => {
                        if (index % numColumns === 0) rows.push([]);
                        rows[rows.length - 1].push(character);
                        return rows;
                    }, []).map((row, rowIndex) => (
                        <View key={rowIndex} style={styles.row}>
                            {row.map((character, colIndex) => (
                                <CharacterGridItem
                                    key={character.id}
                                    character={character}
                                    itemWidth={itemWidth}
                                    isSelected={selectedCharacter?.id === character.id}
                                    isOwned={ownedCharacterIds.has(character.id)}
                                    isPro={isPro}
                                    onPress={handleCharacterPress}
                                />
                            ))}
                            {/* Add empty placeholder if last row is incomplete */}
                            {row.length < numColumns && (
                                <View style={[styles.gridItem, { width: itemWidth, opacity: 0 }]} />
                            )}
                        </View>
                    ))}
                </View>

                {/* Character Details Section */}
                {selectedCharacter && (
                    <View style={styles.detailsContainer}>
                        {/* Character Name */}
                        <Text style={styles.detailsCharacterName}>
                            {selectedCharacter.name}
                        </Text>

                        {/* Profile Section */}
                        <View style={styles.profileSection}>
                            <Text style={styles.profileTitle}>Profile</Text>
                            <View style={styles.statsRow}>
                                {selectedCharacter.data?.height_cm && (
                                    <View style={styles.statItem}>
                                        <View style={styles.iconWrapper}>
                                            <MaterialCommunityIcons name="human-male" size={20} color="rgba(255,255,255,0.6)" />
                                        </View>
                                        <Text style={styles.statValue}>
                                            {selectedCharacter.data.height_cm} cm
                                        </Text>
                                    </View>
                                )}
                                {selectedCharacter.data?.old && (
                                    <View style={styles.statItem}>
                                        <View style={styles.iconWrapper}>
                                            <Ionicons name="information" size={18} color="rgba(255,255,255,0.6)" />
                                        </View>
                                        <Text style={styles.statValue}>
                                            {selectedCharacter.data.old} years old
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Backstory */}
                        {selectedCharacter.description && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Backstory</Text>
                                <Text style={styles.characterDescription}>
                                    {selectedCharacter.description}
                                </Text>
                            </View>
                        )}

                        {/* Characteristics */}
                        {selectedCharacter.data?.characteristics && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Personality</Text>
                                <Text style={styles.characteristicsText}>
                                    {selectedCharacter.data.characteristics}
                                </Text>
                            </View>
                        )}

                        {/* Hobbies */}
                        {selectedCharacter.data?.hobbies && selectedCharacter.data.hobbies.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Hobbies</Text>
                                <View style={styles.hobbiesContainer}>
                                    {selectedCharacter.data.hobbies.map((hobby: string, index: number) => (
                                        <View key={index} style={styles.hobbyTag}>
                                            <Text style={styles.hobbyText}>{hobby}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Continue Button - Fixed at bottom */}
            {selectedCharacter && (
                <View style={[styles.continueButtonContainer, { paddingBottom: insets.bottom + 16 }]}>
                    <TouchableOpacity
                        style={[styles.continueButton, isSelectingCharacter && styles.continueButtonDisabled]}
                        onPress={handleContinue}
                        disabled={isSelectingCharacter}
                    >
                        {isSelectingCharacter ? (
                            <ActivityIndicator size="small" color="#000" />
                        ) : (
                            <>
                                <Text style={styles.continueButtonText}>
                                    {isOnboardingFlow ? 'Continue' : (canSelect ? 'Select' : 'Get Premium')}
                                </Text>
                                {!isOnboardingFlow && !canSelect && (
                                    <DiamondIcon width={20} height={20} style={{ marginLeft: 8 }} />
                                )}
                            </>
                        )}
                    </TouchableOpacity>
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
    customHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: '#000',
    },
    headerLeft: {
        width: 60,
        alignItems: 'flex-start',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerRight: {
        width: 60,
        alignItems: 'flex-end',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    titleContainer: {
        paddingHorizontal: 24,
        paddingVertical: 20,
        backgroundColor: '#000',
    },
    onboardingTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    onboardingSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
    },
    gridContainer: {
        paddingHorizontal: 24,
        paddingTop: 12,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    gridItem: {
        aspectRatio: 0.75,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 3,
        borderColor: 'transparent',
    },
    gridItemSelected: {
        borderColor: brand[500],
    },
    imageContainer: {
        flex: 1,
        position: 'relative',
    },
    characterImage: {
        width: '100%',
        height: '100%',
    },
    imageGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '50%',
    },
    selectedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectedCheckmark: {
        borderRadius: 50,
        padding: 4,
    },
    characterInfoOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    characterNameText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        flex: 1,
    },
    lockedBadge: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 12,
        padding: 6,
    },
    // Details Container Styles (inline instead of bottom sheet)
    detailsContainer: {
        backgroundColor: 'rgba(30,30,30,0.95)',
        marginHorizontal: 24,
        marginTop: 24,
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
    },
    detailsImageContainer: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
    },
    detailsCharacterImage: {
        width: '100%',
        height: '100%',
    },
    detailsCharacterName: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 20,
    },
    // Bottom Sheet Styles
    sheetContent: {
        flex: 1,
    },
    sheetContentContainer: {
        paddingHorizontal: 24,
        paddingTop: 8,
    },
    sheetImageContainer: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
    },
    sheetCharacterImage: {
        width: '100%',
        height: '100%',
    },
    sheetHeader: {
        marginBottom: 16,
    },
    characterName: {
        fontSize: 28,
        fontWeight: '700',
        color: '#000',
        textAlign: 'center',
    },
    profileSection: {
        marginBottom: 20,
    },
    profileTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.6)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    statItem: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    iconWrapper: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 100,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    statValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.6)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    characterDescription: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.9)',
        lineHeight: 22,
    },
    characteristicsText: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.9)',
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
        color: brand[500],
        fontWeight: '500',
    },
    // Continue Button - Fixed at bottom
    continueButtonContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        paddingTop: 16,
        backgroundColor: 'rgba(0,0,0,0.95)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    continueButton: {
        backgroundColor: brand[500],
        borderRadius: 16,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: brand[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    continueButtonDisabled: {
        opacity: 0.5,
    },
    continueButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    // Button Styles
    sheetButtonContainer: {
        paddingHorizontal: 24,
        paddingTop: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
    },
    selectButton: {
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#000',
    },
    selectButtonDisabled: {
        opacity: 0.5,
    },
    selectButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000',
    },
    goProButton: {
        backgroundColor: brand[500],
        borderRadius: 16,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    goProButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});
