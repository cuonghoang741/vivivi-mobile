
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    Platform,
    StatusBar,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getSupabaseClient } from '../services/supabase';
import { revenueCatManager } from '../services/RevenueCatManager';
import Purchases, { PurchasesPackage } from 'react-native-purchases';


import { Video, ResizeMode } from 'expo-av';
import { useVRMContext } from '../context/VRMContext';
import { CostumeRepository } from '../repositories/CostumeRepository';
import { UserCharacterPreferenceService } from '../services/UserCharacterPreferenceService';

// Icons
import Icon1 from '../assets/icons/subscriptions/4.svg';
import Icon2 from '../assets/icons/subscriptions/2.svg';
import Icon3 from '../assets/icons/subscriptions/3.svg';
import Icon4 from '../assets/icons/subscriptions/5.svg';
import Icon5 from '../assets/icons/subscriptions/1.svg';
import Icon6 from '../assets/icons/subscriptions/6.svg';
import { LiquidGlassView } from '@callstack/liquid-glass';
import Button from '../components/Button';

const { width } = Dimensions.get('window');

type SubscriptionTier = 'free' | 'pro';

const SUBSCRIPTION_FEATURES = [
    { icon: Icon1, text: 'Unlimited messages, no daily limits' },
    { icon: Icon2, text: 'Access secreted photos and videos' },
    { icon: Icon3, text: '30 minutes of video calls each month' },
    { icon: Icon4, text: 'Unlock all of 15+ girlfriends' },
    { icon: Icon5, text: 'Unlimited outfits' },
    { icon: Icon6, text: 'Unlimited backgrounds' },
];

