import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
    StatusBar,
    ScrollView,
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
import { IconWoman } from '@tabler/icons-react-native';

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


interface CharacterRowItemProps {
    character: CharacterItem;
    isSelected: boolean;
    isOwned: boolean;
    isPro: boolean;
    onPress: (character: CharacterItem) => void;
}

const CharacterRowItem = React.memo(({
    character,
    isSelected,
    isOwned,
    isPro,
    onPress
}: CharacterRowItemProps) => {
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const videoUrl = character.video_url;

    // Reset video loaded state if character changes
    useEffect(() => {
        setIsVideoLoaded(false);
    }, [character.id]);

    const showVideo = !!videoUrl;
    const isLocked = !isOwned && !isPro && character.tier !== 'free';

    return (
        <TouchableOpacity
            style={[
                styles.rowItem,
                isSelected && styles.rowItemSelected
            ]}
            onPress={() => onPress(character)}
            activeOpacity={0.7}
        >
            {/* Left: Image/Video */}
            <View style={styles.rowMediaContainer}>
                <Image
                    source={{ uri: character.thumbnail_url || character.avatar }}
                    style={[styles.rowImage, { opacity: (showVideo && isVideoLoaded) ? 0 : 1 }]}
                    contentFit="cover"
                    contentPosition="top center"
                    transition={200}
                />

                {showVideo && (
                    <Video
                        source={{ uri: videoUrl }}
                        style={[StyleSheet.absoluteFill, styles.rowVideo, { opacity: isVideoLoaded ? 1 : 0 }]}
                        resizeMode={ResizeMode.COVER}
                        isLooping
                        shouldPlay={true}
                        isMuted={true}
                        onLoad={() => setIsVideoLoaded(true)}
                    />
                )}

                {isSelected && (
                    <View style={styles.rowSelectedBadge}>
                        <Ionicons name="checkmark-circle" size={24} color={brand[500]} />
                    </View>
                )}

                {isLocked && (
                    <View style={styles.rowLockedOverlay}>
                        <Ionicons name="lock-closed" size={20} color="#fff" />
                    </View>
                )}
            </View>

            {/* Right: Character Info */}
            <View style={styles.rowInfoContainer}>
                <View style={styles.rowHeader}>
                    <Text style={styles.rowCharacterName}>
                        {character.name}
                    </Text>
                    {character.tier && character.tier !== 'free' && (
                        <View style={styles.rowTierBadge}>
                            <Text style={styles.rowTierText}>{character.tier.toUpperCase()}</Text>
                        </View>
                    )}

                    {/* Stats Inline */}
                    {character.data?.old && (
                        <View style={styles.rowStatItem}>
                            <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.6)" />
                            <Text style={styles.rowStatText}>{character.data.old} yrs</Text>
                        </View>
                    )}
                    {character.data?.height_cm && (
                        <View style={styles.rowStatItem}>
                            <MaterialCommunityIcons name="human-male-height" size={14} color="rgba(255,255,255,0.6)" />
                            <Text style={styles.rowStatText}>{character.data.height_cm} cm</Text>
                        </View>
                    )}
                    {character.data?.occupation && (
                        <View style={styles.rowStatItem}>
                            <Ionicons name="briefcase-outline" size={14} color="rgba(255,255,255,0.6)" />
                            <Text style={styles.rowStatText} numberOfLines={1}>{character.data.occupation}</Text>
                        </View>
                    )}
                    {character.data?.rounds && (
                        <View style={styles.rowStatItem}>
                            <IconWoman size={14} color={"rgba(255,255,255,0.6)"} />
                            <Text style={styles.rowStatText}>
                                {character.data.rounds.r1 ? character.data.rounds.r1 : '?'}-
                                {character.data.rounds.r2 ? character.data.rounds.r2 : '?'}-
                                {character.data.rounds.r3 ? character.data.rounds.r3 : '?'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Description */}
                {character.description && (
                    <Text style={styles.rowDescription} numberOfLines={2}>
                        {character.description}
                    </Text>
                )}

                {/* Hobbies Tags */}
                {character.data?.hobbies && character.data.hobbies.length > 0 && (
                    <View style={styles.rowHobbiesContainer}>
                        {character.data.hobbies.slice(0, 3).map((hobby: string, index: number) => (
                            <View key={index} style={styles.rowHobbyTag}>
                                <Text style={styles.rowHobbyText}>{hobby}</Text>
                            </View>
                        ))}
                        {character.data.hobbies.length > 3 && (
                            <Text style={styles.rowMoreHobbies}>+{character.data.hobbies.length - 3}</Text>
                        )}
                    </View>
                )}

                {/* Costumes Preview */}
                {character.costumes && character.costumes.length > 0 && (
                    <View style={styles.rowCostumesContainer}>
                        {character.costumes.slice(0, 4).map((costume) => (
                            costume.thumbnail ? (
                                <Image
                                    key={costume.id}
                                    source={{ uri: costume.thumbnail }}
                                    style={styles.rowCostumeImage}
                                    contentFit="cover"
                                />
                            ) : null
                        ))}
                        {character.costumes.length > 4 && (
                            <View style={styles.rowMoreCostumes}>
                                <Text style={styles.rowMoreCostumesText}>+{character.costumes.length - 4}</Text>
                            </View>
                        )}
                    </View>
                )}
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
                        'Upgrade to Evee Pro',
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

                    {/* <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>
                            {isOnboardingFlow ? 'Choose Your Character' : 'Characters'}
                        </Text>
                    </View> */}

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

                {/* Character List */}
                <View style={styles.listContainer}>
                    {characters.map((character) => (
                        <CharacterRowItem
                            key={character.id}
                            character={character}
                            isSelected={selectedCharacter?.id === character.id}
                            isOwned={ownedCharacterIds.has(character.id)}
                            isPro={isPro}
                            onPress={handleCharacterPress}
                        />
                    ))}
                </View>
            </ScrollView>

            {/* Continue Button - Fixed at bottom */}
            {selectedCharacter && (
                <View style={[styles.continueButtonContainer, { paddingBottom: insets.bottom }]}>
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
    // List container
    listContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    // Row item styles
    rowItem: {
        flexDirection: 'row',
        backgroundColor: 'rgba(30,30,30,0.8)',
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    rowItemSelected: {
        borderColor: brand[500],
    },
    rowMediaContainer: {
        width: 140,
        height: 190,
        position: 'relative',
    },
    rowImage: {
        width: '100%',
        height: '100%',
    },
    rowVideo: {
        borderRadius: 0,
    },
    rowSelectedBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 50,
        padding: 2,
    },
    rowLockedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowInfoContainer: {
        flex: 1,
        padding: 12,
        justifyContent: 'center',
    },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        flexWrap: 'wrap',
        gap: 8,
    },
    rowCharacterName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    rowTierBadge: {
        backgroundColor: brand[500] + '30',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        marginLeft: 8,
    },
    rowTierText: {
        fontSize: 10,
        fontWeight: '700',
        color: brand[500],
    },

    rowStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    rowStatText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
    },
    rowDescription: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
        lineHeight: 18,
        marginBottom: 6,
    },
    rowHobbiesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 4,
    },
    rowHobbyTag: {
        backgroundColor: brand[500] + '20',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    rowHobbyText: {
        fontSize: 11,
        color: brand[500],
        fontWeight: '500',
    },
    rowMoreHobbies: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        alignSelf: 'center',
    },
    // Costume styles
    rowCostumesContainer: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 8,
        alignItems: 'center',
    },
    rowCostumeImage: {
        width: 34,
        height: 34,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    rowMoreCostumes: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    rowMoreCostumesText: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '700',
    },
    // Legacy grid styles (can be removed later)
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
