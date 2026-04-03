import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { PurchasesPackage } from 'react-native-purchases';
import { revenueCatManager } from '../../services/RevenueCatManager';
import { telegramNotificationService } from '../../services/TelegramNotificationService';
import { getTelegramUserInfo } from '../../utils/telegramUserHelper';
import { getSupabaseClient } from '../../services/supabase';
import { getAuthIdentifier } from '../../services/authIdentifier';
import { decode } from 'base64-arraybuffer';
import { CUSTOM_CHARACTER_IMAGE_URLS } from '../../constants/customCharacterOptions';
import { LiquidGlass } from '../LiquidGlass';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Image Assets (S3-hosted, resized to 400px width) ───────────────
// Maps stepKey → prefix used in CUSTOM_CHARACTER_IMAGE_URLS keys
const STEP_KEY_PREFIX: Record<string, string> = {
    bodyType: 'body',
    ethnicity: 'eth',
    hairColor: 'hair',
    hairStyle: 'style',
    eyeColor: 'eye',
    breastSize: 'breast',
    buttSize: 'butt',
    outfit: 'outfit',
    personality: 'personality',
};

// Special label → key suffix overrides for labels that don't match filename pattern
const LABEL_KEY_OVERRIDES: Record<string, string> = {
    'White/Silver': 'silver',
    'School Girl': 'schoolgirl',
    'Office Lady': 'officelady',
    'Plus Size': 'plussize',
    'Extra Large': 'extralarge',
    'Long Straight': 'longstraight',
    'Long Wavy': 'longwavy',
    'Long Curly': 'longcurly',
    'Medium Bob': 'bob',
    'Short Pixie': 'pixie',
    'Twin Tails': 'twintails',
    'Southeast Asian': 'southeast asian',
    'Middle Eastern': 'middle eastern',
};

function findOptionImage(stepKey: string, label: string): string | undefined {
    const prefix = STEP_KEY_PREFIX[stepKey];
    if (!prefix) return undefined;

    const suffix = LABEL_KEY_OVERRIDES[label] || label.toLowerCase();
    const key = `${prefix} ${suffix}`;
    return CUSTOM_CHARACTER_IMAGE_URLS[key];
}

// ─── Types ──────────────────────────────────────────────────────────

type CharacterRequest = {
    id: string;
    status: 'pending' | 'in_progress' | 'completed' | 'rejected';
    selections: Record<string, string>;
    reference_image_url: string | null;
    created_at: string;
};

// ─── Step Definitions ───────────────────────────────────────────────

type StepOption = { label: string; emoji: string; popular?: boolean };

type StepConfig = {
    key: string;
    title: string;
    subtitle: string;
    icon: string;
    type: 'grid' | 'text';
    options?: StepOption[];
    placeholder?: string;
    quickTags?: string[];
    columns?: 2 | 3;
};

