import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    FlatList,
    ActivityIndicator,
    Alert,
    useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { DanceRepository, DanceItem } from '../../repositories/DanceRepository';
import { BottomSheet, type BottomSheetRef } from '../BottomSheet';
import { LiquidGlass } from '../LiquidGlass';
import { Skeleton } from '../ui/Skeleton';
import RubyIcon from '../../assets/icons/ruby.svg';

interface DanceSheetProps {
    isOpened: boolean;
    onIsOpenedChange: (isOpened: boolean) => void;
    rubyBalance: number;
    onPlayDance: (fileName: string) => void;
    onOpenRubySheet?: () => void;
    onBalanceChanged?: () => void;
    isDarkBackground?: boolean;
}

export type DanceSheetRef = BottomSheetRef;

export const DanceSheet = forwardRef<DanceSheetRef, DanceSheetProps>((
    {
        isOpened,
        onIsOpenedChange,
        rubyBalance,
        onPlayDance,
        onOpenRubySheet,
        onBalanceChanged,
        isDarkBackground = true,
    },
    ref
) => {
    const sheetRef = useRef<BottomSheetRef>(null);
    const danceRepoRef = useRef<DanceRepository | null>(null);

    const [dances, setDances] = useState<DanceItem[]>([]);
    const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [purchasing, setPurchasing] = useState<string | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);

    const { width, height } = useWindowDimensions();
    const textColor = isDarkBackground ? '#fff' : '#000';
    const secondaryTextColor = isDarkBackground ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';

    const ITEM_SIZE = (width - 40 - 24) / 3;

    useImperativeHandle(ref, () => ({
        present: (index?: number) => sheetRef.current?.present(index),
        dismiss: () => sheetRef.current?.dismiss(),
    }));

    useEffect(() => {
        danceRepoRef.current = new DanceRepository();
    }, []);

    const load = useCallback(async () => {
        if (!danceRepoRef.current || isLoading) return;
        setIsLoading(true);
        try {
            const [allDances, owned] = await Promise.all([
                danceRepoRef.current.fetchAllDances(),
                danceRepoRef.current.fetchOwnedDanceIds(),
            ]);
            setDances(allDances);
            setOwnedIds(owned);
        } catch (e) {
            console.error('[DanceSheet] Failed to load dances:', e);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading]);

    useEffect(() => {
        if (isOpened) {
            if (dances.length === 0) {
                load();
            } else {
                // Refresh owned status
                danceRepoRef.current?.fetchOwnedDanceIds().then((ids) => setOwnedIds(ids));
            }
        }
    }, [isOpened]);

    const handleDanceTap = useCallback(
        async (dance: DanceItem) => {
            const isOwned = ownedIds.has(dance.id);
            const isFree = dance.tier === 'free';

            if (isFree || isOwned) {
                setPlayingId(dance.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
                onPlayDance(dance.file_name);
                setTimeout(() => sheetRef.current?.dismiss(), 350);
                return;
            }

            // Pro dance not owned
            if (rubyBalance < dance.price_ruby) {
                Alert.alert(
                    'Not Enough Ruby',
                    `You need ${dance.price_ruby} Ruby but only have ${rubyBalance}. Buy more?`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Buy Ruby',
                            onPress: () => {
                                sheetRef.current?.dismiss();
                                setTimeout(() => onOpenRubySheet?.(), 350);
                            },
                        },
                    ]
                );
                return;
            }

            Alert.alert(
                'Unlock Dance',
                `Unlock "${dance.name}" for ${dance.price_ruby} Ruby?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Unlock', onPress: () => purchaseDance(dance) },
                ]
            );
        },
        [ownedIds, rubyBalance, onPlayDance, onOpenRubySheet]
    );

    const purchaseDance = useCallback(
        async (dance: DanceItem) => {
            if (!danceRepoRef.current || purchasing) return;
            setPurchasing(dance.id);
            try {
                const txId = await danceRepoRef.current.purchaseDance(dance.id, dance.price_ruby);
                if (txId) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
                    setOwnedIds((prev) => new Set([...prev, dance.id]));
                    onBalanceChanged?.();
                    setPlayingId(dance.id);
                    onPlayDance(dance.file_name);
                    setTimeout(() => sheetRef.current?.dismiss(), 350);
                } else {
                    Alert.alert('Error', 'Failed to purchase. Please try again.');
                }
            } catch (e) {
                console.error('[DanceSheet] Purchase error:', e);
                Alert.alert('Error', 'Something went wrong.');
            } finally {
                setPurchasing(null);
            }
        },
        [purchasing, onPlayDance, onBalanceChanged]
    );

    const renderItem = ({ item }: { item: DanceItem }) => {
        const isOwned = ownedIds.has(item.id);
        const isLocked = item.tier === 'pro' && !isOwned;
        const isPlaying = playingId === item.id;
        const isPurchasing = purchasing === item.id;

        return (
            <Pressable
                onPress={() => handleDanceTap(item)}
                disabled={!!purchasing}
                style={({ pressed }) => [
                    styles.itemContainer,
                    { width: ITEM_SIZE },
                    pressed && styles.pressed,
                ]}
            >
                <LiquidGlass
                    pressable={false}
                    style={[
                        styles.card,
                        { width: ITEM_SIZE, height: ITEM_SIZE },
                        isPlaying && styles.cardPlaying,
                        isLocked && styles.cardLocked,
                    ]}
                    isDarkBackground={isDarkBackground}
                >
                    {/* Icon: ưu tiên icon_url, fallback emoji */}
                    {item.icon_url ? (
                        <Image
                            source={{ uri: item.icon_url }}
                            style={[styles.iconImage, { width: ITEM_SIZE, height: ITEM_SIZE }]}
                            contentFit="cover"
                            transition={200}
                            cachePolicy="memory-disk"
                            blurRadius={isLocked ? 8 : 0}
                        />
                    ) : (
                        <Text style={styles.emoji}>{item.emoji || '💃'}</Text>
                    )}

                    {/* Lock or purchasing indicator for pro */}
                    {isPurchasing ? (
                        <ActivityIndicator size="small" color="#A78BFA" style={styles.badge} />
                    ) : isLocked ? (
                        <View style={styles.priceBadge}>
                            <Ionicons name="lock-closed" size={10} color="#F59E0B" />
                            <RubyIcon width={10} height={10} />
                            <Text style={styles.priceText}>{item.price_ruby}</Text>
                        </View>
                    ) : null}

                    {/* Dark overlay if locked */}
                    {isLocked && <View style={[styles.darkenOverlay, { width: ITEM_SIZE, height: ITEM_SIZE }]} />}
                </LiquidGlass>

                <Text style={[styles.itemName, { color: isLocked ? secondaryTextColor : textColor }]} numberOfLines={1}>
                    {item.name}
                </Text>
            </Pressable>
        );
    };

    const renderContent = () => {
        if (isLoading && dances.length === 0) {
            const skeletons = Array.from({ length: 12 }).map((_, i) => ({ id: i.toString() }));
            return (
                <View style={{ flex: 1, maxHeight: height * 0.9 }}>
                    <FlatList
                        data={skeletons}
                        keyExtractor={(item) => item.id}
                        numColumns={3}
                        columnWrapperStyle={styles.columnWrapper}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        renderItem={() => (
                            <View style={[styles.itemContainer, { width: ITEM_SIZE }]}>
                                <Skeleton width={ITEM_SIZE} height={ITEM_SIZE} borderRadius={16} />
                                <Skeleton width="80%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
                            </View>
                        )}
                    />
                </View>
            );
        }

        if (dances.length === 0) {
            return (
                <View style={styles.centerContainer}>
                    <Text style={[styles.emptyText, { color: secondaryTextColor }]}>No dances available</Text>
                </View>
            );
        }

        return (
            <View style={{ flex: 1, maxHeight: height * 0.9 }}>
                <FlatList
                    data={dances}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    numColumns={3}
                    columnWrapperStyle={styles.columnWrapper}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            </View>
        );
    };

    return (
        <BottomSheet
            ref={sheetRef}
            isOpened={isOpened}
            onIsOpenedChange={onIsOpenedChange}
            title="Choose a Dance"
            isDarkBackground={isDarkBackground}
            headerLeft={
                <View style={styles.rubyBadge}>
                    <RubyIcon width={14} height={14} />
                    <Text style={styles.rubyText}>{rubyBalance}</Text>
                </View>
            }
        >
            {renderContent()}
        </BottomSheet>
    );
});

const styles = StyleSheet.create({
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    emptyText: {
        fontSize: 15,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 32,
    },
    columnWrapper: {
        gap: 12,
        marginBottom: 16,
    },
    itemContainer: {
        alignItems: 'center',
        gap: 6,
    },
    card: {
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
    },
    cardPlaying: {
        borderWidth: 2,
        borderColor: '#A78BFA',
    },
    cardLocked: {
        opacity: 0.85,
    },
    emoji: {
        fontSize: 30,
        zIndex: 2,
    },
    iconImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        borderRadius: 14,
        zIndex: 0,
    },
    badge: {
        marginTop: 4,
        zIndex: 2,
    },
    priceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 5,
        backgroundColor: 'rgba(245,158,11,0.2)',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 10,
        zIndex: 2,
    },
    priceText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#F59E0B',
    },
    darkenOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 16,
        zIndex: 1,
    },
    itemName: {
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
    },
    pressed: {
        opacity: 0.8,
        transform: [{ scale: 0.97 }],
    },
    rubyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(244,63,94,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(244,63,94,0.3)',
    },
    rubyText: {
        color: '#F43F5E',
        fontSize: 13,
        fontWeight: '700',
    },
});
