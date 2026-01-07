import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '../Button';
import { getSupabaseClient } from '../../services/supabase';
import { revenueCatManager } from '../../services/RevenueCatManager';
import { PurchasesPackage } from 'react-native-purchases';

const DIAMOND_ICON_URL = 'https://d1j8r0kxyu9tj8.cloudfront.net/files/gHCihrZqs0a7K0rms5qSXE1TRs8FuWwPWaEeLIey.png';

type SubscriptionTier = 'free' | 'pro';

const SUBSCRIPTION_LABELS: Record<SubscriptionTier, string> = {
    free: 'Free plan',
    pro: 'Roxie Pro',
};

type BillingPeriod = 'monthly' | 'yearly';

type SubscriptionPlan = {
    id: string;
    productId: string;
    billingPeriod: BillingPeriod;
    price: string;
    pricePerMonth?: string;
    savings?: string;
    recommended?: boolean;
};

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
    {
        id: 'monthly',
        productId: 'monthly', // Matching RC identifier if possible, or map it
        billingPeriod: 'monthly',
        price: '$9.99 / month',
    },
    {
        id: 'yearly',
        productId: 'yearly', // Matching RC identifier
        billingPeriod: 'yearly',
        price: '$59.99 / year',
        pricePerMonth: '$5/mo',
        savings: 'Save 50%',
        recommended: true,
    },
];

const PRO_FEATURES = [
    'Unlock all characters & costumes',
    'Unlock all backgrounds',
    'Unlimited conversations',
    'Priority support',
];

interface SubscriptionSheetProps {
    isOpened: boolean;
    onClose: () => void;
}