const STEPS: StepConfig[] = [
    {
        key: 'bodyType',
        title: 'Body Type',
        subtitle: 'What kind of figure do you prefer?',
        icon: '💃',
        type: 'grid',
        options: [
            { label: 'Slim', emoji: '🦋' },
            { label: 'Athletic', emoji: '🏋️', popular: true },
            { label: 'Curvy', emoji: '🍑', popular: true },
            { label: 'Petite', emoji: '🌸' },
            { label: 'Thicc', emoji: '🔥', popular: true },
            { label: 'Tall', emoji: '👠' },
            { label: 'Hourglass', emoji: '⏳' },
            { label: 'Plus Size', emoji: '💖' },
        ],
    },
    {
        key: 'ethnicity',
        title: 'Ethnicity',
        subtitle: 'Choose the look you desire',
        icon: '🌍',
        type: 'grid',
        options: [
            { label: 'Japanese', emoji: '🇯🇵', popular: true },
            { label: 'Korean', emoji: '🇰🇷', popular: true },
            { label: 'Chinese', emoji: '🇨🇳' },
            { label: 'Southeast Asian', emoji: '🌺' },
            { label: 'Latina', emoji: '🇧🇷', popular: true },
            { label: 'European', emoji: '🇫🇷' },
            { label: 'Scandinavian', emoji: '🇸🇪' },
            { label: 'Slavic', emoji: '🇷🇺' },
            { label: 'African', emoji: '🇳🇬' },
            { label: 'Middle Eastern', emoji: '🇦🇪' },
            { label: 'Indian', emoji: '🇮🇳' },
            { label: 'Mixed', emoji: '🌈' },
        ],
    },
    {
        key: 'hairColor',
        title: 'Hair Color',
        subtitle: 'Pick her hair color',
        icon: '🎨',
        type: 'grid',
        options: [
            { label: 'Blonde', emoji: '👱‍♀️', popular: true },
            { label: 'Brunette', emoji: '👩' },
            { label: 'Redhead', emoji: '👩‍🦰' },
            { label: 'Black', emoji: '🖤', popular: true },
            { label: 'Pink', emoji: '🩷', popular: true },
            { label: 'White/Silver', emoji: '🤍' },
            { label: 'Blue', emoji: '�' },
            { label: 'Purple', emoji: '💜' },
            { label: 'Green', emoji: '💚' },
            { label: 'Ombre', emoji: '🌅' },
        ],
    },
    {
        key: 'hairStyle',
        title: 'Hair Style',
        subtitle: 'Choose the length & style',
        icon: '💇',
        type: 'grid',
        options: [
            { label: 'Long Straight', emoji: '📏', popular: true },
            { label: 'Long Wavy', emoji: '🌊', popular: true },
            { label: 'Long Curly', emoji: '🌀' },
            { label: 'Medium Bob', emoji: '✂️' },
            { label: 'Short Pixie', emoji: '🧚' },
            { label: 'Ponytail', emoji: '🎀', popular: true },
            { label: 'Twin Tails', emoji: '🎐' },
            { label: 'Braids', emoji: '�' },
            { label: 'Bun', emoji: '🍡' },
        ],
    },
    {
        key: 'eyeColor',
        title: 'Eye Color',
        subtitle: 'What color eyes should she have?',
        icon: '👁️',
        type: 'grid',
        options: [
            { label: 'Brown', emoji: '🤎' },
            { label: 'Blue', emoji: '💙', popular: true },
            { label: 'Green', emoji: '💚', popular: true },
            { label: 'Hazel', emoji: '🟤' },
            { label: 'Gray', emoji: '🩶' },
            { label: 'Amber', emoji: '🧡' },
            { label: 'Violet', emoji: '💜' },
            { label: 'Heterochromia', emoji: '🌈' },
        ],
    },
    {
        key: 'breastSize',
        title: 'Breast Size',
        subtitle: 'Choose her figure',
        icon: '👙',
        type: 'grid',
        options: [
            { label: 'Flat', emoji: '�' },
            { label: 'Small', emoji: '🍊' },
            { label: 'Medium', emoji: '🍈', popular: true },
            { label: 'Large', emoji: '🍉', popular: true },
            { label: 'Extra Large', emoji: '🔥' },
        ],
    },
    {
        key: 'buttSize',
        title: 'Butt Size',
        subtitle: 'Select her shape',
        icon: '🍑',
        type: 'grid',
        options: [
            { label: 'Small', emoji: '🫧' },
            { label: 'Medium', emoji: '🍑', popular: true },
            { label: 'Large', emoji: '🔥', popular: true },
            { label: 'Extra Large', emoji: '💥' },
        ],
    },
    {
        key: 'outfit',
        title: 'Outfit',
        subtitle: 'What should she wear?',
        icon: '👗',
        type: 'grid',
        options: [
            { label: 'Lingerie', emoji: '🩱', popular: true },
            { label: 'Bikini', emoji: '👙', popular: true },
            { label: 'School Girl', emoji: '📚', popular: true },
            { label: 'Nurse', emoji: '👩‍⚕️' },
            { label: 'Maid', emoji: '🧹' },
            { label: 'Casual', emoji: '👕' },
            { label: 'Office Lady', emoji: '💼' },
            { label: 'Gothic', emoji: '🖤' },
            { label: 'Kimono', emoji: '🎎' },
            { label: 'Sportswear', emoji: '🎾' },
            { label: 'Cosplay', emoji: '🦸‍♀️' },
            { label: 'Dress', emoji: '👗' },
        ],
    },
    {
        key: 'personality',
        title: 'Personality',
        subtitle: 'Choose her vibe',
        icon: '✨',
        type: 'grid',
        options: [
            { label: 'Submissive', emoji: '🥺', popular: true },
            { label: 'Dominant', emoji: '😈', popular: true },
            { label: 'Shy', emoji: '😳' },
            { label: 'Flirty', emoji: '😘', popular: true },
            { label: 'Wild', emoji: '🔥' },
            { label: 'Sweet', emoji: '🍬' },
            { label: 'Tsundere', emoji: '💢' },
            { label: 'Yandere', emoji: '🔪' },
            { label: 'Motherly', emoji: '🤱' },
            { label: 'Tomboy', emoji: '⚡' },
        ],
    },
    // {
    //     key: 'extraNotes',
    //     title: 'Special Requests',
    //     subtitle: 'Add extra details (optional)',
    //     icon: '📝',
    //     type: 'text',
    //     placeholder: 'Describe any other details you want...',
    //     quickTags: [
    //         'Cat Ears', 'Fox Ears', 'Elf Ears', 'Glasses', 'Freckles',
    //         'Tattoos', 'Piercing', 'Fangs', 'Horns', 'Wings',
    //         'Tail', 'Heterochromia', 'Scars', 'Mole', 'Big Eyes',
    //         'Thick Lips', 'Choker', 'Thigh Highs',
    //     ],
    // },
];

const TOTAL_STEPS = STEPS.length + 1; // +1 for purchase/submit step

