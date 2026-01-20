import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { PurchasesPackage } from 'react-native-purchases';
import { LiquidGlassView } from '@callstack/liquid-glass';
import { VideoCacheService } from '../../services/VideoCacheService';
import { useSubscription } from '../../context/SubscriptionContext';
import { useVRMContext } from '../../context/VRMContext';
import Button from '../Button';
import { analyticsService } from '../../services/AnalyticsService';
import AssetRepository from '../../repositories/AssetRepository';
import { CharacterRepository } from '../../repositories/CharacterRepository';
import { BackgroundRepository } from '../../repositories/BackgroundRepository';

// Icons
import Icon1 from '../../assets/icons/subscriptions/4.svg';
import Icon2 from '../../assets/icons/subscriptions/2.svg';
import Icon3 from '../../assets/icons/subscriptions/3.svg';
import Icon4 from '../../assets/icons/subscriptions/5.svg';
import Icon5 from '../../assets/icons/subscriptions/1.svg';
import Icon6 from '../../assets/icons/subscriptions/6.svg';
import { IconX } from '@tabler/icons-react-native';

const { height } = Dimensions.get('window');

const DEFAULT_VIDEO_URL = 'https://pub-6671ed00c8d945b28ff7d8ec392f60b8.r2.dev/videos/Smiling_sweetly_to_202601061626_n3trm%20(online-video-cutter.com).mp4';

const SUBSCRIPTION_FEATURES = [
    { icon: Icon1, text: 'Unlimited messages, no daily limits' },
    { icon: Icon2, text: 'Access secreted photos and videos' },
    { icon: Icon3, text: '30 minutes of video calls each month' },
    { icon: Icon4, text: 'Unlock 15+ and all upcoming girlfriends' },
    { icon: Icon5, text: 'Unlimited outfits' },
    { icon: Icon6, text: 'Unlimited backgrounds' },
];

interface SubscriptionSheetProps {
    isOpened: boolean;
    onClose: () => void;
    onPurchaseSuccess?: () => void;
}