export const SubscriptionScreen: React.FC = () => {
    const navigation = useNavigation();
    const { currentCharacter } = useVRMContext();
    const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
    const [packages, setPackages] = useState<PurchasesPackage[]>([]);
    const [backgroundVideo, setBackgroundVideo] = useState<string | null>(null);
    const [activeProductId, setActiveProductId] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);

            // 1. Load Subscription Tier
            const cached = await AsyncStorage.getItem('subscription.tier');
            if (cached) {
                setSubscriptionTier(normalizeTier(cached));
            }

            const supabase = await getSupabaseClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const { data } = await supabase
                    .from('subscriptions')
                    .select('tier')
                    .eq('user_id', user.id)
                    .maybeSingle();

                const tier = normalizeTier(data?.tier);
                setSubscriptionTier(tier);
                await AsyncStorage.setItem('subscription.tier', tier);
            }

            // 2. Load RevenueCat Offerings
            const offerings = await revenueCatManager.loadOfferings();
            if (offerings && offerings.availablePackages.length > 0) {
                setPackages(offerings.availablePackages);
                // Default to yearly if available, otherwise first available
                const yearly = offerings.availablePackages.find(
                    p => p.packageType === 'ANNUAL' || p.identifier.toLowerCase().includes('year')
                );
                const monthly = offerings.availablePackages.find(
                    p => p.packageType === 'MONTHLY' || p.identifier.toLowerCase().includes('month')
                );

                // Construct logic to sort or pick default? 
                // The design defaults to Yearly
                setSelectedPackage(yearly || monthly || offerings.availablePackages[0]);
            }

            // 3. Load Background Video if available
            if (currentCharacter) {
                try {
                    const prefs = await UserCharacterPreferenceService.loadUserCharacterPreference(currentCharacter.id);
                    const costumeId = prefs?.costumeId || (currentCharacter as any).default_costume_id;

                    if (costumeId) {
                        const costumeRepo = new CostumeRepository();
                        const costume = await costumeRepo.fetchCostumeById(costumeId);
                        if (costume?.video_url) {
                            setBackgroundVideo(costume.video_url);
                        }
                    }
                } catch (e) {
                    console.warn('[SubscriptionScreen] Failed to load character costume video:', e);
                }
            }

            // 4. Check active subscription
            try {
                const customerInfo = await Purchases.getCustomerInfo();
                const activeEntitlement = customerInfo.entitlements.active['pro'] ||
                    customerInfo.entitlements.active['Pro'] ||
                    customerInfo.entitlements.active['roxie_pro'];
                if (activeEntitlement) {
                    setActiveProductId(activeEntitlement.productIdentifier);
                }
            } catch (e) {
                console.warn('Failed to get customer info', e);
            }

        } catch (err) {
            console.warn('[SubscriptionScreen] Failed to load data', err);
        } finally {
            setIsLoading(false);
        }
    }, [currentCharacter]); // Added currentCharacter dependency

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSubscribe = async () => {
        if (!selectedPackage) return;

        try {
            setIsLoading(true);
            const { customerInfo } = await revenueCatManager.purchasePackage(selectedPackage);
            const isPro = customerInfo.entitlements.active['pro'] ||
                customerInfo.entitlements.active['Pro'] ||
                customerInfo.entitlements.active['roxie_pro'];

            if (isPro) {
                setSubscriptionTier('pro');
                await AsyncStorage.setItem('subscription.tier', 'pro');
                Alert.alert('Success', 'You are now a Pro member!', [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]);
            } else {
                Alert.alert('Purchase Successful', 'Your purchase was successful, but we could not verify your Pro status immediately. Please check "Restore".');
            }
        } catch (e: any) {
            if (!e.userCancelled) {
                Alert.alert('Purchase Failed', e.message || 'Unknown error occurred');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestorePurchases = async () => {
        try {
            setIsLoading(true);
            const customerInfo = await revenueCatManager.restorePurchases();
            const isPro = customerInfo.entitlements.active['pro'] ||
                customerInfo.entitlements.active['Pro'] ||
                customerInfo.entitlements.active['roxie_pro'];

            if (isPro) {
                setSubscriptionTier('pro');
                await AsyncStorage.setItem('subscription.tier', 'pro');
                Alert.alert('Success', 'Purchases restored successfully!', [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]);
            } else {
                Alert.alert('Restore', 'No active Pro subscription found.');
            }
        } catch (e: any) {
            Alert.alert('Restore Failed', e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const yearlyPackage = packages.find(p => p.packageType === 'ANNUAL' || p.identifier.toLowerCase().includes('year'));
    const monthlyPackage = packages.find(p => p.packageType === 'MONTHLY' || p.identifier.toLowerCase().includes('month'));

    // Handle background render
    const renderBackground = () => {
        const videoSource = backgroundVideo || 'https://pub-6671ed00c8d945b28ff7d8ec392f60b8.r2.dev/videos/Smiling_sweetly_to_202601061626_n3trm%20(online-video-cutter.com).mp4';

        return (
            <Video
                source={{ uri: videoSource }}
                style={styles.backgroundImage}
                resizeMode={ResizeMode.COVER}
                isLooping
                shouldPlay
                isMuted={true}
            />
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Background Video - Top Half */}
            <View style={styles.videoHeader}>
                {renderBackground()}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)', '#000']}
                    style={styles.gradientOverlay}
                    pointerEvents="none"
                />
            </View>

            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.header}>
                    <Button variant='liquid' size="xl" onPress={() => navigation.goBack()} startIconName='close' isIconOnly />
                </View>

                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.heroContent}>
                        <LiquidGlassView style={styles.proBadgeContainer} tintColor={"rgba(0,0,0,0.7)"}>
                            <Text style={styles.proBadgeTextName}>Roxie</Text>
                            <LinearGradient
                                colors={['#FFD91B', '#FFE979']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.premiumBadge}
                            >
                                <Text style={styles.premiumBadgeText}>Premium</Text>
                            </LinearGradient>
                        </LiquidGlassView>
                        <Text style={styles.title}>Stay With Me{'\n'}Without Limits</Text>
                    </View>

                    <View style={styles.featuresList}>
                        {SUBSCRIPTION_FEATURES.map((feature, index) => (
                            <View key={index} style={styles.featureRow}>
                                <feature.icon width={24} height={24} fill="#fff" style={{ marginRight: 12 }} />
                                <Text style={styles.featureText}>{feature.text}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.pricingContainer}>
                        {yearlyPackage && (
                            <Pressable
                                style={[styles.planCard, selectedPackage?.identifier === yearlyPackage.identifier && styles.planCardSelected]}
                                onPress={() => setSelectedPackage(yearlyPackage)}
                            >
                                {activeProductId === yearlyPackage.product.identifier ? (
                                    <View style={[styles.blueBadge, { backgroundColor: '#4CAF50' }]}>
                                        <Text style={styles.blueBadgeText}>ACTIVE</Text>
                                    </View>
                                ) : (selectedPackage?.identifier === yearlyPackage.identifier && (
                                    <View style={styles.blueBadge}>
                                        <Text style={styles.blueBadgeText}>80% OFF</Text>
                                    </View>
                                ))}
                                <Text style={styles.planName}>Yearly</Text>
                                <Text style={styles.planPrice}>{yearlyPackage.product.priceString}</Text>
                                <Text style={styles.planPeriod}>per year</Text>
                                <Text style={styles.planSubDetail}>{(yearlyPackage.product.price / 12).toLocaleString(undefined, { style: 'currency', currency: yearlyPackage.product.currencyCode })}/per month</Text>
                            </Pressable>
                        )}

                        {monthlyPackage && (
                            <Pressable
                                style={[styles.planCard, selectedPackage?.identifier === monthlyPackage.identifier && styles.planCardSelected]}
                                onPress={() => setSelectedPackage(monthlyPackage)}
                            >
                                {activeProductId === monthlyPackage.product.identifier && (
                                    <View style={[styles.blueBadge, { backgroundColor: '#4CAF50' }]}>
                                        <Text style={styles.blueBadgeText}>ACTIVE</Text>
                                    </View>
                                )}
                                <Text style={styles.planName}>Monthly</Text>
                                <Text style={styles.planPrice}>{monthlyPackage.product.priceString}</Text>
                                <Text style={styles.planPeriod}>per month</Text>
                            </Pressable>
                        )}

                        {!yearlyPackage && !monthlyPackage && packages.length > 0 && packages.map(pkg => (
                            <Pressable
                                key={pkg.identifier}
                                style={[styles.planCard, selectedPackage?.identifier === pkg.identifier && styles.planCardSelected]}
                                onPress={() => setSelectedPackage(pkg)}
                            >
                                {activeProductId === pkg.product.identifier && (
                                    <View style={[styles.blueBadge, { backgroundColor: '#4CAF50' }]}>
                                        <Text style={styles.blueBadgeText}>ACTIVE</Text>
                                    </View>
                                )}
                                <Text style={styles.planName}>{pkg.packageType === 'ANNUAL' ? 'Yearly' : 'Monthly'}</Text>
                                <Text style={styles.planPrice}>{pkg.product.priceString}</Text>
                            </Pressable>
                        ))}

                        {isLoading && packages.length === 0 && (
                            <ActivityIndicator color="#FFE66D" size="large" style={{ marginVertical: 20 }} />
                        )}
                    </View>

                    <Pressable
                        style={styles.upgradeButton}
                        onPress={handleSubscribe}
                        android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
                    >
                        <LinearGradient
                            colors={['#FFD91B', '#FFE979']}
                            style={styles.upgradeButtonGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text style={styles.upgradeButtonText}>
                                {subscriptionTier === 'pro' ? 'Update Subscription' : 'Upgrade'}
                            </Text>
                        </LinearGradient>
                    </Pressable>

                    <View style={styles.footerLinks}>
                        <LinkText onPress={() => Linking.openURL('https://roxie.ai/privacy')}>Privacy Policy</LinkText>
                        <Text style={styles.footerSeparator}>|</Text>
                        <LinkText onPress={handleRestorePurchases}>Restore Purchase</LinkText>
                        <Text style={styles.footerSeparator}>|</Text>
                        <LinkText onPress={() => Linking.openURL('https://roxie.ai/terms')}>Terms of Use</LinkText>
                    </View>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

const LinkText: React.FC<{ onPress: () => void, children: React.ReactNode }> = ({ onPress, children }) => (
    <Pressable onPress={onPress}>
        <Text style={styles.footerLink}>{children}</Text>
    </Pressable>
);

const normalizeTier = (tier?: string | null): SubscriptionTier => {
    const normalized = (tier ?? '').toLowerCase();
    if (normalized === 'pro' || normalized.includes('pro')) {
        return 'pro';
    }
    return 'free';
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    videoHeader: {
        position: 'absolute',
        top: 0,
        width: '100%',
        height: '50%',
    },
    backgroundImage: {
        width: '100%',
        height: '100%',
    },
    gradientOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 150,
        width: '100%',
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: '35%', // Push content down to overlap properly with ~50% video
    },
    heroContent: {
        alignItems: 'center',
        marginBottom: 14,
    },
    proBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        gap: 8,
    },
    proBadgeTextName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    premiumBadge: {
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    premiumBadgeText: {
        color: '#000',
        fontSize: 12,
        fontWeight: '700',
    },
    title: {
        color: '#fff',
        fontSize: 34,
        fontWeight: '800',
        textAlign: 'center',
        lineHeight: 42,
    },
    featuresList: {
        marginBottom: 14,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    featureText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
    },
    pricingContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    planCard: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    planCardSelected: {
        borderColor: '#2196F3', // Blue selection border from design
        backgroundColor: 'rgba(33, 150, 243, 0.15)',
    },
    blueBadge: {
        position: 'absolute',
        top: -12,
        right: -4,
        backgroundColor: '#2196F3', // Blue badge
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    blueBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    planName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    planPrice: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 2,
    },
    planPeriod: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        marginBottom: 4,
    },
    planSubDetail: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
    },
    upgradeButton: {
        borderRadius: 30,
        overflow: 'hidden',
        marginBottom: 24,
    },
    upgradeButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    upgradeButtonText: {
        color: '#000',
        fontSize: 18,
        fontWeight: '700',
    },
    footerLinks: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    footerLink: {
        color: '#fff',
        fontSize: 12,
    },
    footerSeparator: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 12,
    },
    manageButton: {
        alignItems: 'center',
        marginBottom: 24,
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    manageButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
