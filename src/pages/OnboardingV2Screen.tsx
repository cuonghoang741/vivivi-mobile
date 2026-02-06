import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    Pressable,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Button from '../components/commons/Button';
import { LiquidGlass } from '../components/commons/LiquidGlass';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CharacterRepository, type CharacterItem } from '../repositories/CharacterRepository';
import AssetRepository from '../repositories/AssetRepository';
import { BackgroundRepository } from '../repositories/BackgroundRepository';
import { CurrencyRepository } from '../repositories/CurrencyRepository';
import { authManager } from '../services/AuthManager';
import { PersistKeys } from '../config/supabase';
// import { oneSignalService } from '../services/OneSignalService';
import { analyticsService } from '../services/AnalyticsService';
import { brand } from '../styles/palette';
import { telegramNotificationService } from '../services/TelegramNotificationService';
import { getTelegramUserInfo } from '../utils/telegramUserHelper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CharacterItem as CharacterItemType } from '../repositories/CharacterRepository';

type RootStackParamList = {
    Experience: undefined;
    CharacterPreview: { character: CharacterItemType };
};

type OnboardingNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OnboardingStep = 'age' | 'notification';

type Props = {
    onComplete: (data: {
        userName: string;
        userAge: number;
        selectedCharacterId: string;
        characterNickname: string;
    }) => void;
    selectedCharacterId: string;
};

