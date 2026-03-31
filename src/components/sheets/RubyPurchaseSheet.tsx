import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    ActivityIndicator,
    Alert,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { PurchasesPackage } from 'react-native-purchases';
import { revenueCatManager } from '../../services/RevenueCatManager';
import { CurrencyRepository } from '../../repositories/CurrencyRepository';
import RubyIcon from '../../assets/icons/ruby.svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Ruby Packages ──────────────────────────────────────────────────

export const RUBY_PACKAGES = [
    {
        id: 'silver.package.fun.vivivi',
        name: 'Silver',
        ruby: 60,
        color: '#94A3B8',
        gradientColors: ['#64748B', '#94A3B8'] as const,
        icon: '💎',
        popular: false,
    },
    {
        id: 'gold.package.fun.vivivi',
        name: 'Gold',
        ruby: 180,
        color: '#F59E0B',
        gradientColors: ['#D97706', '#FBBF24'] as const,
        icon: '👑',
        popular: true,
    },
    {
        id: 'diamond.package.fun.vivivi',
        name: 'Diamond',
        ruby: 450,
        color: '#EC4899',
        gradientColors: ['#BE185D', '#F472B6'] as const,
        icon: '💖',
        popular: false,
    },
];

export const GIFT_TIERS = [
    {
        id: 'rose',
        name: 'Rose',
        image: 'https://img.icons8.com/3d-fluency/94/rose.png',
        cost: 30,
        gradientColors: ['#F43F5E', '#FB7185'] as const,
        description: 'A sweet gesture',
    },
    {
        id: 'chocolate',
        name: 'Chocolate',
        image: 'https://img.icons8.com/3d-fluency/94/chocolate-bar.png',
        cost: 60,
        gradientColors: ['#92400E', '#D97706'] as const,
        description: 'She\'ll love it',
        popular: true,
    },
    {
        id: 'luxury',
        name: 'Luxury Gift',
        image: 'https://img.icons8.com/3d-fluency/94/gift.png',
        cost: 120,
        gradientColors: ['#7C3AED', '#C084FC'] as const,
        description: 'Unlock the best',
    },
];

export const GIFT_COST_RUBY = GIFT_TIERS[0].cost; // minimum cost for reference

// ─── Helper ─────────────────────────────────────────────────────────

export function getRubyAmountForProduct(productId: string): number {
    const pkg = RUBY_PACKAGES.find(p => p.id === productId);
    return pkg?.ruby ?? 0;
}

// ─── Component ──────────────────────────────────────────────────────

type Props = {
    visible: boolean;
    onClose: () => void;
    onPurchaseComplete?: (newBalance: number) => void;
    currentBalance?: number;
};