export const SubscriptionSheet: React.FC<SubscriptionSheetProps> = ({
    isOpened,
    onClose,
    onPurchaseSuccess,
}) => {
    const insets = useSafeAreaInsets();
    const { currentCharacter, currentCostume } = useVRMContext();
    const {
        isPro,
        isLoading: contextLoading,
        packages,
        packagesLoaded,
        customerInfo,
        purchasePackage,
        restorePurchases,
    } = useSubscription();

    // Map of local video assets by character order
    const LOCAL_VIDEOS: Record<number, any> = {
        1: require('../../assets/videos/1.mp4'),
        2: require('../../assets/videos/2.mp4'),
        3: require('../../assets/videos/3.mp4'),
    };

    const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [backgroundVideo, setBackgroundVideo] = useState<string | number | null>(null);
    const [activeProductId, setActiveProductId] = useState<string | null>(null);

    // Find yearly and monthly packages
    const yearlyPackage = packages.find(p =>
        p.packageType === 'ANNUAL' ||
        p.identifier.toLowerCase().includes('year') ||
        p.identifier.toLowerCase().includes('annual') ||
        p.product.title.toLowerCase().includes('year') ||
        p.product.title.toLowerCase().includes('annual')
    );
    const monthlyPackage = packages.find(p =>
        p.packageType === 'MONTHLY' ||
        p.identifier.toLowerCase().includes('month') ||
        p.product.title.toLowerCase().includes('month')
    );

    // Track view
    useEffect(() => {
        if (isOpened) {
            analyticsService.logSubscriptionView();
        }
    }, [isOpened]);

    // Load background video - prioritize local video -> costume video -> character video -> default
    // PRELOAD and CACHE video immediately
    useEffect(() => {
        const loadAndCacheVideo = async () => {
            // 1. Check for local video first based on character order
            // Cast to any to access 'order' if it's missing from the type definition
            const charWithOrder = currentCharacter as any;
            if (charWithOrder?.order) {
                const orderNum = parseInt(String(charWithOrder.order), 10);
                if (LOCAL_VIDEOS[orderNum]) {
                    console.log(`[SubscriptionSheet] Using local video for ${currentCharacter?.name} (order ${orderNum})`);
                    setBackgroundVideo(LOCAL_VIDEOS[orderNum]);
                    return;
                }
            }

            let targetUrl: string | null = null;

            // 2. Determine which remote video we WANT to show
            if (currentCostume?.video_url) {
                targetUrl = currentCostume.video_url;
            } else if (currentCharacter?.video_url) {
                targetUrl = currentCharacter.video_url;
            }

            // If no custom video, we use the default
            const finalUrl = targetUrl || DEFAULT_VIDEO_URL;

            try {
                // Try caching
                const cachedMap = await VideoCacheService.preloadVideos([finalUrl]);
                const localUri = cachedMap.get(finalUrl);

                if (localUri) {
                    setBackgroundVideo(localUri);
                } else {
                    setBackgroundVideo(finalUrl);
                }
            } catch (error) {
                console.warn('[SubscriptionSheet] Failed to cache video', error);
                setBackgroundVideo(finalUrl);
            }
        };

        loadAndCacheVideo();
    }, [currentCostume, currentCharacter]);

    // Set default selected package
    useEffect(() => {
        if (packages.length > 0 && !selectedPackage) {
            setSelectedPackage(yearlyPackage || monthlyPackage || packages[0]);
        }
    }, [packages, selectedPackage, yearlyPackage, monthlyPackage]);

    // Check active subscription product
    useEffect(() => {
        if (customerInfo) {
            const activeEntitlement = customerInfo.entitlements.active['pro'] ||
                customerInfo.entitlements.active['Pro'] ||
                customerInfo.entitlements.active['roxie_pro'];
            if (activeEntitlement) {
                setActiveProductId(activeEntitlement.productIdentifier);
            }
        }
    }, [customerInfo]);

    const handleSubscribe = async () => {
        setIsProcessing(true);

        let packageToPurchase: PurchasesPackage | null | undefined = selectedPackage;

        // Fallback: If no package selected (e.g., iPad not showing packages), fetch and pick yearly
        if (!packageToPurchase) {
            console.log('[SubscriptionSheet] No package selected. Attempting to fetch offerings...');
            try {
                const { revenueCatManager } = await import('../../services/RevenueCatManager');
                const offerings = await revenueCatManager.loadOfferings();

                if (offerings && offerings.availablePackages.length > 0) {
                    // Try to find yearly
                    packageToPurchase = offerings.availablePackages.find(
                        p => p.packageType === 'ANNUAL' ||
                            p.identifier.toLowerCase().includes('year') ||
                            p.identifier.toLowerCase().includes('annual')
                    );

                    // If no yearly, try monthly
                    if (!packageToPurchase) {
                        packageToPurchase = offerings.availablePackages.find(
                            p => p.packageType === 'MONTHLY' ||
                                p.identifier.toLowerCase().includes('month')
                        );
                    }

                    // Finally, just take the first one
                    if (!packageToPurchase) {
                        packageToPurchase = offerings.availablePackages[0];
                    }
                }
            } catch (e) {
                console.error('[SubscriptionSheet] Failed to fetch offerings fallback:', e);
            }
        }

        if (!packageToPurchase) {
            Alert.alert('Error', 'No subscription packages available at the moment.');
            setIsProcessing(false);
            return;
        }

        console.log('[SubscriptionSheet] Purchase initialized', packageToPurchase);

        // Track purchase start
        analyticsService.logPurchaseStart('subscription', packageToPurchase.identifier);

        const result = await purchasePackage(packageToPurchase);

        setIsProcessing(false);

        if (result.success) {
            // Unlock all content for PRO user
            try {
                const assetRepo = new AssetRepository();
                const charRepo = new CharacterRepository();
                const bgRepo = new BackgroundRepository();

                const [allChars, allBgs] = await Promise.all([
                    charRepo.fetchAllCharacters(),
                    bgRepo.fetchAllBackgrounds()
                ]);

                // Grant all characters
                const charPromises = allChars.map(char =>
                    assetRepo.createAsset(char.id, 'character').catch(e => console.warn('Failed to grant char:', char.id, e))
                );

                // Grant all backgrounds
                const bgPromises = allBgs.map(bg =>
                    assetRepo.createAsset(bg.id, 'background').catch(e => console.warn('Failed to grant bg:', bg.id, e))
                );

                await Promise.all([...charPromises, ...bgPromises]);
                console.log('[SubscriptionSheet] Unlocked all assets for new PRO user');
            } catch (err) {
                console.error('[SubscriptionSheet] Failed to unlock all assets:', err);
            }

            // Notify parent of successful purchase
            onPurchaseSuccess?.();

            // Track subscription purchase
            analyticsService.logSubscriptionPurchase(
                packageToPurchase.identifier,
                packageToPurchase.product.price
            );

            // Track full purchase complete event
            analyticsService.logPurchaseComplete(
                packageToPurchase.identifier,
                'subscription',
                packageToPurchase.product.price,
                packageToPurchase.product.currencyCode
            );

            onClose()
        } else if (result.error && result.error !== 'cancelled') {
            analyticsService.logPurchaseFailed('subscription', result.error);
            Alert.alert('Purchase Failed', result.error || 'Unknown error occurred');
        } else if (result.error === 'cancelled') {
            analyticsService.logPurchaseCancelled('subscription');
        }
    };

    const handleRestorePurchases = async () => {
        setIsProcessing(true);

        const result = await restorePurchases();

        setIsProcessing(false);

        if (result.isPro) {
            analyticsService.logSubscriptionRestore(true);
            // Unlock all content for Restored PRO user
            try {
                const assetRepo = new AssetRepository();
                const charRepo = new CharacterRepository();
                const bgRepo = new BackgroundRepository();

                const [allChars, allBgs] = await Promise.all([
                    charRepo.fetchAllCharacters(),
                    bgRepo.fetchAllBackgrounds()
                ]);

                // Grant all characters
                const charPromises = allChars.map(char =>
                    assetRepo.createAsset(char.id, 'character').catch(e => console.warn('Failed to grant char:', char.id, e))
                );

                // Grant all backgrounds
                const bgPromises = allBgs.map(bg =>
                    assetRepo.createAsset(bg.id, 'background').catch(e => console.warn('Failed to grant bg:', bg.id, e))
                );

                await Promise.all([...charPromises, ...bgPromises]);
                console.log('[SubscriptionSheet] Unlocked all assets for restored PRO user');
            } catch (err) {
                console.error('[SubscriptionSheet] Failed to unlock all assets during restore:', err);
            }

            // Notify parent of successful restore
            onPurchaseSuccess?.();
            Alert.alert('Success', 'Purchases restored successfully!', [
                { text: 'OK', onPress: onClose }
            ]);
        } else if (result.error) {
            analyticsService.logSubscriptionRestore(false);
            Alert.alert('Restore Failed', result.error);
        } else {
            analyticsService.logSubscriptionRestore(false);
            Alert.alert('Restore', 'No active Pro subscription found.');
        }
    };

    const videoSource = backgroundVideo || DEFAULT_VIDEO_URL;

    console.log("videoSource", videoSource)

    return (
        <Modal
            visible={isOpened}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

                {/* Background Video - Top Half */}
                <View style={styles.videoHeader}>
                    <Video
                        source={typeof videoSource === 'number' ? videoSource : { uri: videoSource }}
                        style={styles.backgroundVideo}
                        resizeMode={ResizeMode.COVER}
                        isLooping
                        shouldPlay={isOpened}
                        isMuted={true}
                    />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.8)', '#000']}
                        style={styles.gradientOverlay}
                        pointerEvents="none"
                    />
                </View>

                {/* Header with Close Button */}
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <View style={{ flex: 1 }} />
                    <Button
                        variant='liquid'
                        size="lg"
                        onPress={onClose}
                        startIcon={() => <IconX color={"black"} />}
                        style={{
                            backgroundColor: '#ffffff50'
                        }}
                        isIconOnly
                    />
                </View>

                {/* Main Content pushed to bottom */}
                <View style={styles.contentWrapper}>
                    <View style={styles.sheetContent}>
                        {/* Scrollable Section: Title + Features */}
                        <View style={styles.featuresScrollContainer}>
                            <ScrollView
                                style={styles.featuresScrollView}
                                contentContainerStyle={styles.featuresScrollContent}
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={styles.heroContent}>
                                    <LiquidGlassView style={styles.proBadgeContainer} tintColor={"rgba(0,0,0,0.7)"}>
                                        <Text style={styles.proBadgeTextName}>Roxie</Text>
                                        <LinearGradient
                                            colors={['#FFD91B', '#FFE979']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.premiumBadge}
                                        >
                                            <Text style={styles.premiumBadgeText}>Pro</Text>
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
                            </ScrollView>
                        </View>

                        {/* Fixed Bottom Section */}
                        <View style={[styles.bottomContainer, { paddingBottom: 10 }]}>
                            <View style={styles.pricingContainer}>
                                {yearlyPackage && (
                                    <Pressable
                                        style={[
                                            styles.planCard,
                                            selectedPackage?.identifier === yearlyPackage.identifier && styles.planCardSelected
                                        ]}
                                        onPress={() => {
                                            setSelectedPackage(yearlyPackage);
                                            analyticsService.logSubscriptionSelectPlan(yearlyPackage.identifier, 'Yearly');
                                        }}
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
                                        <View>
                                            <Text style={styles.planPrice}>{yearlyPackage.product.priceString}</Text>
                                            <Text style={styles.planPeriod}>per year</Text>
                                            <Text style={styles.planSubDetail}>
                                                {(yearlyPackage.product.price / 12).toLocaleString(undefined, {
                                                    style: 'currency',
                                                    currency: yearlyPackage.product.currencyCode
                                                })}/per month
                                            </Text>
                                        </View>
                                    </Pressable>
                                )}

                                {monthlyPackage && (
                                    <Pressable
                                        style={[
                                            styles.planCard,
                                            selectedPackage?.identifier === monthlyPackage.identifier && styles.planCardSelected
                                        ]}
                                        onPress={() => {
                                            setSelectedPackage(monthlyPackage);
                                            analyticsService.logSubscriptionSelectPlan(monthlyPackage.identifier, 'Monthly');
                                        }}
                                    >
                                        {activeProductId === monthlyPackage.product.identifier && (
                                            <View style={[styles.blueBadge, { backgroundColor: '#4CAF50' }]}>
                                                <Text style={styles.blueBadgeText}>ACTIVE</Text>
                                            </View>
                                        )}
                                        <Text style={styles.planName}>Monthly</Text>
                                        <View>
                                            <Text style={styles.planPrice}>{monthlyPackage.product.priceString}</Text>
                                            <Text style={styles.planPeriod}>per month</Text>
                                        </View>
                                    </Pressable>
                                )}

                                {/* Fallback if no yearly/monthly found */}
                                {!yearlyPackage && !monthlyPackage && packages.length > 0 && packages.map(pkg => (
                                    <Pressable
                                        key={pkg.identifier}
                                        style={[
                                            styles.planCard,
                                            selectedPackage?.identifier === pkg.identifier && styles.planCardSelected
                                        ]}
                                        onPress={() => {
                                            setSelectedPackage(pkg);
                                            analyticsService.logSubscriptionSelectPlan(pkg.identifier, pkg.packageType === 'ANNUAL' ? 'Yearly' : 'Monthly');
                                        }}
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

                                {(contextLoading || isProcessing) && packages.length === 0 && (
                                    <ActivityIndicator color="#FFE66D" size="large" style={{ marginVertical: 20 }} />
                                )}
                            </View>

                            <Pressable
                                style={[styles.upgradeButton, (isProcessing || contextLoading) && styles.upgradeButtonDisabled]}
                                onPress={(isProcessing || contextLoading) ? undefined : handleSubscribe}
                                disabled={isProcessing || contextLoading}
                                android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
                            >
                                <LinearGradient
                                    colors={['#FFD91B', '#FFE979']}
                                    style={styles.upgradeButtonGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    {isProcessing ? (
                                        <ActivityIndicator color="#000" />
                                    ) : (
                                        <Text style={styles.upgradeButtonText}>
                                            {isPro ? 'Update Subscription' : 'Upgrade'}
                                        </Text>
                                    )}
                                </LinearGradient>
                            </Pressable>

                            <View style={styles.footerLinks}>
                                <LinkText onPress={() => WebBrowser.openBrowserAsync('https://roxie-terms-privacy-hub.lovable.app/privacy')}>
                                    Privacy Policy
                                </LinkText>
                                <Text style={styles.footerSeparator}>|</Text>
                                <LinkText onPress={handleRestorePurchases}>Restore Purchase</LinkText>
                                <Text style={styles.footerSeparator}>|</Text>
                                <LinkText onPress={() => WebBrowser.openBrowserAsync('https://roxie-terms-privacy-hub.lovable.app/terms')}>
                                    Terms of Use
                                </LinkText>
                            </View>
                            {isPro && (
                                <Pressable
                                    style={styles.cancelButton}
                                    onPress={() => {
                                        // iTunes subscription management URL for iOS
                                        if (activeProductId) {
                                            analyticsService.logSubscriptionCancel(activeProductId);
                                        }
                                        Linking.openURL('https://apps.apple.com/account/subscriptions');
                                    }}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const LinkText: React.FC<{ onPress: () => void; children: React.ReactNode }> = ({ onPress, children }) => (
    <Pressable onPress={onPress}>
        <Text style={styles.footerLink}>{children}</Text>
    </Pressable>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    videoHeader: {
        position: 'absolute',
        top: 0,
        width: '100%',
        height: '65%', // Increased slightly to cover more background behind sheet
    },
    backgroundVideo: {
        width: '100%',
        height: '100%',
    },
    gradientOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '50%',
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        zIndex: 10,
    },
    contentWrapper: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheetContent: {
        maxHeight: '85%', // Prevent going too high
        paddingBottom: 20,
    },
    featuresScrollContainer: {
        flexShrink: 1, // Allows scrolling if content is too large
        marginBottom: 10,
    },
    featuresScrollView: {
        flexGrow: 0,
    },
    featuresScrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    heroContent: {
        alignItems: 'center',
        marginBottom: 14,
        paddingTop: 10,
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
        // Removed marginBottom as it's handled by container
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
    bottomContainer: {
        paddingHorizontal: 20,
        paddingTop: 10,
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
        flexDirection: 'column',
        justifyContent: 'space-between',
        maxWidth: '50%'
    },
    planCardSelected: {
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.15)',
    },
    blueBadge: {
        position: 'absolute',
        top: -12,
        right: -4,
        backgroundColor: '#2196F3',
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
    upgradeButtonDisabled: {
        opacity: 0.7,
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
    cancelButton: {
        marginTop: 5,
        alignItems: 'center',
        paddingVertical: 12,
    },
    cancelButtonText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        textDecorationLine: 'underline',
    },
});

export default SubscriptionSheet;