export const OnboardingV2Screen: React.FC<Props> = ({ onComplete, selectedCharacterId }) => {
    const navigation = useNavigation<OnboardingNavigationProp>();
    const [currentStep, setCurrentStep] = useState<OnboardingStep>('age');
    const [userName, setUserName] = useState('Champion'); // Default name
    const [userAge, setUserAge] = useState('22');
    const [characterNickname, setCharacterNickname] = useState('');
    const [selectedCharacter, setSelectedCharacter] = useState<CharacterItem | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Animation values
    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const ageScrollRef = useRef<any>(null);

    const steps: OnboardingStep[] = ['age', 'notification'];
    const currentStepIndex = steps.indexOf(currentStep);

    useEffect(() => {
        loadSelectedCharacter();
        // Track onboarding start
        analyticsService.logOnboardingStart();
    }, [selectedCharacterId]);

    const loadSelectedCharacter = async () => {
        try {
            const characterRepo = new CharacterRepository();
            const character = await characterRepo.fetchCharacter(selectedCharacterId);
            if (character) {
                setSelectedCharacter(character);
                setCharacterNickname(character.name);
            }
        } catch (error: any) {
            console.error('[OnboardingV2] Failed to load character:', error);
        }
    };

    const animateToNextStep = (nextStep: OnboardingStep) => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: -SCREEN_WIDTH,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setCurrentStep(nextStep);
            slideAnim.setValue(SCREEN_WIDTH);
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        });
    };

    const animateToPrevStep = (prevStep: OnboardingStep) => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: SCREEN_WIDTH,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setCurrentStep(prevStep);
            slideAnim.setValue(-SCREEN_WIDTH);
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        });
    };

    const handleContinue = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });

        switch (currentStep) {
            case 'age':
                const age = parseInt(userAge, 10);
                if (isNaN(age) || age < 18 || age > 120) {
                    Alert.alert('Invalid age', 'Please enter a valid age (18-120).');
                    return;
                }
                analyticsService.logOnboardingStep('age', 1);
                animateToNextStep('notification');
                break;

            case 'notification':
                await completeOnboarding();
                break;
        }
    }, [currentStep, userAge, selectedCharacterId]);

    const handleBack = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });

        // If on first step, go back to character selection
        if (currentStepIndex === 0) {
            navigation.goBack();
            return;
        }

        const prevIndex = currentStepIndex - 1;
        if (prevIndex >= 0) {
            animateToPrevStep(steps[prevIndex]);
        }
    }, [currentStepIndex, navigation]);

    // const requestNotificationPermission = async (): Promise<boolean> => {
    //     try {
    //         // Use OneSignal to request notification permission
    //         const granted = await oneSignalService.requestPermission();
    //         return granted;
    //     } catch (error) {
    //         console.warn('[OnboardingV2] Could not request permission:', error);
    //         return false;
    //     }
    // };

    const handleEnableNotifications = async () => {
        // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        // // const granted = await requestNotificationPermission();
        // // Track notification permission result
        // analyticsService.logNotificationPermission(granted);
        // if (granted) {
        //     await AsyncStorage.setItem('settings.notificationsEnabled', 'true');
        // }
        // await completeOnboarding();
    };

    const completeOnboarding = async () => {
        if (isSaving || !selectedCharacterId) return;
        setIsSaving(true);

        try {
            // Save user display name
            await authManager.updateDisplayName(userName.trim());

            // Save birth year from age
            const currentYear = new Date().getFullYear();
            const birthYear = currentYear - parseInt(userAge, 10);
            await authManager.updateBirthYear(birthYear);

            // Own the selected character
            const assetRepo = new AssetRepository();
            await assetRepo.createAsset(selectedCharacterId, 'character');

            // Get character to find default costume
            const characterRepo = new CharacterRepository();
            const character = await characterRepo.fetchCharacter(selectedCharacterId);

            // Gift default costume if available
            if (character?.default_costume_id) {
                try {
                    await assetRepo.createAsset(character.default_costume_id, 'character_costume');
                } catch (err) {
                    console.warn('[OnboardingV2] Could not add default costume:', err);
                }
            }

            // Gift 3 free backgrounds
            try {
                const backgroundRepo = new BackgroundRepository();
                const backgrounds = await backgroundRepo.fetchAllBackgrounds();
                const freeBackgrounds = backgrounds.filter((b) => b.available && b.tier === 'free').slice(0, 3);
                for (const bg of freeBackgrounds) {
                    try {
                        await assetRepo.createAsset(bg.id, 'background');
                    } catch (err) {
                        console.warn('[OnboardingV2] Could not gift background:', err);
                    }
                }
            } catch (err) {
                console.warn('[OnboardingV2] Could not load backgrounds:', err);
            }

            // Gift currency: 10,000 VCoin + 100 Ruby
            try {
                const currencyRepo = new CurrencyRepository();
                const currentCurrency = await currencyRepo.fetchCurrency();
                await currencyRepo.updateCurrency(currentCurrency.vcoin + 10000, currentCurrency.ruby + 100);
            } catch (err) {
                console.warn('[OnboardingV2] Could not gift currency:', err);
            }

            // Save character nickname to user preferences or character data
            await AsyncStorage.setItem(`character.nickname.${selectedCharacterId}`, characterNickname.trim());

            // Mark onboarding V2 as completed
            await AsyncStorage.setItem(PersistKeys.hasCompletedOnboardingV2, 'true');

            // Track onboarding complete
            analyticsService.logOnboardingComplete(selectedCharacterId);

            // Send Telegram notification for new user (fire-and-forget)
            getTelegramUserInfo().then(userInfo => {
                telegramNotificationService.notifyNewUser({
                    ...userInfo,
                    userName: userName.trim(),
                    userAge: parseInt(userAge, 10),
                });
            }).catch(err => console.warn('[OnboardingV2] Failed to send Telegram notification:', err));

            onComplete({
                userName: userName.trim(),
                userAge: parseInt(userAge, 10),
                selectedCharacterId,
                characterNickname: characterNickname.trim(),
            });
        } catch (error: any) {
            console.error('[OnboardingV2] Failed to complete onboarding:', error);
            Alert.alert('Error', error.message || 'Failed to save your preferences. Please try again.');
            setIsSaving(false);
        }
    };

    const canContinue = () => {
        switch (currentStep) {
            case 'age':
                const age = parseInt(userAge, 10);
                return !isNaN(age) && age >= 18 && age <= 120;
            case 'notification':
                return true;
            default:
                return false;
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 'age':
                return renderAgeStep();
            case 'notification':
                return renderNotificationStep();
            default:
                return null;
        }
    };

    const renderWelcomeStep = () => {
        return (
            <View style={styles.stepContent}>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>
                        Hey there, <Text style={styles.titleHighlight}>Champion!</Text>
                    </Text>
                    <Text style={styles.subtitle}>
                        Let's personalize your experience together
                    </Text>
                </View>

                {/* Character preview */}
                {selectedCharacter && (
                    <View style={styles.welcomeCharacterContainer}>
                        <View style={styles.welcomeCharacterCircle}>
                            {selectedCharacter.avatar || selectedCharacter.thumbnail_url ? (
                                <Image
                                    source={{ uri: selectedCharacter.avatar || selectedCharacter.thumbnail_url }}
                                    style={styles.welcomeCharacterImage}
                                />
                            ) : (
                                <Ionicons name="person" size={60} color="rgba(255,255,255,0.5)" />
                            )}
                        </View>
                        <Text style={styles.welcomeCharacterName}>{selectedCharacter.name}</Text>
                        <Text style={styles.welcomeCharacterDescription}>
                            {selectedCharacter.description || 'Your new companion awaits!'}
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    const renderAgeStep = () => {
        const ages = Array.from({ length: 43 }, (_, i) => 18 + i); // 18-60
        const selectedAge = parseInt(userAge, 10) || 18;
        const ITEM_HEIGHT = 60;

        const handleScroll = (event: any) => {
            const offsetY = event.nativeEvent.contentOffset.y;
            const index = Math.round(offsetY / ITEM_HEIGHT);
            const newAge = ages[Math.min(Math.max(index, 0), ages.length - 1)];
            if (newAge !== selectedAge) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                setUserAge(newAge.toString());
            }
        };

        return (
            <View style={styles.stepContent}>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>
                        How old are you, <Text style={styles.titleHighlight}>Champion?</Text>
                    </Text>
                    <Text style={styles.subtitle}>This helps us customize your experience!</Text>
                </View>

                <View style={styles.agePickerWrapper}>
                    <ScrollView
                        ref={ageScrollRef}
                        showsVerticalScrollIndicator={false}
                        snapToInterval={ITEM_HEIGHT}
                        decelerationRate="fast"
                        onMomentumScrollEnd={handleScroll}
                        contentContainerStyle={{
                            paddingVertical: 120, // (300 - 60) / 2
                        }}
                    >
                        {ages.map((age, index) => {
                            const isSelected = age === selectedAge;

                            if (isSelected) {
                                return (
                                    <LiquidGlass
                                        key={age}
                                        pressable={true}
                                        onPress={() => {
                                            ageScrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
                                        }}
                                        style={[styles.ageScrollItemSelected, { height: ITEM_HEIGHT }]}
                                    >
                                        <Text style={styles.ageScrollTextSelected}>{age}</Text>
                                    </LiquidGlass>
                                );
                            }

                            return (
                                <Pressable
                                    key={age}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                                        setUserAge(age.toString());
                                        ageScrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
                                    }}
                                    style={[styles.ageScrollItem, { height: ITEM_HEIGHT }]}
                                >
                                    <Text style={styles.ageScrollText}>{age}</Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>
            </View>
        );
    };

    const renderNotificationStep = () => {
        return (
            <View style={styles.notificationStepContent}>
                {/* Bell icon */}
                <View style={styles.notificationIconContainer}>
                    <View style={styles.notificationIconCircle}>
                        <Ionicons name="notifications" size={32} color="#fff" />
                    </View>
                </View>

                {/* Title and subtitle */}
                <View style={styles.notificationTitleContainer}>
                    <Text style={styles.notificationTitle}>Stay Connected</Text>
                    <Text style={styles.notificationSubtitle}>
                        Enable notifications to never miss important updates,{'\n'}messages, and exclusive content.
                    </Text>
                </View>

                {/* Notification mockup image */}
                <View style={styles.notificationMockupContainer}>
                    <Image
                        source={{ uri: 'https://d1j8r0kxyu9tj8.cloudfront.net/files/OcczlXBnm3QrCaEgE11YqnUR0GW1yC01kUNREksc.png' }}
                        style={styles.notificationMockupImage}
                        resizeMode="contain"
                    />
                </View>

            </View>
        );
    };

    // 3 dots: CharacterPreview (always completed) + age + notification
    const allDots = ['preview', ...steps]; // ['preview', 'age', 'notification']
    const effectiveIndex = currentStepIndex + 1; // +1 because preview is always completed

    const renderProgressDots = () => (
        <View style={styles.progressDots}>
            {allDots.map((step, index) => (
                <View
                    key={step}
                    style={[
                        styles.dot,
                        index === effectiveIndex && styles.dotActive,
                        index < effectiveIndex && styles.dotCompleted,
                    ]}
                />
            ))}
        </View>
    );

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
                <KeyboardAvoidingView
                    style={styles.keyboardView}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {/* Header with back button and Later for notification */}
                    <View style={styles.header}>
                        {/* Always show back button - first step goes back to character selection */}
                        <Button
                            variant="liquid"
                            size="lg"
                            startIconName="chevron-back"
                            onPress={handleBack}
                            isIconOnly
                        />
                        {false && (
                            <View style={{ width: 40 }} />
                        )}
                        <View style={{ flex: 1 }} />
                        {currentStep === 'notification' && (
                            <TouchableOpacity onPress={completeOnboarding} disabled={isSaving}>
                                <Text style={styles.headerLaterText}>Later</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Animated content */}
                    <Animated.View
                        style={[
                            styles.contentContainer,
                            {
                                transform: [{ translateX: slideAnim }],
                                opacity: fadeAnim,
                            },
                        ]}
                    >
                        {renderStepContent()}
                    </Animated.View>

                    {/* Progress dots - fixed position */}
                    {renderProgressDots()}

                    {/* Continue button */}
                    <View style={styles.bottomContainer}>
                        <TouchableOpacity
                            style={[
                                styles.continueButton,
                                !canContinue() && styles.continueButtonDisabled,
                            ]}
                            onPress={currentStep === 'notification' ? handleEnableNotifications : handleContinue}
                            disabled={!canContinue() || isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <Text style={styles.continueButtonText}>
                                    {currentStep === 'notification' ? 'Enable Notifications' : 'Continue'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    safeArea: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    header: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    headerLaterText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 16,
        fontWeight: '500',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: 24,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
    },
    stepContent: {
        flex: 1,
        justifyContent: 'flex-start',
        paddingTop: 40,
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: 48,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 12,
    },
    titleHighlight: {
        color: brand[500],
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
    },
    inputContainer: {
        alignItems: 'center',
    },
    textInput: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 999,
        paddingHorizontal: 24,
        paddingVertical: 18,
        fontSize: 18,
        color: '#fff',
        textAlign: 'center',
    },
    agePickerContainer: {
        alignItems: 'center',
        gap: 8,
    },
    ageOption: {
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 100,
    },
    ageOptionText: {
        fontSize: 22,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '500',
    },
    ageOptionSelected: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 25,
        paddingHorizontal: 40,
        paddingVertical: 12,
        minWidth: 120,
        alignItems: 'center',
    },
    ageOptionTextSelected: {
        fontSize: 24,
        color: '#fff',
        fontWeight: '600',
    },
    // Scrollable age picker styles
    agePickerWrapper: {
        height: 300,
        overflow: 'hidden',
        position: 'relative',
    },
    ageHighlightBar: {
        position: 'absolute',
        top: 120, // (300 - 60) / 2
        left: 0,
        right: 0,
        height: 60,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 30,
        marginHorizontal: 80,
        zIndex: 0,
    },
    ageScrollItem: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    ageScrollItemSelected: {
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 60,
        borderRadius: 30,
    },
    ageScrollText: {
        fontSize: 22,
        color: 'rgba(255,255,255,0.4)',
        fontWeight: '500',
    },
    ageScrollTextSelected: {
        fontSize: 26,
        color: '#fff',
        fontWeight: '600',
    },
    characterRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 24,
        paddingHorizontal: 8,
    },
    characterCell: {
        alignItems: 'center',
        gap: 8,
        width: '33%',
    },
    characterCircleWrapper: {
        position: 'relative',
    },
    previewIconButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: brand[500],
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#000',
    },
    characterCircle: {
        width: 120,
        height: 120,
        borderRadius: 10000,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'transparent',
        overflow: 'hidden',
    },
    characterCircleSelected: {
        borderColor: brand[500],
        backgroundColor: 'rgba(255,87,154,0.15)',
    },
    characterCircleImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
        borderRadius: 10000,
    },
    characterLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '600',
        fontSize: 14,
    },
    characterLabelSelected: {
        color: brand[500],
    },
    descriptionCard: {
        padding: 16,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginTop: 8,
    },
    descriptionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
    },
    descriptionText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        lineHeight: 20,
    },
    characterPreview: {
        alignItems: 'center',
        marginTop: 32,
    },
    characterPreviewImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: brand[500],
    },
    notificationIconContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    notificationIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(80,80,80,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    notifyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        backgroundColor: brand[500],
        paddingVertical: 18,
        paddingHorizontal: 32,
        borderRadius: 999,
        marginBottom: 16,
    },
    notifyButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    skipNotifyButton: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    skipNotifyText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 16,
    },
    // New notification step styles
    titleWhite: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitleMultiline: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        lineHeight: 24,
    },
    notificationAvatarContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    notificationAvatarCircle: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    notificationAvatarImage: {
        width: '100%',
        height: '100%',
    },
    notificationButtonsContainer: {
        paddingBottom: 20,
    },
    notifyButtonWhite: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        paddingVertical: 18,
        paddingHorizontal: 32,
        borderRadius: 999,
        marginBottom: 16,
    },
    notifyButtonTextBlack: {
        color: '#000',
        fontSize: 18,
        fontWeight: '600',
    },
    laterButton: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    laterButtonText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 16,
    },
    // New notification step design styles
    notificationStepContent: {
        flex: 1,
        paddingTop: 20,
    },
    notificationTitleContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    notificationTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 12,
    },
    notificationSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        lineHeight: 22,
    },
    notificationMockupContainer: {
        flex: 1,
        marginHorizontal: -24,
    },
    notificationMockupImage: {
        width: '100%',
        height: '100%',
    },
    notificationButtonContainer: {
        paddingTop: 20,
        paddingBottom: 10,
    },
    notificationButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        paddingVertical: 18,
        borderRadius: 999,
    },
    notificationButtonText: {
        color: '#000',
        fontSize: 18,
        fontWeight: '600',
    },
    progressDots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    dotActive: {
        width: 24,
        backgroundColor: brand[500],
    },
    dotCompleted: {
        backgroundColor: 'rgba(255,87,154,0.5)',
    },
    bottomContainer: {
        paddingHorizontal: 24,
    },
    continueButton: {
        backgroundColor: '#fff',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    continueButtonDisabled: {
        opacity: 0.5,
    },
    continueButtonText: {
        color: '#000',
        fontSize: 18,
        fontWeight: '700',
    },
    // Welcome step styles
    welcomeCharacterContainer: {
        alignItems: 'center',
        marginTop: 40,
    },
    welcomeCharacterCircle: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 3,
        borderColor: brand[500],
    },
    welcomeCharacterImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    welcomeCharacterName: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginTop: 20,
        textAlign: 'center',
    },
    welcomeCharacterDescription: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 20,
        lineHeight: 22,
    },
});