export const RubyPurchaseSheet: React.FC<Props> = ({
    visible,
    onClose,
    onPurchaseComplete,
    currentBalance = 0,
}) => {
    const [isPurchasing, setIsPurchasing] = useState<string | null>(null);
    const [balance, setBalance] = useState(currentBalance);
    const [rcPackages, setRcPackages] = useState<Record<string, PurchasesPackage>>({});

    useEffect(() => {
        setBalance(currentBalance);
    }, [currentBalance]);

    useEffect(() => {
        if (visible) {
            // Refresh balance on open
            const repo = new CurrencyRepository();
            repo.fetchCurrency().then(c => setBalance(c.ruby));

            // Fetch package prices
            const fetchPackages = async () => {
                const pkgs: Record<string, PurchasesPackage> = {};
                for (const pkg of RUBY_PACKAGES) {
                    const rcPkg = await revenueCatManager.getPackageByIdentifier(pkg.id);
                    if (rcPkg) pkgs[pkg.id] = rcPkg;
                }
                setRcPackages(pkgs);
            };
            fetchPackages();
        }
    }, [visible]);

    const handlePurchase = async (pkg: typeof RUBY_PACKAGES[0]) => {
        if (isPurchasing) return;

        try {
            setIsPurchasing(pkg.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const rcPackage = await revenueCatManager.getPackageByIdentifier(pkg.id);
            if (!rcPackage) {
                Alert.alert('Error', 'Package not found. Please try again later.');
                setIsPurchasing(null);
                return;
            }

            await revenueCatManager.purchasePackage(rcPackage);

            // Update local currency balance
            const repo = new CurrencyRepository();
            const currentCurrency = await repo.fetchCurrency();
            const newRuby = currentCurrency.ruby + pkg.ruby;
            await repo.updateCurrency(undefined, newRuby);

            setBalance(newRuby);
            setIsPurchasing(null);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onPurchaseComplete?.(newRuby);

            Alert.alert(
                '🎉 Ruby Added!',
                `You received ${pkg.ruby} Ruby! Your balance: ${newRuby} 💎`,
                [{ text: 'OK', onPress: onClose }]
            );
        } catch (error: any) {
            setIsPurchasing(null);
            if (error.message !== 'Purchase cancelled') {
                Alert.alert('Error', 'Something went wrong. Please try again.');
            }
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerButton} />
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>Get Ruby</Text>
                    </View>
                    <Pressable onPress={onClose} style={styles.headerButton} hitSlop={12}>
                        <Ionicons name="close" size={24} color="rgba(255,255,255,0.7)" />
                    </Pressable>
                </View>

                {/* Balance Display */}
                <View style={styles.balanceContainer}>
                    <LinearGradient
                        colors={['rgba(168, 85, 247, 0.15)', 'rgba(236, 72, 153, 0.15)']}
                        style={styles.balanceGradient}
                    >
                        <Text style={styles.balanceLabel}>Your Balance</Text>
                        <View style={styles.balanceRow}>
                            <RubyIcon width={28} height={28} />
                            <Text style={styles.balanceAmount}>{balance}</Text>
                            <Text style={styles.balanceCurrency}>Ruby</Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* Info Text */}
                <Text style={styles.infoText}>
                    You can use rubies to give gifts to characters, buy dance emotes or costumes.
                </Text>

                {/* Packages */}
                <View style={styles.packagesContainer}>
                    {RUBY_PACKAGES.map(pkg => (
                        <Pressable
                            key={pkg.id}
                            style={({ pressed }) => [
                                styles.packageCard,
                                pressed && { transform: [{ scale: 0.97 }] },
                            ]}
                            onPress={() => handlePurchase(pkg)}
                            disabled={!!isPurchasing}
                        >
                            <LinearGradient
                                colors={pkg.gradientColors}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.packageGradient}
                            >
                                {pkg.popular && (
                                    <View style={styles.popularBadge}>
                                        <Text style={styles.popularText}>BEST VALUE</Text>
                                    </View>
                                )}

                                <Text style={styles.packageIcon}>{pkg.icon}</Text>
                                <Text style={styles.packageName}>{pkg.name}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text style={styles.packageRuby}>{pkg.ruby}</Text>
                                    <RubyIcon width={16} height={16} />
                                </View>

                                {isPurchasing === pkg.id ? (
                                    <ActivityIndicator color="#fff" size="small" style={{ marginTop: 12 }} />
                                ) : (
                                    <View style={styles.packagePriceBtn}>
                                        <Text style={styles.packagePriceText}>
                                            {rcPackages[pkg.id]?.product.priceString || 'Buy'}
                                        </Text>
                                    </View>
                                )}
                            </LinearGradient>
                        </Pressable>
                    ))}
                </View>

                {/* Footer note */}
                {/* <Text style={styles.footerNote}>
                    Ruby are non-refundable virtual items. Purchases are processed by Apple/Google.
                </Text> */}
            </View>
        </Modal>
    );
};

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f0f14',
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 16,
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
        fontSize: 20,
        fontWeight: '800',
    },
    balanceContainer: {
        marginTop: 8,
        marginBottom: 16,
    },
    balanceGradient: {
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.2)',
    },
    balanceLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    balanceEmoji: {
        fontSize: 28,
    },
    balanceAmount: {
        color: '#fff',
        fontSize: 36,
        fontWeight: '800',
    },
    balanceCurrency: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 18,
        fontWeight: '600',
    },
    infoText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    packagesContainer: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'center',
    },
    packageCard: {
        flex: 1,
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    packageGradient: {
        paddingVertical: 20,
        paddingHorizontal: 12,
        alignItems: 'center',
        position: 'relative',
        minHeight: 180,
        justifyContent: 'center',
    },
    popularBadge: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingVertical: 4,
        alignItems: 'center',
    },
    popularText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },
    packageIcon: {
        fontSize: 36,
        marginBottom: 8,
    },
    packageName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    packageRuby: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 18,
        fontWeight: '800',
    },
    packagePriceBtn: {
        marginTop: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 999,
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    packagePriceText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    footerNote: {
        color: 'rgba(255,255,255,0.25)',
        fontSize: 11,
        textAlign: 'center',
        marginTop: 24,
        lineHeight: 16,
    },
});
