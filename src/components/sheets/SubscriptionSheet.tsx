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
                customerInfo.entitlements.active['evee_pro'];
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
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

                {/* VRM Preview - Top Half */}
                <View style={styles.vrmHeader}>
                    {isOpened && (
                        <PreviewVRM
                            showActionButtons={true}
                            showNavigation={true}
                            characterFilter={premiumCharacterFilter}
                            initialCharacterId={activeCharacterId}
                        />
                    )}
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
                        {/* Blur Background */}
                        <MaskedView
                            style={StyleSheet.absoluteFill}
                            maskElement={
                                <LinearGradient
                                    colors={['transparent', '#000']}
                                    locations={[0, 0.4]}
                                    style={StyleSheet.absoluteFill}
                                />
                            }
                        >
                            <BlurView
                                intensity={80}
                                tint="dark"
                                style={StyleSheet.absoluteFill}
                            />
                        </MaskedView>

                        {/* Scrollable Section: Title + Features */}
                        <View style={styles.featuresScrollContainer}>
                            <ScrollView
                                style={styles.featuresScrollView}
                                contentContainerStyle={styles.featuresScrollContent}
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={styles.heroContent}>
                                    <LiquidGlassView style={styles.proBadgeContainer} tintColor={"rgba(0,0,0,0.7)"}>
                                        <Text style={styles.proBadgeTextName}>Evee</Text>
                                        <LinearGradient
                                            colors={['#FF416C', '#FF4B2B']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.premiumBadge}
                                        >
                                            <Text style={styles.premiumBadgeText}>Pro</Text>
                                        </LinearGradient>
                                    </LiquidGlassView>
                                    <Text style={styles.title}>Ultimate Experience</Text>
                                    <Text style={styles.subtitle}>Unlock the full 3D intimate world</Text>
                                </View>

                                <View style={styles.featuresList}>
                                    {SUBSCRIPTION_FEATURES.map((feature, index) => (
                                        <View key={index} style={styles.featureRow}>
                                            <View style={[styles.featureIconContainer, { backgroundColor: feature.color + '20' }]}>
                                                <feature.icon size={20} color={feature.color} />
                                            </View>
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
                                        ) : (selectedPackage?.identifier === yearlyPackage.identifier && discountPercentage && (
                                            <View style={styles.blueBadge}>
                                                <Text style={styles.blueBadgeText}>{discountPercentage}</Text>
                                            </View>
                                        ))}
                                        <Text style={styles.planName}>Yearly</Text>
                                        <View>
                                            <Text style={styles.planPrice}>{yearlyPackage.product.priceString}</Text>
                                            <Text style={styles.planPeriod}>12 months</Text>
                                            <Text style={styles.planSubDetail}>
                                                {(yearlyPackage.product.price / 12).toLocaleString(undefined, {
                                                    style: 'currency',
                                                    currency: yearlyPackage.product.currencyCode
                                                })}/month
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
                                            <Text style={styles.planPeriod}>month-to-month</Text>
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
                            </View>

                            <Pressable
                                style={[styles.upgradeButton, (isProcessing || contextLoading) && styles.upgradeButtonDisabled]}
                                onPress={(isProcessing || contextLoading) ? undefined : handleSubscribe}
                                disabled={isProcessing || contextLoading}
                                android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
                            >
                                <LinearGradient
                                    colors={['#FF416C', '#FF4B2B']}
                                    style={styles.upgradeButtonGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    {isProcessing ? (
                                        <ActivityIndicator color="#000" />
                                    ) : (
                                        <Text style={styles.upgradeButtonText}>
                                            {isPro ? 'Update Subscription' : 'Unlock Premium Access'}
                                        </Text>
                                    )}
                                </LinearGradient>
                            </Pressable>

                            <View style={styles.footerLinks}>
                                <LinkText onPress={() => WebBrowser.openBrowserAsync('https://eve-privacy.lovable.app/privacy')}>
                                    Privacy Policy
                                </LinkText>
                                <Text style={styles.footerSeparator}>|</Text>
                                <LinkText onPress={handleRestorePurchases}>Restore Purchase</LinkText>
                                <Text style={styles.footerSeparator}>|</Text>
                                <LinkText onPress={() => WebBrowser.openBrowserAsync('https://eve-privacy.lovable.app/terms')}>
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
    vrmHeader: {
        position: 'absolute',
        top: 0,
        width: '100%',
        height: '100%',
    },
    // gradientOverlay removed
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
        color: '#fff',
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
    subtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 4,
    },
    featuresList: {
        // Removed marginBottom as it's handled by container
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    featureIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
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
        borderRadius: 20,
        padding: 16,
        borderWidth: 2,
        borderColor: 'transparent',
        flexDirection: 'column',
        justifyContent: 'space-between',
        maxWidth: '50%'
    },
    planCardSelected: {
        borderColor: '#FF416C',
        backgroundColor: 'rgba(255, 65, 108, 0.15)',
    },
    blueBadge: {
        position: 'absolute',
        top: -12,
        right: -4,
        backgroundColor: '#FF416C',
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
        color: '#fff',
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
