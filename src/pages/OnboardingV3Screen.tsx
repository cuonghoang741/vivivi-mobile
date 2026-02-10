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
    StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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
import { telegramNotificationService } from '../services/TelegramNotificationService';
import { getTelegramUserInfo } from '../utils/telegramUserHelper';

import { CharacterPreviewScreen } from './CharacterPreviewScreen';
import {
    IconChevronLeft,
    IconBellFilled,
    IconHeartHandshake,
    IconSparkles,
    IconUser,
    IconCalendar
} from '@tabler/icons-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BRAND_GRADIENT = ['#8b5cf6', '#7c3aed'] as const;

type OnboardingStep = 'name' | 'age' | 'hobbies' | 'personality' | 'notification' | 'analyzing' | 'selection' | 'reveal';

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
    const insets = useSafeAreaInsets();
    const [currentStep, setCurrentStep] = useState<OnboardingStep>('name');

    // Form State
    const [userName, setUserName] = useState('');
    const [userAge, setUserAge] = useState('22');
    const [hobbies, setHobbies] = useState('');
    const [personality, setPersonality] = useState('');

    // Logic State
    const [selectedCharacter, setSelectedCharacter] = useState<CharacterItem | null>(null);
    const [availableCharacters, setAvailableCharacters] = useState<CharacterItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Animation values
    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const ageScrollRef = useRef<ScrollView>(null);

    const steps: OnboardingStep[] = ['name', 'age', 'hobbies', 'personality'];
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

        switch (currentStep) {
            case 'name':
                if (userName.trim().length > 0) animateToNextStep('age');
                break;
            case 'age':
                animateToNextStep('hobbies');
                break;
            case 'hobbies':
                animateToNextStep('personality');
                break;
            case 'personality':
                startAnalysis();
                break;
        }
    }, [currentStep, userName, userAge, hobbies, personality]);

    const handleBack = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        Keyboard.dismiss();

        if (currentStep === 'analyzing' || currentStep === 'reveal') return;

        if (currentStepIndex > 0) {
            const prevStep = steps[currentStepIndex - 1];
            animateToPrevStep(prevStep);
        }
    }, [currentStepIndex, currentStep, steps]);



    const startAnalysis = async () => {
        setCurrentStep('analyzing');
        setIsAnalyzing(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        try {
            const characterRepo = new CharacterRepository();
            const freeCharacters = await characterRepo.fetchFreeCharacters();
            const availableChars = freeCharacters.filter(c => c.available);

            if (availableChars.length === 0) {
                Alert.alert('Error', 'No characters available.');
                setIsAnalyzing(false);
                return;
            }

            setAvailableCharacters(availableChars);
            setIsAnalyzing(false);
            setCurrentStep('selection');
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
            await authManager.updateDisplayName(userName.trim());
            const birthYear = new Date().getFullYear() - parseInt(userAge, 10);
            await authManager.updateBirthYear(birthYear);

            const assetRepo = new AssetRepository();
            await assetRepo.createAsset(selectedCharacter.id, 'character');

            if (selectedCharacter.default_costume_id) {
                try { await assetRepo.createAsset(selectedCharacter.default_costume_id, 'character_costume'); } catch { }
            }

            const backgroundRepo = new BackgroundRepository();
            const backgrounds = await backgroundRepo.fetchAllBackgrounds();
            const freeBackgrounds = backgrounds.filter((b) => b.available && b.tier === 'free').slice(0, 3);
            for (const bg of freeBackgrounds) {
                try { await assetRepo.createAsset(bg.id, 'background'); } catch { }
            }

            const currencyRepo = new CurrencyRepository();
            const currentCurrency = await currencyRepo.fetchCurrency();
            await currencyRepo.updateCurrency(currentCurrency.vcoin + 10000, currentCurrency.ruby + 100);

            await AsyncStorage.setItem(`character.nickname.${selectedCharacter.id}`, selectedCharacter.name);
            const userProfile = { occupation: '', hobbies: hobbies.trim(), personality: personality.trim() };
            await AsyncStorage.setItem('user.profile', JSON.stringify(userProfile));
            await AsyncStorage.setItem(PersistKeys.hasCompletedOnboardingV2, 'true');

            analyticsService.logOnboardingComplete(selectedCharacter.id);

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

    // --- Renderers ---

    const renderNameStep = () => (
        <View style={styles.stepContent}>
            <View style={styles.iconHeader}>
                <IconUser size={48} color="#8b5cf6" />
            </View>
            <View style={styles.titleContainer}>
                <Text style={styles.title}>What's your name?</Text>
                <Text style={styles.subtitle}>Let us know how to address you.</Text>
            </View>
            <View style={styles.inputWrapper}>
                <BlurView intensity={20} tint="light" style={styles.blurInputContainer}>
                    <TextInput
                        style={styles.textInput}
                        value={userName}
                        onChangeText={setUserName}
                        placeholder="Enter your name"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        autoFocus
                        returnKeyType="next"
                        onSubmitEditing={handleContinue}
                    />
                </BlurView>
            </View>
        </View>
    );

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
                <View style={styles.iconHeader}>
                    <IconCalendar size={48} color="#8b5cf6" />
                </View>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>How old are you?</Text>
                    <Text style={styles.subtitle}>We use this to personalize your experience.</Text>
                </View>
                <View style={styles.agePickerContainer}>
                    <LinearGradient
                        colors={['rgba(0,0,0,0.8)', 'transparent', 'rgba(0,0,0,0.8)']}
                        style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
                        pointerEvents="none"
                    />
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
                            return (
                                <Pressable
                                    key={age}
                                    onPress={() => {
                                        setUserAge(age.toString());
                                        ageScrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
                                    }}
                                    style={[styles.ageItem, { height: ITEM_HEIGHT }]}
                                >
                                    <Text style={[styles.ageText, isSelected && styles.ageTextSelected]}>
                                        {age}
                                    </Text>
                                    {isSelected && (
                                        <View style={styles.ageIndicator} />
                                    )}
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>
            </View>
        );
    };

    const renderHobbiesStep = () => (
        <View style={styles.stepContent}>
            <View style={styles.iconHeader}>
                <IconHeartHandshake size={48} color="#8b5cf6" />
            </View>
            <View style={styles.titleContainer}>
                <Text style={styles.title}>Your interests?</Text>
                <Text style={styles.subtitle}>Gaming, Music, Travel, etc.</Text>
            </View>
            <View style={styles.inputWrapper}>
                <BlurView intensity={20} tint="light" style={styles.blurInputContainer}>
                    <TextInput
                        style={styles.textInput}
                        value={hobbies}
                        onChangeText={setHobbies}
                        placeholder="Type your hobbies..."
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        autoFocus
                        returnKeyType="next"
                        onSubmitEditing={handleContinue}
                    />
                </BlurView>
            </View>
        </View>
    );

    const renderPersonalityStep = () => (
        <View style={styles.stepContent}>
            <View style={styles.iconHeader}>
                <IconSparkles size={48} color="#8b5cf6" />
            </View>
            <View style={styles.titleContainer}>
                <Text style={styles.title}>Describe yourself</Text>
                <Text style={styles.subtitle}>E.g., Introvert, Adventurous...</Text>
            </View>
            <View style={styles.inputWrapper}>
                <BlurView intensity={20} tint="light" style={styles.blurInputContainer}>
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
                </BlurView>
            </View>
        </View>
    );

    const renderNotificationStep = () => (
        <View style={styles.stepContent}>
            <View style={styles.notificationIconRing}>
                <LinearGradient
                    colors={BRAND_GRADIENT}
                    style={styles.notificationIconGradient}
                >
                    <IconBellFilled size={40} color="#fff" />
                </LinearGradient>
            </View>
            <View style={styles.titleContainer}>
                <Text style={styles.title}>Stay Connected</Text>
                <Text style={styles.subtitle}>
                    Enable notifications to never miss a message from your soulmate.
                </Text>
            </View>
            <View style={styles.notificationPreview}>
                <BlurView intensity={10} tint="light" style={styles.notificationCard}>
                    <View style={styles.notifHeader}>
                        <View style={styles.notifIconSmall}>
                            <Image source={require('../../assets/icon.png')} style={{ width: 16, height: 16, borderRadius: 4 }} />
                        </View>
                        <Text style={styles.notifAppName}>Lusty</Text>
                        <Text style={styles.notifTime}>now</Text>
                    </View>
                    <Text style={styles.notifTitle}>New Message</Text>
                    <Text style={styles.notifBody}>
                        "I've been waiting for you... ❤️"
                    </Text>
                </BlurView>
            </View>
        </View>
    );

    if (currentStep === 'analyzing') {
        return (
            <View style={styles.centerContainer}>
                <StatusBar barStyle="light-content" />
                <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={StyleSheet.absoluteFill} />
                <ActivityIndicator size="large" color="#8b5cf6" />
                <Text style={styles.analyzingText}>Analyzing your profile...</Text>
                <Text style={styles.analyzingSubText}>Finding your perfect match</Text>
            </View>
        );
    }

    if (currentStep === 'selection') {
        return (
            <CharacterPreviewScreen
                characters={availableCharacters}
                onSelect={(character) => {
                    setSelectedCharacter(character);
                    setCurrentStep('reveal');
                }}
            />
        );
    }

    if (currentStep === 'reveal' && selectedCharacter) {
        return (
            <View style={styles.revealContainer}>
                <StatusBar barStyle="light-content" />
                <Image
                    source={{ uri: selectedCharacter.thumbnail_url || selectedCharacter.avatar }}
                    style={styles.revealBgImage}
                    blurRadius={30}
                />
                <LinearGradient
                    colors={['transparent', '#000']}
                    style={StyleSheet.absoluteFill}
                />

                <SafeAreaView style={styles.revealSafeArea}>
                    <ScrollView contentContainerStyle={styles.revealScrollContent} showsVerticalScrollIndicator={false}>
                        <Text style={styles.matchTitle}>It's a Match!</Text>

                        <View style={styles.avatarWrapper}>
                            <LinearGradient colors={BRAND_GRADIENT} style={styles.avatarBorder}>
                                <Image
                                    source={{ uri: selectedCharacter.avatar || selectedCharacter.thumbnail_url }}
                                    style={styles.avatarImage}
                                />
                            </LinearGradient>
                        </View>

                        <Text style={styles.charName}>{selectedCharacter.name}</Text>
                        <Text style={styles.charDesc}>{selectedCharacter.description}</Text>

                        {/* Stats Grid */}
                        <View style={styles.statsGrid}>
                            {selectedCharacter.data?.height_cm && (
                                <BlurView intensity={20} tint="light" style={styles.statBox}>
                                    <Text style={styles.statValue}>{selectedCharacter.data.height_cm}cm</Text>
                                    <Text style={styles.statLabel}>Height</Text>
                                </BlurView>
                            )}
                            {selectedCharacter.data?.rounds && (
                                <BlurView intensity={20} tint="light" style={styles.statBox}>
                                    <Text style={styles.statValue}>
                                        {selectedCharacter.data.rounds.r1}-{selectedCharacter.data.rounds.r2}-{selectedCharacter.data.rounds.r3}
                                    </Text>
                                    <Text style={styles.statLabel}>Measurements</Text>
                                </BlurView>
                            )}
                        </View>

                        {/* Interests */}
                        {selectedCharacter.data?.hobbies && (
                            <View style={styles.interestsWrapper}>
                                {selectedCharacter.data.hobbies.map((hobby, i) => (
                                    <View key={i} style={styles.interestTag}>
                                        <Text style={styles.interestText}>{hobby}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </ScrollView>

                    <View style={styles.revealFooter}>
                        <TouchableOpacity
                            onPress={handleFinish}
                            disabled={isSaving}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={BRAND_GRADIENT}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.actionButton}
                            >
                                {isSaving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.actionButtonText}>Start Chatting</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    const canContinue = () => {
        if (currentStep === 'name') return userName.trim().length > 0;
        return true;
    };

    const renderProgress = () => (
        <View style={styles.progressBarContainer}>
            {steps.map((s, index) => {
                const isActive = index === currentStepIndex;
                const isCompleted = index < currentStepIndex;
                return (
                    <View
                        key={s}
                        style={[
                            styles.progressSegment,
                            isActive && styles.progressSegmentActive,
                            isCompleted && styles.progressSegmentCompleted
                        ]}
                    />
                );
            })}
        </View>
    );

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 'name': return renderNameStep();
            case 'age': return renderAgeStep();
            case 'hobbies': return renderHobbiesStep();
            case 'personality': return renderPersonalityStep();
            default: return null;
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={['#0f0c29', '#302b63', '#24243e']}
                style={StyleSheet.absoluteFill}
            />

            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={styles.header}>
                        {currentStepIndex > 0 ? (
                            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                                <IconChevronLeft size={28} color="#fff" />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {/* Progress */}
                    {renderProgress()}

                    {/* Content */}
                    <Animated.View style={[styles.contentContainer, { transform: [{ translateX: slideAnim }], opacity: fadeAnim }]}>
                        {renderCurrentStep()}
                    </Animated.View>

                    {/* Controls */}
                    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                        <TouchableOpacity
                            onPress={handleContinue}
                            disabled={!canContinue()}
                            activeOpacity={0.8}
                            style={[!canContinue() && { opacity: 0.5 }]}
                        >
                            <LinearGradient
                                colors={BRAND_GRADIENT}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.actionButton}
                            >
                                <Text style={styles.actionButtonText}>
                                    Continue
                                </Text>
                            </LinearGradient>
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
    header: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        justifyContent: 'space-between',
    },
    backButton: {
        padding: 8,
    },
    skipButton: {
        position: 'absolute',
        right: 20,
        top: 15,
        padding: 8,
    },
    skipText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 16,
        fontWeight: '600',
    },
    progressBarContainer: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        gap: 6,
        height: 4,
        marginTop: 10,
        marginBottom: 20,
    },
    progressSegment: {
        flex: 1,
        height: '100%',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
    },
    progressSegmentActive: {
        backgroundColor: '#8b5cf6',
    },
    progressSegmentCompleted: {
        backgroundColor: '#8b5cf6',
    },
    contentContainer: {
        flex: 1,
    },
    stepContent: {
        flex: 1,
        paddingHorizontal: 28,
        paddingTop: 40,
        alignItems: 'center',
    },
    iconHeader: {
        marginBottom: 24,
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.2)',
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20,
    },
    inputWrapper: {
        width: '100%',
    },
    blurInputContainer: {
        width: '100%',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    textInput: {
        width: '100%',
        paddingVertical: 20,
        paddingHorizontal: 20,
        fontSize: 20,
        color: '#fff',
        textAlign: 'center',
        fontWeight: '600',
    },
    footer: {
        paddingHorizontal: 28,
    },
    actionButton: {
        borderRadius: 24,
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
    },

    // Age Picker
    agePickerContainer: {
        height: 300,
        width: '100%',
        position: 'relative',
    },
    ageItem: {
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
    },
    ageText: {
        fontSize: 24,
        color: 'rgba(255,255,255,0.3)',
        fontWeight: '600',
    },
    ageTextSelected: {
        fontSize: 32,
        color: '#fff',
        fontWeight: '800',
    },
    ageIndicator: {
        position: 'absolute',
        right: '30%',
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#8b5cf6',
    },

    // Notification
    notificationIconRing: {
        marginBottom: 32,
        padding: 4,
        borderRadius: 50,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    notificationIconGradient: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationPreview: {
        width: '100%',
        marginTop: 20,
    },
    notificationCard: {
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    notifHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    notifIconSmall: {
        marginRight: 8,
        backgroundColor: '#000',
        borderRadius: 4,
    },
    notifAppName: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    notifTime: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
    },
    notifTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    notifBody: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 15,
    },

    // Analyzing
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    analyzingText: {
        marginTop: 32,
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
    },
    analyzingSubText: {
        marginTop: 8,
        fontSize: 16,
        color: 'rgba(255,255,255,0.5)',
    },

    // Reveal
    revealContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    revealBgImage: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.6,
    },
    revealSafeArea: {
        flex: 1,
    },
    revealScrollContent: {
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 100,
    },
    matchTitle: {
        fontSize: 36,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 40,
        textAlign: 'center',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
    },
    avatarWrapper: {
        marginBottom: 24,
    },
    avatarBorder: {
        padding: 4,
        borderRadius: 100,
    },
    avatarImage: {
        width: 180,
        height: 180,
        borderRadius: 96,
        backgroundColor: '#000',
        borderWidth: 4,
        borderColor: '#000',
    },
    charName: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 12,
        textAlign: 'center',
    },
    charDesc: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 32,
    },
    statBox: {
        padding: 16,
        borderRadius: 16,
        overflow: 'hidden',
        alignItems: 'center',
        minWidth: 100,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    statValue: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    statLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        textTransform: 'uppercase',
    },
    interestsWrapper: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 10,
    },
    interestTag: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    interestText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    revealFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        paddingBottom: 40,
    },
});