export const SubscriptionSheet: React.FC<SubscriptionSheetProps> = ({
    isOpened,
    onClose,
}) => {
    const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
    const [packages, setPackages] = useState<PurchasesPackage[]>([]);

    const tierLabel = SUBSCRIPTION_LABELS[subscriptionTier];
    const isFree = subscriptionTier === 'free';

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
                setSelectedPackage(yearly || offerings.availablePackages[0]);
            }

        } catch (err) {
            console.warn('[SubscriptionSheet] Failed to load data', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpened) {
            loadData();
        }
    }, [isOpened, loadData]);

    const handleSubscribe = async () => {
        if (!selectedPackage) return;

        try {
            setIsLoading(true);
            console.log('[SubscriptionSheet] Purchase initialized', selectedPackage);
            const { customerInfo } = await revenueCatManager.purchasePackage(selectedPackage);
            console.log('[SubscriptionSheet] Purchase completed. CustomerInfo:', JSON.stringify(customerInfo, null, 2));

            const isPro = customerInfo.entitlements.active['pro'] ||
                customerInfo.entitlements.active['Pro'] ||
                customerInfo.entitlements.active['roxie_pro'];

            if (isPro) {
                setSubscriptionTier('pro');
                await AsyncStorage.setItem('subscription.tier', 'pro');
                Alert.alert('Success', 'You are now a Pro member!', [
                    { text: 'OK', onPress: onClose }
                ]);
            } else {
                console.warn('[SubscriptionSheet] Purchase successful but no active entitlement found. Active:', Object.keys(customerInfo.entitlements.active));
                Alert.alert('Purchase Successful', 'Your purchase was successful, but we could not verify your Pro status immediately. Please try "Restore" or contact support.');
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
            console.log('[SubscriptionSheet] Restore completed. CustomerInfo:', JSON.stringify(customerInfo, null, 2));

            const isPro = customerInfo.entitlements.active['pro'] ||
                customerInfo.entitlements.active['Pro'] ||
                customerInfo.entitlements.active['roxie_pro'];

            if (isPro) {
                setSubscriptionTier('pro');
                await AsyncStorage.setItem('subscription.tier', 'pro');
                Alert.alert('Success', 'Purchases restored successfully!', [
                    { text: 'OK', onPress: onClose }
                ]);
            } else {
                console.warn('[SubscriptionSheet] Restore successful but no active entitlement found. Active:', Object.keys(customerInfo.entitlements.active));
                Alert.alert('Restore', 'No active Pro subscription found.');
            }
        } catch (e: any) {
            Alert.alert('Restore Failed', e.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper to format package for display
    const renderPackageOption = (pkg: PurchasesPackage) => {
        const isSelected = selectedPackage?.identifier === pkg.identifier;
        const isYearly = pkg.packageType === 'ANNUAL' || pkg.identifier.toLowerCase().includes('year');
        const pricePerMonth = isYearly
            ? (pkg.product.price / 12).toLocaleString(undefined, { style: 'currency', currency: pkg.product.currencyCode })
            : null;

        return (
            <Pressable
                key={pkg.identifier}
                style={[
                    styles.planOption,
                    isSelected && styles.planOptionSelected,
                ]}
                onPress={() => setSelectedPackage(pkg)}
            >
                {isYearly && (
                    <View style={styles.savingsBadge}>
                        <Text style={styles.savingsText}>Save 50%</Text>
                    </View>
                )}
                <View style={styles.planContent}>
                    <Text style={styles.planPeriod}>
                        {isYearly ? 'Yearly' : 'Monthly'}
                    </Text>
                    <Text style={styles.planPrice}>{pkg.product.priceString}</Text>
                    {pricePerMonth && (
                        <Text style={styles.planPricePerMonth}>{`${pricePerMonth} / mo`}</Text>
                    )}
                </View>
                <View style={styles.radioButton}>
                    {isSelected && <View style={styles.radioButtonInner} />}
                </View>
            </Pressable>
        );
    };

    return (
        <Modal
            visible={isOpened}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Pressable style={styles.closeButton} onPress={onClose}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </Pressable>
                    <View style={styles.headerTitleRow}>
                        <Image source={{ uri: DIAMOND_ICON_URL }} style={{ width: 18, height: 18 }} />
                        <Text style={styles.headerTitle}>Roxie Pro</Text>
                    </View>
                    <View style={{ width: 44 }} />
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {isLoading && packages.length === 0 ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#FF5D9D" />
                        </View>
                    ) : (
                        <>
                            {/* Banner */}
                            <View style={styles.banner}>
                                <Image
                                    source={{
                                        uri: 'https://pub-14a49f54cd754145a7362876730a1a52.r2.dev/Packages/Store_Banner-min.png',
                                    }}
                                    style={styles.bannerImage}
                                    resizeMode="cover"
                                />
                                <View style={styles.bannerOverlay}>
                                    <Text style={styles.bannerTitle}>
                                        {isFree ? 'Unlock Everything' : tierLabel}
                                    </Text>
                                    <Text style={styles.bannerSubtitle}>
                                        {isFree ? 'Get unlimited access to all content' : 'Active subscription'}
                                    </Text>
                                </View>
                            </View>

                            {/* Current Status */}
                            <View style={styles.statusCard}>
                                <Text style={styles.statusLabel}>Current status</Text>
                                <Text style={styles.statusValue}>{tierLabel}</Text>
                                <Text style={styles.statusHint}>
                                    {isFree
                                        ? 'Upgrade to access all characters, costumes, and backgrounds.'
                                        : 'You are enjoying premium perks.'}
                                </Text>
                            </View>

                            {/* Pro Features */}
                            <View style={styles.featuresCard}>
                                <Text style={styles.featuresTitle}>What's included</Text>
                                {PRO_FEATURES.map((feature) => (
                                    <View key={feature} style={styles.featureRow}>
                                        <Ionicons name="checkmark-circle" size={20} color="#FF5D9D" />
                                        <Text style={styles.featureText}>{feature}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Billing Period Selection */}
                            {packages.length > 0 && (
                                <View style={styles.planSelector}>
                                    {packages.map(renderPackageOption)}
                                </View>
                            )}
                            {/* Fallback if no packages loaded yet but not loading */}
                            {packages.length === 0 && !isLoading && (
                                <View style={styles.planSelector}>
                                    <Text style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                                        Unable to load subscription plans. Please try again later.
                                    </Text>
                                </View>
                            )}

                            {/* Subscribe Button */}
                            <Button
                                fullWidth
                                style={styles.subscribeButton}
                                disabled={packages.length === 0 || isLoading}
                                loading={isLoading && packages.length > 0}
                                onPress={handleSubscribe}
                            >
                                {isFree ? 'Subscribe Now' : 'Update Subscription'}
                            </Button>

                            {/* Manage Subscription (for existing subscribers) */}
                            {!isFree && (
                                <Button
                                    fullWidth
                                    variant="outline"
                                    style={styles.subscribeButton}
                                    onPress={() => {
                                        Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => { });
                                    }}
                                >
                                    Manage Subscription
                                </Button>
                            )}

                            {/* Footer Links */}
                            <View style={styles.footerLinks}>
                                <Pressable onPress={() => Linking.openURL('https://roxie.ai/terms')}>
                                    <Text style={styles.footerLink}>Terms</Text>
                                </Pressable>
                                <Text style={styles.footerDot}>•</Text>
                                <Pressable onPress={() => Linking.openURL('https://roxie.ai/privacy')}>
                                    <Text style={styles.footerLink}>Privacy</Text>
                                </Pressable>
                                <Text style={styles.footerDot}>•</Text>
                                <Pressable onPress={handleRestorePurchases}>
                                    <Text style={styles.footerLink}>Restore</Text>
                                </Pressable>
                            </View>
                        </>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
};

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
        backgroundColor: '#1A1A2E',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    closeButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    banner: {
        height: 180,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
    },
    bannerImage: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    bannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
        padding: 20,
    },
    bannerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 4,
    },
    bannerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
    },
    statusCard: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
    },
    statusLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    statusValue: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    statusHint: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        lineHeight: 20,
    },
    featuresCard: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    featuresTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 16,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    featureText: {
        fontSize: 15,
        color: '#fff',
        flex: 1,
    },
    planSelector: {
        marginBottom: 20,
        gap: 12,
    },
    planOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    planOptionSelected: {
        borderColor: '#FF5D9D',
        backgroundColor: 'rgba(255,93,157,0.1)',
    },
    planContent: {
        flex: 1,
    },
    planPeriod: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    planPrice: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
    },
    planPricePerMonth: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    savingsBadge: {
        position: 'absolute',
        top: -8,
        right: 16,
        backgroundColor: '#FF5D9D',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    savingsText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },
    radioButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioButtonInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FF5D9D',
    },
    subscribeButton: {
        marginBottom: 24,
    },
    footerLinks: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    footerLink: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
    },
    footerDot: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.3)',
    },
});

export default SubscriptionSheet;
