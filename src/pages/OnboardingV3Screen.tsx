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
    Keyboard,
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
import { oneSignalService } from '../services/OneSignalService';
import { analyticsService } from '../services/AnalyticsService';
import { brand } from '../styles/palette';
import { telegramNotificationService } from '../services/TelegramNotificationService';
import { getTelegramUserInfo } from '../utils/telegramUserHelper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OnboardingStep = 'name' | 'age' | 'hobbies' | 'personality' | 'notification' | 'analyzing' | 'reveal';

type Props = {
    onComplete: (data: {
        userName: string;
        userAge: number;
        userOccupation: string;
        userHobbies: string;
        userPersonality: string;
        selectedCharacterId: string;
    }) => void;
};

export const OnboardingV3Screen: React.FC<Props> = ({ onComplete }) => {
    const [currentStep, setCurrentStep] = useState<OnboardingStep>('name');

    // Form State
    const [userName, setUserName] = useState('');
    const [userAge, setUserAge] = useState('22');
    const [hobbies, setHobbies] = useState('');
    const [personality, setPersonality] = useState('');

    // Logic State
    const [selectedCharacter, setSelectedCharacter] = useState<CharacterItem | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Animation values
    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const ageScrollRef = useRef<any>(null);

    const steps: OnboardingStep[] = ['name', 'age', 'hobbies', 'personality', 'notification'];
    const currentStepIndex = steps.indexOf(currentStep);

    useEffect(() => {
        analyticsService.logOnboardingStart();
    }, []);

    // Scroll to default age (22) when entering age step
    useEffect(() => {
        if (currentStep === 'age') {
            const age = parseInt(userAge, 10);
            const index = age - 18; // Assuming start at 18
            const ITEM_HEIGHT = 60;
            // Timeout to allow layout to settle
            setTimeout(() => {
                ageScrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
            }, 100);
        }
    }, [currentStep]);

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
        Keyboard.dismiss();

        // Flow - validations skipped as per requirement
        switch (currentStep) {
            case 'name':
                animateToNextStep('age');
                break;

            case 'age':
                // Age usually has a default '22', but ensure it's valid if tailored
                animateToNextStep('hobbies');
                break;

            case 'hobbies':
                animateToNextStep('personality');
                break;

            case 'personality':
                animateToNextStep('notification');
                break;

            case 'notification':
                // When notification step is done, we start analysis
                startAnalysis();
                break;
        }
    }, [currentStep, userName, userAge, hobbies, personality]);

    const handleBack = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        Keyboard.dismiss();

        // If analyzing or reveal, maybe prevent back? Or allow?
        if (currentStep === 'analyzing' || currentStep === 'reveal') return;

        if (currentStepIndex > 0) {
            const prevStep = steps[currentStepIndex - 1];
            animateToPrevStep(prevStep);
        }
    }, [currentStepIndex, currentStep, steps]);

    const handleEnableNotifications = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        const granted = await requestNotificationPermission();
        analyticsService.logNotificationPermission(granted);
        if (granted) {
            await AsyncStorage.setItem('settings.notificationsEnabled', 'true');
        }
        startAnalysis();
    };

    const requestNotificationPermission = async (): Promise<boolean> => {
        try {
            const granted = await oneSignalService.requestPermission();
            return granted;
        } catch (error) {
            console.warn('[OnboardingV3] Could not request permission:', error);
            return false;
        }
    };

    const startAnalysis = async () => {
        setCurrentStep('analyzing');
        setIsAnalyzing(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        try {
            const characterRepo = new CharacterRepository();
            // Fetch only free characters as requested
            const freeCharacters = await characterRepo.fetchFreeCharacters();

            // Filter by availability just in case, though fetchFreeCharacters usually handles tier/availability logic
            const availableChars = freeCharacters.filter(c => c.available);

            if (availableChars.length === 0) {
                Alert.alert('Error', 'No characters available.');
                setIsAnalyzing(false);
                return;
            }

            // Random selection from free characters
            const randomChar = availableChars[Math.floor(Math.random() * availableChars.length)];

            setSelectedCharacter(randomChar);
            setIsAnalyzing(false);
            setCurrentStep('reveal');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        } catch (error) {
            console.error('Failed to match', error);
            setIsAnalyzing(false);
            Alert.alert('Error', 'Failed to find a match.');
        }
    };

    const handleFinish = async () => {
        if (!selectedCharacter || isSaving) return;
        setIsSaving(true);
        try {
            // Save data sequence
            await authManager.updateDisplayName(userName.trim());
            const birthYear = new Date().getFullYear() - parseInt(userAge, 10);
            await authManager.updateBirthYear(birthYear);

            // Asset owning
            const assetRepo = new AssetRepository();
            await assetRepo.createAsset(selectedCharacter.id, 'character');

            // Default costume
            if (selectedCharacter.default_costume_id) {
                try { await assetRepo.createAsset(selectedCharacter.default_costume_id, 'character_costume'); } catch { }
            }

            // Gifts
            const backgroundRepo = new BackgroundRepository();
            const backgrounds = await backgroundRepo.fetchAllBackgrounds();
            const freeBackgrounds = backgrounds.filter((b) => b.available && b.tier === 'free').slice(0, 3);
            for (const bg of freeBackgrounds) {
                try { await assetRepo.createAsset(bg.id, 'background'); } catch { }
            }

            const currencyRepo = new CurrencyRepository();
            const currentCurrency = await currencyRepo.fetchCurrency();
            await currencyRepo.updateCurrency(currentCurrency.vcoin + 10000, currentCurrency.ruby + 100);

            // Persist
            await AsyncStorage.setItem(`character.nickname.${selectedCharacter.id}`, selectedCharacter.name);
            const userProfile = { occupation: '', hobbies: hobbies.trim(), personality: personality.trim() };
            await AsyncStorage.setItem('user.profile', JSON.stringify(userProfile));
            await AsyncStorage.setItem(PersistKeys.hasCompletedOnboardingV2, 'true');

            analyticsService.logOnboardingComplete(selectedCharacter.id);

            // Telegram
            getTelegramUserInfo().then(userInfo => {
                telegramNotificationService.notifyNewUser({
                    ...userInfo,
                    userName: userName.trim(),
                    userAge: userAge.toString(),
                });
            }).catch(err => console.warn('[OnboardingV3] Failed to send Telegram notification:', err));

            onComplete({
                userName: userName.trim(),
                userAge: parseInt(userAge, 10),
                userOccupation: '',
                userHobbies: hobbies.trim(),
                userPersonality: personality.trim(),
                selectedCharacterId: selectedCharacter.id,
            });

        } catch (error: any) {
            console.error(error);
            Alert.alert('Error', 'Failed to complete setup.');
            setIsSaving(false);
        }
    };

    // Render Steps

    // 1. Name
    const renderNameStep = () => (
        <View style={styles.stepContent}>
            <View style={styles.titleContainer}>
                <Text style={styles.title}>What should we call you?</Text>
                <Text style={styles.subtitle}>Your companion wants to know you better</Text>
            </View>
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.textInput}
                    value={userName}
                    onChangeText={setUserName}
                    placeholder="Your Name"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoFocus
                    returnKeyType="next"
                    onSubmitEditing={handleContinue}
                />
            </View>
        </View>
    );

    // 2. Age (Reusable V2 picker)
    const renderAgeStep = () => {
        const ages = Array.from({ length: 43 }, (_, i) => 18 + i);
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
                    <Text style={styles.title}>How old are you?</Text>
                    <Text style={styles.subtitle}>We use this to personalize your experience</Text>
                </View>
                <View style={styles.agePickerWrapper}>
                    <ScrollView
                        ref={ageScrollRef}
                        showsVerticalScrollIndicator={false}
                        snapToInterval={ITEM_HEIGHT}
                        decelerationRate="fast"
                        onMomentumScrollEnd={handleScroll}
                        contentContainerStyle={{ paddingVertical: 120 }}
                    >
                        {ages.map((age, index) => {
                            const isSelected = age === selectedAge;
                            if (isSelected) {
                                return (
                                    <LiquidGlass key={age} pressable onPress={() => ageScrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true })} style={[styles.ageScrollItemSelected, { height: ITEM_HEIGHT }]}>
                                        <Text style={styles.ageScrollTextSelected}>{age}</Text>
                                    </LiquidGlass>
                                );
                            }
                            return (
                                <Pressable key={age} onPress={() => {
                                    setUserAge(age.toString());
                                    ageScrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
                                }} style={[styles.ageScrollItem, { height: ITEM_HEIGHT }]}>
                                    <Text style={styles.ageScrollText}>{age}</Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>
            </View>
        );
    };



    // 4. Hobbies
    const renderHobbiesStep = () => (
        <View style={styles.stepContent}>
            <View style={styles.titleContainer}>
                <Text style={styles.title}>What are your hobbies?</Text>
                <Text style={styles.subtitle}>Gaming, Music, Travel...</Text>
            </View>
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.textInput}
                    value={hobbies}
                    onChangeText={setHobbies}
                    placeholder="Tell us what you love..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoFocus
                    returnKeyType="next"
                    onSubmitEditing={handleContinue}
                />
            </View>
        </View>
    );

    // 5. Personality
    const renderPersonalityStep = () => (
        <View style={styles.stepContent}>
            <View style={styles.titleContainer}>
                <Text style={styles.title}>Describe yourself</Text>
                <Text style={styles.subtitle}>Are you introverted, adventurous, chill?</Text>
            </View>
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.textInput}
                    value={personality}
                    onChangeText={setPersonality}
                    placeholder="I am..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoFocus
                    returnKeyType="next"
                    onSubmitEditing={handleContinue}
                />
            </View>
        </View>
    );

    // 6. Notification (Reuse V2 UI)
    const renderNotificationStep = () => (
        <View style={styles.notificationStepContent}>
            <View style={styles.notificationIconContainer}>
                <View style={styles.notificationIconCircle}>
                    <Ionicons name="notifications" size={32} color="#fff" />
                </View>
            </View>
            <View style={styles.notificationTitleContainer}>
                <Text style={styles.notificationTitle}>Stay Connected</Text>
                <Text style={styles.notificationSubtitle}>
                    Enable notifications to never miss a message from your match.
                </Text>
            </View>
            <View style={styles.notificationMockupContainer}>
                <Image
                    source={{ uri: 'https://d1j8r0kxyu9tj8.cloudfront.net/files/OcczlXBnm3QrCaEgE11YqnUR0GW1yC01kUNREksc.png' }}
                    style={styles.notificationMockupImage}
                    resizeMode="contain"
                />
            </View>
        </View>
    );

    // ANALYZING STATE
    if (currentStep === 'analyzing') {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={brand[500]} />
                <Text style={styles.analyzingText}>Analyzing your profile...</Text>
                <Text style={styles.subText}>Finding your soulmate</Text>
            </View>
        );
    }

    // REVEAL STATE
    if (currentStep === 'reveal' && selectedCharacter) {
        return (
            <View style={styles.matchContainer}>
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)', '#000']} style={StyleSheet.absoluteFill} />
                <Image
                    source={{ uri: selectedCharacter.thumbnail_url || selectedCharacter.avatar }}
                    style={styles.matchImageBg}
                    blurRadius={20}
                    resizeMode="cover"
                />

                <SafeAreaView style={styles.matchContent}>
                    <Text style={styles.matchTitle}>It's a Match!</Text>
                    <View style={styles.characterCard}>
                        <View style={styles.avatarContainer}>
                            <Image
                                source={{ uri: selectedCharacter.avatar || selectedCharacter.thumbnail_url }}
                                style={styles.avatar}
                                resizeMode="cover"
                            />
                        </View>
                        <Text style={styles.charName}>{selectedCharacter.name}</Text>
                        <Text style={styles.charDesc}>{selectedCharacter.description}</Text>

                        {/* Stats Section */}
                        <View style={styles.statsContainer}>
                            {/* Height */}
                            {!!selectedCharacter.data?.height_cm && (
                                <View style={styles.statItem}>
                                    <View style={styles.statIconContainer}>
                                        <Ionicons name="resize-outline" size={18} color={brand[500]} />
                                    </View>
                                    <View>
                                        <Text style={styles.statValue}>{selectedCharacter.data.height_cm}cm</Text>
                                        <Text style={styles.statLabel}>Height</Text>
                                    </View>
                                </View>
                            )}

                            {/* Measurements */}
                            {selectedCharacter.data?.rounds && (
                                <View style={styles.statItem}>
                                    <View style={styles.statIconContainer}>
                                        <Ionicons name="body-outline" size={18} color={brand[500]} />
                                    </View>
                                    <View>
                                        <Text style={styles.statValue}>
                                            {selectedCharacter.data.rounds.r1 || '?'}-
                                            {selectedCharacter.data.rounds.r2 || '?'}-
                                            {selectedCharacter.data.rounds.r3 || '?'}
                                        </Text>
                                        <Text style={styles.statLabel}>Measurements</Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Hobbies/Interests */}
                        {selectedCharacter.data?.hobbies && selectedCharacter.data.hobbies.length > 0 && (
                            <View style={styles.interestsContainer}>
                                <Text style={styles.interestsTitle}>Interests</Text>
                                <View style={styles.tagsContainer}>
                                    {selectedCharacter.data.hobbies.map((hobby, index) => (
                                        <View key={index} style={styles.hobbyTag}>
                                            <Text style={styles.hobbyText}>{hobby}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                    <Button
                        onPress={handleFinish}
                        disabled={isSaving}
                        fullWidth
                        variant='solid'
                        size="xl"
                    >
                        {isSaving ? "Starting..." : "Start Chatting"}
                    </Button>
                </SafeAreaView>
            </View>
        );
    }

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 'name': return renderNameStep();
            case 'age': return renderAgeStep();
            case 'hobbies': return renderHobbiesStep();
            case 'personality': return renderPersonalityStep();
            case 'notification': return renderNotificationStep();
            default: return null;
        }
    };

    const canContinue = () => true;

    // Progress Dots
    const renderProgressDots = () => (
        <View style={styles.progressDots}>
            {steps.map((s, index) => (
                <View
                    key={s}
                    style={[
                        styles.dot,
                        index === currentStepIndex && styles.dotActive,
                        index < currentStepIndex && styles.dotCompleted,
                    ]}
                />
            ))}
        </View>
    );

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

                    {/* Header */}
                    <View style={styles.header}>
                        {currentStepIndex > 0 && (
                            <Button variant="liquid" size="lg" startIconName="chevron-back" onPress={handleBack} isIconOnly />
                        )}
                        <View style={{ flex: 1 }} />
                        {currentStep === 'notification' && (
                            <TouchableOpacity onPress={handleContinue}>
                                <Text style={styles.headerLaterText}>Later</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Main Content */}
                    <Animated.View style={[styles.contentContainer, { transform: [{ translateX: slideAnim }], opacity: fadeAnim }]}>
                        {renderCurrentStep()}
                    </Animated.View>

                    {/* Dots */}
                    {renderProgressDots()}

                    {/* Continue Button */}
                    <View style={styles.bottomContainer}>
                        <TouchableOpacity
                            style={[styles.continueButton, !canContinue() && styles.continueButtonDisabled]}
                            onPress={currentStep === 'notification' ? handleEnableNotifications : handleContinue}
                            disabled={!canContinue()}
                        >
                            <Text style={styles.continueButtonText}>
                                {currentStep === 'notification' ? 'Find My Soulmate' : 'Continue'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

// Styles reused from OnboardingV2 (plus match reveal styles)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    safeArea: { flex: 1 },
    header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
    headerLaterText: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '500' },
    contentContainer: { flex: 1, paddingHorizontal: 24 },
    stepContent: { flex: 1, paddingTop: 40 },
    titleContainer: { alignItems: 'center', marginBottom: 48 },
    title: { fontSize: 28, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 12 },
    subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
    inputContainer: { alignItems: 'center' },
    textInput: { width: '100%', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingHorizontal: 24, paddingVertical: 18, fontSize: 18, color: '#fff', textAlign: 'center' },
    multilineInputContainer: { width: '100%', minHeight: 120, borderRadius: 24, padding: 4 },
    multilineInput: { flex: 1, padding: 20, fontSize: 16, color: '#fff' },

    // Bottom Controls
    bottomContainer: { padding: 24, paddingBottom: 12 },
    continueButton: { backgroundColor: brand[500], paddingVertical: 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    continueButtonDisabled: { opacity: 0.5, backgroundColor: 'rgba(255,255,255,0.2)' },
    continueButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },

    // Age Picker
    agePickerWrapper: { height: 300, overflow: 'hidden', position: 'relative' },
    ageScrollItem: { justifyContent: 'center', alignItems: 'center' },
    ageScrollItemSelected: { justifyContent: 'center', alignItems: 'center', marginHorizontal: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.15)' },
    ageScrollText: { fontSize: 22, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
    ageScrollTextSelected: { fontSize: 26, color: '#fff', fontWeight: '600' },

    // Progress Dots
    progressDots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 20 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
    dotActive: { backgroundColor: brand[500], width: 24 },
    dotCompleted: { backgroundColor: brand[500] },

    // Notification
    notificationStepContent: { flex: 1, alignItems: 'center', paddingTop: 40 },
    notificationIconContainer: { marginBottom: 16, alignItems: 'center' },
    notificationIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(80,80,80,0.8)', justifyContent: 'center', alignItems: 'center' },
    notificationTitleContainer: { marginBottom: 32, alignItems: 'center' },
    notificationTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8 },
    notificationSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
    notificationMockupContainer: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
    notificationMockupImage: { width: '80%', height: '80%', opacity: 0.9 },

    // Analyzing
    centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
    analyzingText: { marginTop: 24, fontSize: 20, color: '#fff', fontWeight: '600' },
    subText: { marginTop: 8, fontSize: 16, color: 'rgba(255,255,255,0.5)' },

    // Match Reveal
    matchContainer: { flex: 1, backgroundColor: '#000' },
    matchImageBg: { ...StyleSheet.absoluteFillObject, opacity: 0.4 },
    matchContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    matchTitle: { fontSize: 32, fontWeight: 'bold', color: brand[500], marginBottom: 32, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
    characterCard: { alignItems: 'center', marginBottom: 40, width: '100%' },
    avatarContainer: { width: 180, height: 180, borderRadius: 90, borderWidth: 4, borderColor: brand[500], overflow: 'hidden', marginBottom: 24, position: 'relative' },
    avatar: { width: '100%', height: '120%', position: 'absolute', top: 0 },
    charName: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
    charDesc: { fontSize: 16, color: 'rgba(255,255,255,0.8)', textAlign: 'center', maxWidth: 300, lineHeight: 24 },

    // Stats
    statsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 32, marginBottom: 24, marginTop: 16 },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    statIconContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(230, 85, 197, 0.1)', justifyContent: 'center', alignItems: 'center' },
    statValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
    statLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },

    // Interests
    interestsContainer: { width: '100%', alignItems: 'center', marginBottom: 24 },
    interestsTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
    hobbyTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    hobbyText: { color: '#fff', fontSize: 14 },

    startButton: { width: '100%', maxWidth: 300 },
});

