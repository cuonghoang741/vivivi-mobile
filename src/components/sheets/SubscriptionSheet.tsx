import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { PurchasesPackage } from 'react-native-purchases';
import { LiquidGlassView } from '@callstack/liquid-glass';
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
import { useSubscription } from '../../context/SubscriptionContext';
import { useVRMContext } from '../../context/VRMContext';
import Button from '../commons/Button';
import { analyticsService } from '../../services/AnalyticsService';
import AssetRepository from '../../repositories/AssetRepository';
import { CharacterRepository } from '../../repositories/CharacterRepository';
import { BackgroundRepository } from '../../repositories/BackgroundRepository';
import { PreviewVRM } from '../commons/PreviewVRM';

// Icons
import {
    IconX,
    IconCube3dSphere,
    IconVideo,
    IconLock,
    IconUsers,
    IconSparkles,
    IconHeart
} from '@tabler/icons-react-native';

const SUBSCRIPTION_FEATURES = [
    { icon: IconCube3dSphere, text: 'Full 3D VRM interaction experience', color: '#FF416C' },
    { icon: IconVideo, text: 'Unlimited HD Video Calls anytime', color: '#9C27B0' },
    { icon: IconLock, text: 'Unlock all secret & exclusive content', color: '#FF9800' },
    { icon: IconUsers, text: 'Access every character instantly', color: '#4CAF50' },
    { icon: IconSparkles, text: 'Premium costumes & animations', color: '#2196F3' },
    { icon: IconHeart, text: 'Deeper intimacy & special moments', color: '#E91E63' },
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
    const { currentCharacter, initialData } = useVRMContext();
    const activeCharacterId = currentCharacter?.id || initialData?.character?.id;
    const {
        isPro,
        isLoading: contextLoading,
        packages,
        customerInfo,
        purchasePackage,
        restorePurchases,
    } = useSubscription();

    const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeProductId, setActiveProductId] = useState<string | null>(null);

    // Find yearly and monthly packages
    const yearlyPackage = packages.find(p =>
        p.packageType === 'ANNUAL' ||
        p.packageType === 'LIFETIME' ||
        p.identifier.toLowerCase().includes('year') ||
        p.identifier.toLowerCase().includes('annual') ||
        p.product.title.toLowerCase().includes('year') ||
        p.product.title.toLowerCase().includes('annual') ||
        p.product.identifier.toLowerCase().includes('year') ||
        p.product.identifier.toLowerCase().includes('annual')
    );
    const monthlyPackage = packages.find(p =>
        p.packageType === 'MONTHLY' ||
        p.identifier.toLowerCase().includes('month') ||
        p.product.title.toLowerCase().includes('month') ||
        p.product.identifier.toLowerCase().includes('month')
    );

    // Calculate discount percentage
    const discountPercentage = React.useMemo(() => {
        if (!yearlyPackage || !monthlyPackage) return null;

        const monthlyPrice = monthlyPackage.product.price;
        const yearlyPrice = yearlyPackage.product.price;

        if (monthlyPrice <= 0) return null;

        const yearlyCostOfMonthly = monthlyPrice * 12;
        const savings = yearlyCostOfMonthly - yearlyPrice;
        const percentage = Math.round((savings / yearlyCostOfMonthly) * 100);

        if (percentage <= 0) return null;

        return `${percentage}% OFF`;
    }, [yearlyPackage, monthlyPackage]);

    // Track view
    useEffect(() => {
        if (isOpened) {
            analyticsService.logSubscriptionView();
        }
    }, [isOpened]);

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
                customerInfo.entitlements.active['lusty_pro'];
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
                            p.packageType === 'LIFETIME' ||
                            p.identifier.toLowerCase().includes('year') ||
                            p.identifier.toLowerCase().includes('annual') ||
                            p.product.identifier.toLowerCase().includes('year') ||
                            p.product.identifier.toLowerCase().includes('annual')
                    );

                    // If no yearly, try monthly
                    if (!packageToPurchase) {
                        packageToPurchase = offerings.availablePackages.find(
                            p => p.packageType === 'MONTHLY' ||
                                p.identifier.toLowerCase().includes('month') ||
                                p.product.identifier.toLowerCase().includes('month')
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

                // Grant all characters (filter out coming soon)
                const charPromises = allChars
                    .filter(char => char.available !== false)
                    .map(char =>
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

                // Grant all characters (filter out coming soon)
                const charPromises = allChars
                    .filter(char => char.available !== false)
                    .map(char =>
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

    // Filter for premium characters to show in preview
    const premiumCharacterFilter = (c: any) => c.available && c.order;

    return (
        <Modal
            visible={isOpened}
            animationType="fade"
            presentationStyle="overFullScreen"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

                {/* Background: VRM Preview + Gradient */}
                <View style={styles.backgroundContainer}>
                    {isOpened && (
                        <PreviewVRM
                            showActionButtons={false}
                            showNavigation={false}
                            characterFilter={premiumCharacterFilter}
                            initialCharacterId={activeCharacterId}
                        />
                    )}
                    <LinearGradient
                        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', '#000000']}
                        locations={[0, 0.5, 0.9]}
                        style={StyleSheet.absoluteFill}
                    />
                </View>

                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <Pressable
                        onPress={onClose}
                        style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                    >
                        <BlurView intensity={40} tint="dark" style={styles.closeButtonInner}>
                            <IconX color="#fff" size={22} />
                        </BlurView>
                    </Pressable>
                </View>

                {/* Main Content */}
                <View style={styles.mainContent}>
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {/* Hero Section */}
                        <View style={styles.heroSection}>
                            <LiquidGlassView
                                style={styles.proBadge}
                                tintColor="rgba(255, 65, 108, 0.3)"
                            >
                                <LinearGradient
                                    colors={['#FF416C', '#FF4B2B']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={[StyleSheet.absoluteFill, { opacity: 0.8 }]}
                                />
                                <Text style={styles.proBadgeText}>LUSTY PRO</Text>
                            </LiquidGlassView>

                            <Text style={styles.heroTitle}>Unlock Your{'\n'}Ultimate Fantasy</Text>
                            <Text style={styles.heroSubtitle}>
                                Experience unlimited intimacy, exclusive content, and deeper connections.
                            </Text>
                        </View>

                        {/* Features List */}
                        <View style={styles.featuresContainer}>
                            {SUBSCRIPTION_FEATURES.map((feature, index) => (
                                <View key={index} style={styles.featureItem}>
                                    <View style={[styles.featureIcon, { backgroundColor: feature.color + '20' }]}>
                                        <feature.icon size={20} color={feature.color} />
                                    </View>
                                    <Text style={styles.featureText}>{feature.text}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Spacer for bottom section */}
                        <View style={{ height: 180 }} />
                    </ScrollView>

                    {/* Fixed Bottom Selection Panel */}
                    <BlurView intensity={80} tint="dark" style={[styles.bottomPanel, { paddingBottom: insets.bottom + 10 }]}>
                        {/* Plan Selection */}
                        <View style={styles.plansContainer}>
                            {/* Monthly Plan */}
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
                                    <View style={styles.planInfo}>
                                        <Text style={[styles.planName, selectedPackage?.identifier === monthlyPackage.identifier && styles.textHighlight]}>Monthly</Text>
                                        <Text style={styles.planPrice}>{monthlyPackage.product.priceString}</Text>
                                    </View>
                                    <View style={[styles.radioButton, selectedPackage?.identifier === monthlyPackage.identifier && styles.radioButtonSelected]} />
                                </Pressable>
                            )}

                            {/* Yearly Plan */}
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
                                    {discountPercentage && (
                                        <View style={styles.discountBadge}>
                                            <Text style={styles.discountText}>SAVE {discountPercentage}</Text>
                                        </View>
                                    )}
                                    <View style={styles.planInfo}>
                                        <Text style={[styles.planName, selectedPackage?.identifier === yearlyPackage.identifier && styles.textHighlight]}>Yearly</Text>
                                        <Text style={styles.planPrice}>{yearlyPackage.product.priceString}</Text>
                                        <Text style={styles.perMonthText}>
                                            {(yearlyPackage.product.price / 12).toLocaleString(undefined, {
                                                style: 'currency',
                                                currency: yearlyPackage.product.currencyCode
                                            })}/mo
                                        </Text>
                                    </View>
                                    <View style={[styles.radioButton, selectedPackage?.identifier === yearlyPackage.identifier && styles.radioButtonSelected]} />
                                </Pressable>
                            )}
                        </View>

                        {/* Fallback Only */}
                        {!yearlyPackage && !monthlyPackage && packages.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                                {packages.map(pkg => (
                                    <Pressable
                                        key={pkg.identifier}
                                        style={[
                                            styles.planCard,
                                            { width: 140, marginRight: 10 },
                                            selectedPackage?.identifier === pkg.identifier && styles.planCardSelected
                                        ]}
                                        onPress={() => setSelectedPackage(pkg)}
                                    >
                                        <Text style={styles.planName}>{pkg.packageType}</Text>
                                        <Text style={styles.planPrice}>{pkg.product.priceString}</Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        )}

                        {/* CTA Button */}
                        <Pressable
                            style={[styles.ctaButton, (isProcessing || contextLoading) && styles.disabledButton]}
                            onPress={(isProcessing || contextLoading) ? undefined : handleSubscribe}
                        >
                            <LinearGradient
                                colors={['#FF416C', '#FF4B2B']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.ctaGradient}
                            >
                                {isProcessing ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.ctaText}>
                                        {isPro ? 'Update Plan' : 'Unlock Lusty Pro'}
                                    </Text>
                                )}
                            </LinearGradient>
                        </Pressable>

                        {/* Footer Links */}
                        <View style={styles.footerLinks}>
                            <Pressable onPress={handleRestorePurchases}>
                                <Text style={styles.footerLinkText}>Restore</Text>
                            </Pressable>
                            <Text style={styles.footerDot}>•</Text>
                            <Pressable onPress={() => WebBrowser.openBrowserAsync('https://lusty-legal-pages.lovable.app/terms')}>
                                <Text style={styles.footerLinkText}>Terms</Text>
                            </Pressable>
                            <Text style={styles.footerDot}>•</Text>
                            <Pressable onPress={() => WebBrowser.openBrowserAsync('https://lusty-legal-pages.lovable.app/privacy')}>
                                <Text style={styles.footerLinkText}>Privacy</Text>
                            </Pressable>
                        </View>

                        {isPro && activeProductId && (
                            <Pressable
                                onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
                                style={{ marginTop: 8 }}
                            >
                                <Text style={[styles.footerLinkText, { opacity: 0.5, fontSize: 11 }]}>Manage Subscription</Text>
                            </Pressable>
                        )}
                    </BlurView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    backgroundContainer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
    },
    closeButton: {
        overflow: 'hidden',
        borderRadius: 20,
    },
    closeButtonInner: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pressed: {
        opacity: 0.8,
        transform: [{ scale: 0.95 }],
    },
    mainContent: {
        flex: 1,
        zIndex: 10,
    },
    scrollContent: {
        paddingTop: 100, // Make space for header/top
        paddingHorizontal: 24,
    },
    heroSection: {
        marginBottom: 32,
        alignItems: 'flex-start',
    },
    proBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
    },
    proBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
    },
    heroTitle: {
        color: '#fff',
        fontSize: 42,
        fontWeight: '900',
        lineHeight: 46,
        marginBottom: 12,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 10,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '500',
    },
    featuresContainer: {
        gap: 16,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    featureIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    featureText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
    },
    bottomPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingTop: 24,
        paddingHorizontal: 24,
        overflow: 'hidden', // Essential for BlurView
    },
    plansContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    planCard: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.1)',
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    planCardSelected: {
        borderColor: '#FF416C',
        backgroundColor: 'rgba(255, 65, 108, 0.1)',
    },
    radioButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    radioButtonSelected: {
        borderColor: '#FF416C',
        backgroundColor: '#FF416C',
    },
    planInfo: {
        flex: 1,
    },
    planName: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    textHighlight: {
        color: '#FF416C',
    },
    planPrice: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    perMonthText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        marginTop: 2,
    },
    discountBadge: {
        position: 'absolute',
        top: -10,
        right: 12,
        backgroundColor: '#4CAF50',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    discountText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
    },
    ctaButton: {
        borderRadius: 28,
        overflow: 'hidden',
        marginBottom: 16,
        shadowColor: '#FF416C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    disabledButton: {
        opacity: 0.7,
    },
    ctaGradient: {
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    footerLinks: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0.7,
    },
    footerLinkText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
    },
    footerDot: {
        color: '#fff',
        marginHorizontal: 10,
        fontSize: 10,
    },
});

export default SubscriptionSheet;