// ─── Status Helpers ─────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
    pending: { label: 'Pending', color: '#F59E0B', bgColor: 'rgba(245,158,11,0.15)', icon: 'time-outline' },
    in_progress: { label: 'In Progress', color: '#3B82F6', bgColor: 'rgba(59,130,246,0.15)', icon: 'hammer-outline' },
    completed: { label: 'Completed', color: '#10B981', bgColor: 'rgba(16,185,129,0.15)', icon: 'checkmark-circle-outline' },
    rejected: { label: 'Rejected', color: '#EF4444', bgColor: 'rgba(239,68,68,0.15)', icon: 'close-circle-outline' },
};

function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Component ──────────────────────────────────────────────────────

type Props = {
    visible: boolean;
    onClose: () => void;
};

type ScreenMode = 'loading' | 'history' | 'creation';

export const CustomCharacterModal: React.FC<Props> = ({ visible, onClose }) => {
    const insets = useSafeAreaInsets();

    // Screen mode
    const [screenMode, setScreenMode] = useState<ScreenMode>('loading');
    const [requests, setRequests] = useState<CharacterRequest[]>([]);
    const [customPackage, setCustomPackage] = useState<PurchasesPackage | null>(null);

    // Creation flow state
    const [currentStep, setCurrentStep] = useState(0);
    const [selections, setSelections] = useState<Record<string, string>>({});
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const slideAnim = useRef(new Animated.Value(0)).current;

    // ─── Load Existing Requests ─────────────────────────────

    const fetchHistory = useCallback(async () => {
        try {
            const supabase = getSupabaseClient();
            const { userId, clientId } = await getAuthIdentifier();

            let query = supabase
                .from('custom_character_requests')
                .select('id, status, selections, reference_image_url, created_at')
                .order('created_at', { ascending: false });

            if (userId) {
                query = query.eq('user_id', userId);
            } else if (clientId) {
                query = query.eq('client_id', clientId);
            } else {
                setScreenMode('creation');
                return;
            }

            const { data, error } = await query;
            if (error) {
                console.error('[CustomCharacterModal] Fetch requests failed:', error);
                setScreenMode('creation');
                return;
            }

            if (data && data.length > 0) {
                setRequests(data as CharacterRequest[]);
                setScreenMode('history');
            } else {
                setScreenMode('creation');
            }
        } catch (e) {
            console.error('[CustomCharacterModal] Error:', e);
            setScreenMode('creation');
        }
    }, []);

    const resetState = useCallback(() => {
        setCurrentStep(0);
        setSelections({});
        setReferenceImage(null);
        setIsCompleted(false);
        setScreenMode('loading');
        setCustomPackage(null);
    }, []);

    useEffect(() => {
        if (visible) {
            setScreenMode('loading');
            fetchHistory();
            revenueCatManager.getPackageByIdentifier('roxie.custom').then(pkg => setCustomPackage(pkg || null));
        } else {
            resetState();
        }
    }, [visible, fetchHistory, resetState]);

    // ─── Creation Flow Handlers ─────────────────────────────

    const animateSlide = (direction: 'forward' | 'back') => {
        const from = direction === 'forward' ? SCREEN_WIDTH : -SCREEN_WIDTH;
        slideAnim.setValue(from);
        Animated.spring(slideAnim, {
            toValue: 0,
            tension: 60,
            friction: 12,
            useNativeDriver: true,
        }).start();
    };

    const handleNext = () => {
        if (currentStep < TOTAL_STEPS - 1) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCurrentStep(prev => prev + 1);
            animateSlide('forward');
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCurrentStep(prev => prev - 1);
            animateSlide('back');
        }
    };

    const handleSelect = (stepKey: string, value: string) => {
        Haptics.selectionAsync();
        setSelections(prev => ({ ...prev, [stepKey]: value }));

        // Auto-advance to next step for grid selections
        const currentStepConfig = STEPS[currentStep];
        if (currentStepConfig?.type === 'grid' && currentStep < TOTAL_STEPS - 1) {
            setTimeout(() => {
                setCurrentStep(prev => prev + 1);
                animateSlide('forward');
            }, 400);
        }
    };

    const handleClose = () => {
        setCurrentStep(0);
        setSelections({});
        setReferenceImage(null);
        setIsCompleted(false);
        setScreenMode('loading');
        onClose();
    };

    const handleStartNewRequest = () => {
        setCurrentStep(0);
        setSelections({});
        setReferenceImage(null);
        setIsCompleted(false);
        setScreenMode('creation');
    };

    const handlePickImage = async () => {
        // const result = await ImagePicker.launchImageLibraryAsync({
        //     mediaTypes: ImagePicker.MediaTypeOptions.Images,
        //     allowsMultipleSelection: false,
        //     allowsEditing: true,
        //     quality: 0.4,
        // });
        // if (!result.canceled && result.assets?.[0]) {
        //     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        //     setReferenceImage(result.assets[0].uri);
        // }
    };

    const uploadImageToColorMeVn = async (): Promise<string | null> => {
        if (!referenceImage) return null;
        try {
            const formData = new FormData();
            const fileName = `custom_character_${Date.now()}.jpg`;
            formData.append('image', {
                uri: referenceImage,
                name: fileName,
                type: 'image/jpeg',
            } as any, fileName);

            const response = await fetch("https://colorme.vn/api/v1/upload-image-public", {
                headers: {
                    "accept": "application/json, text/plain, */*",
                    "accept-language": "en-US,en;q=0.9",
                },
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                console.error('[CustomCharacterModal] Image upload failed with status:', response.status);
                return null;
            }

            const data = await response.json();
            return data?.link || data?.url || data?.image_url || data?.data?.url || data?.data?.link || null;
        } catch (err) {
            console.error('[CustomCharacterModal] Image upload exception:', err);
            return null;
        }
    };

    const handlePurchaseAndSubmit = async () => {
        if (isPurchasing || isSubmitting) return;

        try {
            setIsPurchasing(true);
            const pkg = customPackage || await revenueCatManager.getPackageByIdentifier('roxie.custom');
            if (!pkg) {
                Alert.alert('Error', 'Custom character package not found.');
                return;
            }

            await revenueCatManager.purchasePackage(pkg);
            setIsPurchasing(false);
            setIsSubmitting(true);

            // Upload reference image
            const imageUrl = await uploadImageToColorMeVn();

            // Insert into custom_character_requests table
            const supabase = getSupabaseClient();
            const { userId, clientId } = await getAuthIdentifier();

            const requestData: Record<string, any> = {
                selections: selections,
                reference_image_url: imageUrl,
                status: 'pending',
            };
            if (userId) requestData.user_id = userId;
            if (clientId) requestData.client_id = clientId;

            const { error: insertError } = await supabase
                .from('custom_character_requests')
                .insert(requestData);

            if (insertError) {
                console.error('[CustomCharacterModal] Failed to insert request:', insertError);
            }

            // Also write to app_feedback for backward compat
            const feedbackContent = STEPS.map(step => {
                const val = selections[step.key];
                return `${step.title}: ${val || '(not selected)'}`;
            }).join('\n') + (imageUrl ? `\n\nReference Image:\n${imageUrl}` : '');

            const feedbackData: Record<string, any> = {
                feedback_type: 'custom_character',
                content: feedbackContent,
                metadata: JSON.stringify({ ...selections, referenceImage: imageUrl }),
            };
            if (userId) feedbackData.user_id = userId;
            else if (clientId) feedbackData.client_id = clientId;

            try { await supabase.from('app_feedback').insert(feedbackData); } catch (_e) { /* ignore */ }

            // Telegram notification (fire-and-forget)
            getTelegramUserInfo().then(userInfo => {
                telegramNotificationService.notifyCustomCharacterRequest(userInfo, selections, imageUrl || undefined);
            }).catch(err => console.warn('[CustomCharacterModal] Telegram notification failed:', err));

            setIsSubmitting(false);
            setIsCompleted(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error: any) {
            console.error('[CustomCharacterModal] Purchase/submit failed:', error);
            setIsPurchasing(false);
            setIsSubmitting(false);
            if (error.message !== 'Purchase cancelled') {
                Alert.alert('Error', 'Something went wrong. Please try again.');
            }
        }
    };

    // Is current customization step (not the final purchase step)
    const isCustomizationStep = currentStep < STEPS.length;
    const stepConfig = isCustomizationStep ? STEPS[currentStep] : null;
    const canGoNext = isCustomizationStep
        ? (stepConfig?.type === 'text' || !!selections[stepConfig!.key])
        : false;

    const progress = (currentStep + 1) / TOTAL_STEPS;

    // ─── Render: History Screen ─────────────────────────────

    const handleRemoveRequest = (requestId: string) => {
        Alert.alert(
            'Remove Request',
            'Are you sure you want to remove this pending request?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const supabase = getSupabaseClient();
                            const { error } = await supabase
                                .from('custom_character_requests')
                                .delete()
                                .eq('id', requestId)
                                .eq('status', 'pending');

                            if (error) {
                                console.error('[CustomCharacterModal] Delete request failed:', error);
                                Alert.alert('Error', 'Failed to remove request.');
                                return;
                            }

                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            // Refresh list
                            const updated = requests.filter(r => r.id !== requestId);
                            setRequests(updated);
                            if (updated.length === 0) {
                                setScreenMode('creation');
                            }
                        } catch (e) {
                            console.error('[CustomCharacterModal] Remove error:', e);
                            Alert.alert('Error', 'Something went wrong.');
                        }
                    },
                },
            ]
        );
    };

    const renderRequestCard = ({ item }: { item: CharacterRequest }) => {
        const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
        const sel = (item.selections || {}) as Record<string, string>;
        const isPending = item.status === 'pending';
        return (
            <View style={styles.requestCard}>
                <View style={styles.requestCardHeader}>
                    <Text style={styles.requestCardDate}>{formatDate(item.created_at)}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.statusBadge, { backgroundColor: config.bgColor }]}>
                            <Ionicons name={config.icon as any} size={13} color={config.color} />
                            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
                        </View>
                        {isPending && (
                            <Pressable
                                onPress={() => handleRemoveRequest(item.id)}
                                style={styles.removeRequestBtn}
                                hitSlop={8}
                            >
                                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            </Pressable>
                        )}
                    </View>
                </View>

                <View style={styles.requestCardBody}>
                    {sel.bodyType && (
                        <Text style={styles.requestDetail}>Body: {sel.bodyType}</Text>
                    )}
                    {sel.ethnicity && (
                        <Text style={styles.requestDetail}>Ethnicity: {sel.ethnicity}</Text>
                    )}
                    {sel.hairStyle && (
                        <Text style={styles.requestDetail}>Hair: {sel.hairStyle}</Text>
                    )}
                    {sel.personality && (
                        <Text style={styles.requestDetail}>Personality: {sel.personality}</Text>
                    )}
                </View>

                {item.reference_image_url && (
                    <Image
                        source={{ uri: item.reference_image_url }}
                        style={styles.requestImage}
                        contentFit="cover"
                    />
                )}
            </View>
        );
    };

    const renderHistoryScreen = () => (
        <View style={styles.historyContainer}>
            <Text style={styles.historyTitle}>Your Requests</Text>
            <Text style={styles.historySubtitle}>
                Track your custom character requests below
            </Text>

            <FlatList
                data={requests}
                keyExtractor={(item) => item.id}
                renderItem={renderRequestCard}
                contentContainerStyle={styles.historyList}
                showsVerticalScrollIndicator={false}
            />

            <View style={styles.historyFooter}>
                <Pressable onPress={handleStartNewRequest} style={styles.newRequestButtonContainer}>
                    <LinearGradient
                        colors={['#a855f7', '#ec4899']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.newRequestButton}
                    >
                        <Ionicons name="add-circle-outline" size={20} color="#fff" />
                        <Text style={styles.newRequestButtonText}>Create New Character</Text>
                    </LinearGradient>
                </Pressable>
            </View>
        </View>
    );

    // ─── Render: Creation Steps ─────────────────────────────

    const renderGridStep = (step: StepConfig) => {
        const cols = step.columns || 3;
        // Subtract an extra small margin (44 instead of 40) to guarantee they never wrap due to sub-pixel rounding
        const cardWidth = Math.floor((SCREEN_WIDTH - 44 - (cols - 1) * 12) / cols);

        return (
            <View style={styles.optionsGrid}>
                {step.options?.map(option => {
                    const isSelected = selections[step.key] === option.label;
                    const imageUrl = findOptionImage(step.key, option.label);

                    return (
                        <LiquidGlass
                            key={option.label}
                            style={[
                                imageUrl ? styles.optionCardImage : styles.optionCard,
                                { width: cardWidth },
                                // isSelected && styles.optionCardSelected,
                            ]}
                            onPress={() => handleSelect(step.key, option.label)}
                            tintColor={isSelected ? '#994590d8' : '#070707ea'}
                        >
                            {option.popular && !isSelected && (
                                <View style={styles.popularBadge}>
                                    <Text style={styles.popularBadgeText}>🔥</Text>
                                </View>
                            )}
                            {imageUrl ? (
                                <>
                                    <Image
                                        source={{ uri: imageUrl }}
                                        style={styles.optionImage}
                                        contentFit="cover"
                                        transition={200}
                                    />
                                    <LinearGradient
                                        colors={['transparent', 'rgba(0,0,0,0.7)']}
                                        style={styles.optionImageOverlay}
                                    >
                                        <Text style={[styles.optionImageLabel, isSelected && styles.optionLabelSelected]}>
                                            {option.label}
                                        </Text>
                                    </LinearGradient>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.optionEmoji}>{option.emoji}</Text>
                                    <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                                        {option.label}
                                    </Text>
                                </>
                            )}
                            {isSelected && (
                                <View style={styles.checkBadge}>
                                    <Ionicons name="checkmark" size={14} color="#fff" />
                                </View>
                            )}
                        </LiquidGlass>
                    );
                })}
            </View>
        );
    };

    const handleToggleQuickTag = (stepKey: string, tag: string) => {
        Haptics.selectionAsync();
        const current = selections[stepKey] || '';
        const tags = current.split(', ').filter(Boolean);
        if (tags.includes(tag)) {
            const updated = tags.filter(t => t !== tag).join(', ');
            setSelections(prev => ({ ...prev, [stepKey]: updated }));
        } else {
            const updated = [...tags, tag].join(', ');
            setSelections(prev => ({ ...prev, [stepKey]: updated }));
        }
    };

    const renderTextStep = (step: StepConfig) => (
        <View style={styles.textInputContainer}>
            {/* Quick Tags */}
            {step.quickTags && step.quickTags.length > 0 && (
                <View style={styles.quickTagsSection}>
                    <Text style={styles.quickTagsTitle}>✨ Quick Add</Text>
                    <View style={styles.quickTagsGrid}>
                        {step.quickTags.map(tag => {
                            const currentTags = (selections[step.key] || '').split(', ').filter(Boolean);
                            const isActive = currentTags.includes(tag);
                            return (
                                <LiquidGlass
                                    key={tag}
                                    style={[styles.quickTag, isActive && styles.quickTagActive]}
                                    onPress={() => handleToggleQuickTag(step.key, tag)}
                                    tintColor={isActive ? '#a855f740' : '#ffffff18'}
                                >
                                    <Text style={[styles.quickTagText, isActive && styles.quickTagTextActive]}>
                                        {tag}
                                    </Text>
                                    {isActive && (
                                        <Ionicons name="close" size={12} color="#d8b4fe" style={{ marginLeft: 2 }} />
                                    )}
                                </LiquidGlass>
                            );
                        })}
                    </View>
                </View>
            )}

            <Text style={styles.uploadSectionTitle}>💬 Additional Notes</Text>
            <TextInput
                style={styles.textInput}
                placeholder={step.placeholder}
                placeholderTextColor="rgba(255,255,255,0.35)"
                multiline
                value={selections[step.key] || ''}
                onChangeText={(text) => handleSelect(step.key, text)}
                textAlignVertical="top"
            />

            {/* Reference Image Upload */}
            <Text style={styles.uploadSectionTitle}>📸 Reference Image (optional)</Text>
            <Text style={styles.uploadSectionSubtitle}>
                Upload a reference photo to help us match your vision
            </Text>

            <View style={styles.imageRow}>
                {referenceImage ? (
                    <View style={styles.imageThumbWrapper}>
                        <Image source={{ uri: referenceImage }} style={styles.imageThumb} contentFit="cover" />
                        <Pressable
                            style={styles.imageRemoveBtn}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setReferenceImage(null);
                            }}
                            hitSlop={8}
                        >
                            <Ionicons name="close-circle" size={22} color="#FF4639" />
                        </Pressable>
                    </View>
                ) : (
                    <Pressable style={styles.imageAddBtn} onPress={handlePickImage}>
                        <Ionicons name="add" size={28} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.imageAddText}>Add Photo</Text>
                    </Pressable>
                )}
            </View>
        </View>
    );

    const renderPurchaseStep = () => {
        if (isCompleted) {
            return (
                <View style={styles.completedContainer}>
                    <Text style={styles.completedEmoji}>🎉</Text>
                    <Text style={styles.completedTitle}>Request Submitted!</Text>
                    <Text style={styles.completedSubtitle}>
                        It may take up to 24 hours to create your character. We'll notify you when she's ready!
                    </Text>

                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryTitle}>Your Selections</Text>
                        {STEPS.map(step => (
                            <View key={step.key} style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{step.title}</Text>
                                <Text style={styles.summaryValue}>
                                    {selections[step.key] || '—'}
                                </Text>
                            </View>
                        ))}
                    </View>

                    <Pressable style={styles.doneButton} onPress={handleClose}>
                        <LinearGradient
                            colors={['#FF4639', '#FF8E86']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.doneButtonGradient}
                        >
                            <Text style={styles.doneButtonText}>Done</Text>
                        </LinearGradient>
                    </Pressable>
                </View>
            );
        }

        return (
            <View style={styles.purchaseContainer}>
                <View style={styles.purchaseIconWrapper}>
                    <LinearGradient
                        colors={['rgba(168, 85, 247, 0.2)', 'rgba(236, 72, 153, 0.2)']}
                        style={styles.purchaseIconBg}
                    >
                        <Text style={{ fontSize: 48 }}>🎨</Text>
                    </LinearGradient>
                </View>

                <Text style={styles.purchaseTitle}>Create Your Dream Girl</Text>
                <Text style={styles.purchaseSubtitle}>
                    Our team will hand-craft a custom 3D character based on your selections. She'll be exclusively yours!
                </Text>

                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Your Selections</Text>
                    {STEPS.filter(s => selections[s.key]).map(step => (
                        <View key={step.key} style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>{step.title}</Text>
                            <Text style={styles.summaryValue}>{selections[step.key]}</Text>
                        </View>
                    ))}
                    {referenceImage && (
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Reference Image</Text>
                            <Text style={styles.summaryValue}>1 photo</Text>
                        </View>
                    )}
                </View>

                <View style={styles.privacyNoticeContainer}>
                    <Ionicons name="shield-checkmark" size={18} color="#10B981" />
                    <Text style={styles.privacyNoticeText}>
                        Your data and references are highly secured. We strictly protect your privacy and guarantee that your custom character remains 100% uniquely yours.
                    </Text>
                </View>
            </View>
        );
    };

    const renderPurchaseFooter = () => {
        if (isCompleted || isCustomizationStep) return null;
        return (
            <View style={styles.footer}>
                <Pressable
                    onPress={handlePurchaseAndSubmit}
                    disabled={isPurchasing || isSubmitting}
                    style={styles.purchaseButtonContainer}
                >
                    <LinearGradient
                        colors={['#a855f7', '#ec4899']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.purchaseButton}
                    >
                        {isPurchasing ? (
                            <View style={styles.purchaseButtonContent}>
                                <ActivityIndicator color="#fff" size="small" />
                                <Text style={styles.purchaseButtonText}>Processing...</Text>
                            </View>
                        ) : isSubmitting ? (
                            <View style={styles.purchaseButtonContent}>
                                <ActivityIndicator color="#fff" size="small" />
                                <Text style={styles.purchaseButtonText}>Submitting...</Text>
                            </View>
                        ) : (
                            <View style={styles.purchaseButtonContent}>
                                <Ionicons name="sparkles" size={20} color="#fff" />
                                <Text style={styles.purchaseButtonText}>
                                    Purchase & Submit {customPackage?.product.priceString ? `(${customPackage.product.priceString})` : ''}
                                </Text>
                            </View>
                        )}
                    </LinearGradient>
                </Pressable>
            </View>
        );
    };

    // ─── Render: Main ───────────────────────────────────────

    const renderSelectionChips = () => {
        const selectedKeys = Object.keys(selections).filter(k => selections[k] && k !== 'extraNotes');
        if (selectedKeys.length === 0) return null;

        return (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.selectionChipsScroll}
                contentContainerStyle={styles.selectionChipsContent}
            >
                {selectedKeys.map(key => {
                    const step = STEPS.find(s => s.key === key);
                    if (!step) return null;
                    return (
                        <View key={key} style={styles.selectionChip}>
                            <Text style={styles.selectionChipIcon}>{step.icon}</Text>
                            <Text style={styles.selectionChipText} numberOfLines={1}>
                                {selections[key]}
                            </Text>
                        </View>
                    );
                })}
            </ScrollView>
        );
    };

    const renderCreationContent = () => (
        <>
            {/* Floating Selection Summary */}
            {isCustomizationStep && currentStep > 0 && renderSelectionChips()}

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
                    {isCustomizationStep && stepConfig ? (
                        <View>
                            <Text style={styles.stepIcon}>{stepConfig.icon}</Text>
                            <Text style={styles.stepTitle}>{stepConfig.title}</Text>
                            <Text style={styles.stepSubtitle}>{stepConfig.subtitle}</Text>

                            {stepConfig.type === 'grid' && renderGridStep(stepConfig)}
                            {stepConfig.type === 'text' && renderTextStep(stepConfig)}
                        </View>
                    ) : (
                        renderPurchaseStep()
                    )}
                </Animated.View>
            </ScrollView>

            {/* Footer Navigation */}
            {isCustomizationStep ? (
                <View style={styles.footer}>
                    <Pressable
                        onPress={handleNext}
                        disabled={!canGoNext && stepConfig?.type !== 'text'}
                        style={[
                            styles.nextButtonContainer,
                            (!canGoNext && stepConfig?.type !== 'text') && { opacity: 0.4 },
                        ]}
                    >
                        <LinearGradient
                            colors={['#a855f7', '#ec4899']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.nextButton}
                        >
                            <Text style={styles.nextButtonText}>
                                {currentStep === STEPS.length - 1 ? 'Review & Purchase' : 'Next'}
                            </Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </LinearGradient>
                    </Pressable>
                </View>
            ) : (
                renderPurchaseFooter()
            )}
        </>
    );

    const showBackButton =
        (screenMode === 'creation' && currentStep > 0 && !isCompleted) ||
        (screenMode === 'creation' && requests.length > 0 && currentStep === 0 && !isCompleted);

    const handleHeaderBack = () => {
        if (screenMode === 'creation' && currentStep > 0) {
            handleBack();
        } else if (screenMode === 'creation' && requests.length > 0) {
            // Go back to history
            setScreenMode('history');
            setCurrentStep(0);
            setSelections({});
            setReferenceImage(null);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={handleClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    {showBackButton ? (
                        <Pressable onPress={handleHeaderBack} style={styles.headerButton} hitSlop={12}>
                            <Ionicons name="chevron-back" size={24} color="#fff" />
                        </Pressable>
                    ) : (
                        <View style={styles.headerButton} />
                    )}

                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>Custom Character</Text>
                        {screenMode === 'creation' && !isCompleted && (
                            <Text style={styles.headerStep}>
                                Step {currentStep + 1} of {TOTAL_STEPS}
                            </Text>
                        )}
                    </View>

                    <Pressable onPress={handleClose} style={styles.headerButton} hitSlop={12}>
                        <Ionicons name="close" size={24} color="rgba(255,255,255,0.7)" />
                    </Pressable>
                </View>

                {/* Progress Bar (only for creation) */}
                {screenMode === 'creation' && !isCompleted && (
                    <View style={styles.progressBarBg}>
                        <LinearGradient
                            colors={['#a855f7', '#ec4899']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.progressBarFill, { width: `${progress * 100}%` }]}
                        />
                    </View>
                )}

                {/* Content */}
                {screenMode === 'loading' && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#a855f7" />
                    </View>
                )}
                {screenMode === 'history' && renderHistoryScreen()}
                {screenMode === 'creation' && renderCreationContent()}
            </View>
        </Modal>
    );
};

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f0f14',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    headerButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    headerStep: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        marginTop: 2,
    },
    progressBarBg: {
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 16,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2,
    },

    // ─── History Screen ─────────────────────────────────────
    historyContainer: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    historyTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 4,
    },
    historySubtitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        marginBottom: 20,
    },
    historyList: {
        paddingBottom: 100,
        gap: 12,
    },
    requestCard: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    requestCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    requestCardDate: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    requestCardBody: {
        gap: 3,
    },
    requestDetail: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
    },
    requestImage: {
        width: '100%',
        height: 120,
        borderRadius: 12,
        marginTop: 10,
    },
    removeRequestBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    historyFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 16,
        backgroundColor: '#0f0f14',
    },
    newRequestButtonContainer: {
        borderRadius: 999,
        overflow: 'hidden',
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    newRequestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    newRequestButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },

    // ─── Creation Steps ─────────────────────────────────────
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 120,
    },
    stepIcon: {
        fontSize: 48,
        textAlign: 'center',
        marginBottom: 8,
    },
    stepTitle: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 6,
    },
    stepSubtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 28,
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
    },
    optionCard: {
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
        position: 'relative',
    },
    optionCardImage: {
        aspectRatio: 0.75,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
        position: 'relative',
    },
    optionImage: {
        width: '100%',
        height: '100%',
        borderRadius: 18,
    },
    optionImageOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
    },
    optionImageLabel: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    optionCardSelected: {
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 5,
    },
    optionEmoji: {
        fontSize: 28,
        marginBottom: 4,
    },
    optionLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    optionLabelSelected: {
        color: '#d8b4fe',
    },
    checkBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#a855f7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Popular badge
    popularBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        zIndex: 2,
    },
    popularBadgeText: {
        fontSize: 12,
    },

    // Quick Tags
    quickTagsSection: {
        marginBottom: 20,
    },
    quickTagsTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 10,
    },
    quickTagsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    quickTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    quickTagActive: {
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
        borderColor: '#a855f7',
    },
    quickTagText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
        fontWeight: '500',
    },
    quickTagTextActive: {
        color: '#d8b4fe',
        fontWeight: '600',
    },

    // Selection Chips
    selectionChipsScroll: {
        maxHeight: 40,
        marginBottom: 4,
    },
    selectionChipsContent: {
        paddingHorizontal: 20,
        gap: 8,
        alignItems: 'center',
    },
    selectionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.25)',
        gap: 4,
    },
    selectionChipIcon: {
        fontSize: 12,
    },
    selectionChipText: {
        color: '#d8b4fe',
        fontSize: 11,
        fontWeight: '600',
        maxWidth: 80,
    },

    textInputContainer: {
        marginTop: 8,
    },
    textInput: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: 16,
        color: '#fff',
        fontSize: 15,
        minHeight: 100,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 16,
        backgroundColor: '#0f0f14',
    },
    nextButtonContainer: {
        borderRadius: 999,
        overflow: 'hidden',
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },

    // Purchase step
    purchaseContainer: {
        alignItems: 'center',
    },
    purchaseIconWrapper: {
        marginBottom: 20,
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 5,
    },
    purchaseIconBg: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.3)',
    },
    purchaseTitle: {
        color: '#fff',
        fontSize: 26,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
    },
    purchaseSubtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
        paddingHorizontal: 8,
    },
    summaryCard: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: 16,
        width: '100%',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    summaryTitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    summaryLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
    },
    summaryValue: {
        color: '#d8b4fe',
        fontSize: 14,
        fontWeight: '600',
    },
    purchaseButtonContainer: {
        width: '100%',
        borderRadius: 999,
        overflow: 'hidden',
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 5,
    },
    purchaseButton: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    purchaseButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    purchaseButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },

    // Completed
    completedContainer: {
        alignItems: 'center',
    },
    completedEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    completedTitle: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
    },
    completedSubtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
        paddingHorizontal: 8,
    },
    doneButton: {
        width: '100%',
        borderRadius: 999,
        overflow: 'hidden',
    },
    doneButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },

    // Upload section
    uploadSectionTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        marginTop: 28,
        marginBottom: 4,
    },
    uploadSectionSubtitle: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 13,
        marginBottom: 14,
    },
    imageRow: {
        flexDirection: 'row',
        gap: 10,
        flexWrap: 'wrap',
    },
    imageThumbWrapper: {
        width: 90,
        height: 90,
        borderRadius: 14,
        overflow: 'hidden',
        position: 'relative',
    },
    imageThumb: {
        width: '100%',
        height: '100%',
    },
    imageRemoveBtn: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 11,
    },
    imageAddBtn: {
        width: 90,
        height: 90,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.12)',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    imageAddText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        marginTop: 2,
    },
    privacyNoticeContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        padding: 12,
        borderRadius: 12,
        marginTop: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    privacyNoticeText: {
        flex: 1,
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        lineHeight: 18,
    },
});
