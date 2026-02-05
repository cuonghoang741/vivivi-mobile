import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Image,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Animated } from 'react-native';
import GiftIcon from '../../assets/icons/gift.svg';
import { LiquidGlass } from '../commons/LiquidGlass';
import { CostumeRepository, type CostumeItem } from '../../repositories/CostumeRepository';
import AssetRepository from '../../repositories/AssetRepository';
import { IconHearts } from '@tabler/icons-react-native';
import { BottomSheet, BottomSheetRef } from '../commons/BottomSheet';

type StreakSheetProps = {
    characterName?: string;
    streakDays: number;
    connectionLevel?: number;
    connectionProgress?: number; // 0-1
    friendshipDays?: number;
    canCheckin?: boolean;
    onCheckin?: () => Promise<void>;
    onRefreshLoginRewards?: () => void;
    onDismiss?: () => void;
    characterId?: string;
    onClaimMilestone?: (costume: CostumeItem, isClaimed: boolean) => void;
    isDarkBackground?: boolean;
};

export type StreakSheetRef = {
    present: (index?: number) => void;
    dismiss: () => void;
};

// Monday to Sunday
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const StreakSheet = forwardRef<StreakSheetRef, StreakSheetProps>(({
    characterName = 'Your character',
    streakDays = 0,
    connectionLevel = 1,
    connectionProgress = 0,
    friendshipDays = 0,
    canCheckin = false,
    onCheckin,
    onRefreshLoginRewards,
    onDismiss,
    characterId,
    onClaimMilestone,
    isDarkBackground = true,
}, ref) => {
    const sheetRef = useRef<BottomSheetRef>(null);
    const shakeAnimation = useRef(new Animated.Value(0)).current;

    // Store all milestones
    const [milestones, setMilestones] = React.useState<{ day: number, costume: any }[]>([]);
    const [maxMilestoneDay, setMaxMilestoneDay] = React.useState(7);

    // Current next target for text display (optional)
    const [nextTarget, setNextTarget] = React.useState<number>(7);

    // State to track expanded milestone info if needed, or just visual
    const [loadingMilestones, setLoadingMilestones] = React.useState(true);
    const [ownedCostumeIds, setOwnedCostumeIds] = React.useState<Set<string>>(new Set());
    const insets = useSafeAreaInsets();

    // Expose present/dismiss methods via ref
    useImperativeHandle(ref, () => ({
        present: (index?: number) => {
            sheetRef.current?.present(index ?? 0);
        },
        dismiss: () => {
            sheetRef.current?.dismiss();
        },
    }));

    // Day state: 'checked' | 'today' | 'future' | 'past'
    type DayState = 'checked' | 'today' | 'future' | 'past';

    const getDayStates = (): DayState[] => {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
        const mondayBasedToday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday = 0

        const states: DayState[] = [];

        // Calculate how many previous days should be checked
        // If user has checked in today, then streakDays includes today
        // So we need to check (streakDays - 1) previous days (if already checked in today)
        const previousDaysToCheck = canCheckin ? streakDays : streakDays - 1;

        for (let i = 0; i < 7; i++) {
            if (i < mondayBasedToday) {
                // Past days - check if within streak
                const daysAgo = mondayBasedToday - i;
                if (daysAgo <= previousDaysToCheck) {
                    states.push('checked');
                } else {
                    states.push('past');
                }
            } else if (i === mondayBasedToday) {
                // Today
                if (canCheckin) {
                    states.push('today'); // Can still check in
                } else {
                    states.push('checked'); // Already checked in today
                }
            } else {
                // Future days
                states.push('future');
            }
        }
        return states;
    };

    const dayStates = getDayStates();

    React.useEffect(() => {
        const fetchCostumeMilestones = async () => {
            if (!characterId) {
                setLoadingMilestones(false);
                return;
            }

            try {
                const costumeRepo = new CostumeRepository();
                const costumes = await costumeRepo.fetchCostumes(characterId);

                // Get all streak milestones with costumes
                const validMilestones = costumes
                    .filter((c: any) => typeof c.streak_days === 'number' && c.streak_days > 0)
                    .map((c: any) => ({
                        day: c.streak_days,
                        costume: c
                    }))
                    .sort((a, b) => a.day - b.day);

                if (validMilestones.length > 0) {
                    setMilestones(validMilestones);
                    const maxDay = validMilestones[validMilestones.length - 1].day;
                    // Ensure max day is at least 7 to look good if only day 1 exists? 
                    // Or strictly follow max day.
                    // If streak is higher than max day, maybe extend?
                    // Let's settle on max(7, maxDay, currentStreak + some buffer)
                    const calculatedMax = Math.max(7, maxDay, streakDays);
                    setMaxMilestoneDay(calculatedMax);

                    const next = validMilestones.find(m => m.day > streakDays);
                    setNextTarget(next ? next.day : maxDay);
                } else {
                    setMilestones([]);
                }

                // Fetch owned costumes to check claimed status using AssetRepository
                const assetRepo = new AssetRepository();
                const ownedIds = await assetRepo.fetchOwnedAssets('character_costume');
                setOwnedCostumeIds(ownedIds);

            } catch (error) {
                console.warn('Failed to fetch costume milestones', error);
            } finally {
                setLoadingMilestones(false);
            }
        };

        fetchCostumeMilestones();
    }, [characterId, streakDays]);

    // Animation for claimable rewards
    // Find if there is any milestone that is reached (streakDays >= m.day) 
    // AND traditionally we would check if claimed. 
    // Here we assume "reached" essentially triggers the animation if it's the *latest* one or we just animate all reached ones? 
    // "khi đủ ngày thì hộp quà rung lắc" -> usually implies the newly reached one.
    // For simplicity, let's animate any milestone that matches streakDays (exact match) 
    // or we can allow the user to claim.
    // Since we don't have "claimed" status in this simple prop list yet, 
    // let's animate the one that is exactly equal to streakDays or maybe all <= streakDays?
    // Let's animate if streakDays >= day.

    React.useEffect(() => {
        // Animate only if there is a reachable milestone that is NOT owned
        const hasUnclaimedReachable = milestones.some(m =>
            streakDays >= m.day && !ownedCostumeIds.has(m.costume.id)
        );

        if (hasUnclaimedReachable) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(shakeAnimation, { toValue: 1, duration: 100, useNativeDriver: true }),
                    Animated.timing(shakeAnimation, { toValue: -1, duration: 100, useNativeDriver: true }),
                    Animated.timing(shakeAnimation, { toValue: 1, duration: 100, useNativeDriver: true }),
                    Animated.timing(shakeAnimation, { toValue: 0, duration: 100, useNativeDriver: true }),
                    Animated.delay(1000)
                ])
            ).start();
        } else {
            shakeAnimation.setValue(0);
        }
    }, [milestones, streakDays, shakeAnimation, ownedCostumeIds]);

    const shakeRotate = shakeAnimation.interpolate({
        inputRange: [-1, 1],
        outputRange: ['-10deg', '10deg']
    });

    // Calculate progress (0 to 1) relative to maxMilestoneDay
    // If streakDays > maxMilestoneDay, it caps at 1 implicitly by width styles or we handle it.
    const overallProgress = maxMilestoneDay > 0
        ? Math.min(1, streakDays / maxMilestoneDay)
        : 0;

    // Width for the fill bar
    const fillWidthPercent = `${overallProgress * 100}%`;

    const handleDismiss = () => {
        sheetRef.current?.dismiss();
        onDismiss?.();
    };

    // Dynamic colors based on theme
    const textColor = isDarkBackground ? '#fff' : '#000';
    const subtextColor = isDarkBackground ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
    const weekdayLabelColor = isDarkBackground ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
    const trackBgColor = isDarkBackground ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const lockedBgColor = isDarkBackground ? 'rgba(53, 52, 52, 0.8)' : 'rgba(209, 209, 209, 0.92)';
    const progressLabelColor = isDarkBackground ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
    const liquidTintColor = isDarkBackground ? '#fff' : '#00000096';

    // Weekday circle colors
    const circleBgColor = isDarkBackground ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
    const circleTodayBg = isDarkBackground ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
    const circleTodayBorder = isDarkBackground ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
    const circleFutureBg = isDarkBackground ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
    const circlePastBg = isDarkBackground ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';


    return (
        <BottomSheet
            ref={sheetRef}
            detents={['auto', 0.95]}
            cornerRadius={24}
            grabber={true}
            isDarkBackground={isDarkBackground}
            onDismiss={onDismiss}
        >
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 20 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: textColor }]}>{characterName}</Text>
                    <View style={styles.friendshipRow}>
                        <IconHearts size={16} color={subtextColor} />
                        <Text style={[styles.friendshipText, { color: subtextColor }]}>{streakDays} streak day{streakDays !== 1 ? 's' : ''}</Text>
                    </View>
                </View>

                {/* Streak Hero Section */}
                <View style={styles.heroSection}>
                    <View style={styles.streakIconWrapper}>
                        {/* Glow image behind flame */}
                        <Image
                            source={{ uri: 'https://d1j8r0kxyu9tj8.cloudfront.net/files/56KM6ztUz4iI9nIGqmNvypBstLupr8UxilTbBZv3.png' }}
                            style={styles.glowImage}
                        />
                        <View style={styles.streakBadge}>
                            <Text style={[styles.streakBadgeText, { color: textColor }]}>{streakDays}</Text>
                        </View>
                    </View>
                    <Text style={[styles.heroTitle, { color: textColor }]}>Daily Streak</Text>
                    <Text style={[styles.heroSubtitle, { color: subtextColor }]}>
                        Check in every day to keep your streak{'\n'}and earn a special costume at milestones!
                    </Text>
                </View>

                {/* Weekday Indicators */}
                <View style={styles.weekdayRow}>
                    {WEEKDAYS.map((day, index) => {
                        const state = dayStates[index];
                        const isToday = state === 'today';
                        const canClickToCheckin = isToday && canCheckin;

                        return (
                            <View key={index} style={styles.weekdayItem}>
                                <Text style={[styles.weekdayLabel, { color: weekdayLabelColor }]}>{day}</Text>
                                {canClickToCheckin ? (
                                    <Pressable
                                        onPress={onCheckin}
                                        style={[
                                            styles.weekdayCircle,
                                            {
                                                backgroundColor: circleTodayBg,
                                                borderWidth: 2,
                                                borderColor: circleTodayBorder
                                            },
                                        ]}>
                                    </Pressable>
                                ) : (
                                    <View
                                        style={[
                                            styles.weekdayCircle,
                                            { backgroundColor: circleBgColor },
                                            state === 'checked' && styles.weekdayCircleChecked,
                                            state === 'future' && { backgroundColor: circleFutureBg },
                                            state === 'past' && { backgroundColor: circlePastBg },
                                        ]}>
                                        {state === 'checked' && (
                                            <Ionicons name="checkmark" size={16} color="#fff" />
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>

                {/* Milestone Section */}
                <View style={styles.milestoneSection}>
                    <View style={styles.milestoneTitleRow}>
                        <View>
                            <Text style={[styles.milestoneTitleText, { color: textColor }]}>Costume Rewards</Text>
                            <Text style={[styles.milestoneDescription, { color: subtextColor }]}>
                                Reach streak milestones to unlock{'\n'}special costumes for {characterName}
                            </Text>
                        </View>
                    </View>

                    {/* Progress Track */}
                    <View style={styles.trackContainer}>
                        {/* Background Bar */}
                        <View style={[styles.trackBackground, { backgroundColor: trackBgColor }]} />

                        {/* Fill Bar */}
                        <LinearGradient
                            colors={['#FF4639', '#FF8E86']}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={[styles.trackFill, { width: fillWidthPercent as `${number}%` }]}
                        />

                        {/* Current Progress Thumb - Sliding */}
                        <View style={[styles.currentThumb, { left: fillWidthPercent as `${number}%` }]}>
                            <Ionicons name="flame" size={16} color="#fff" />
                        </View>

                        {/* Milestones */}
                        {milestones.map((m) => {
                            const positionPercent = (m.day / maxMilestoneDay) * 100;
                            const isReached = streakDays >= m.day;

                            const isClaimed = ownedCostumeIds.has(m.costume.id);
                            const shouldShake = isReached && !isClaimed; // Only shake if reached but not claimed

                            return (
                                <View
                                    key={m.day}
                                    style={[styles.milestoneMarkerContainer, { left: `${positionPercent}%` as `${number}%` }]}
                                >
                                    <Pressable

                                        style={styles.milestoneContent}
                                    >
                                        <View style={styles.markerLabelContainer}>
                                            <Text style={[styles.markerLabel, { color: textColor }]}>
                                                Day {m.day}
                                            </Text>
                                        </View>

                                        {isReached ? (
                                            shouldShake ? (
                                                <Animated.View style={{ transform: [{ rotate: shakeRotate }] }}>
                                                    <LiquidGlass
                                                        onPress={() => {
                                                            if (isReached && onClaimMilestone) {
                                                                // Dismiss sheet first, then show popup after a delay
                                                                sheetRef.current?.dismiss();
                                                                setTimeout(() => {
                                                                    onClaimMilestone(m.costume, isClaimed);
                                                                }, 300);
                                                            }
                                                        }}
                                                        tintColor={liquidTintColor}
                                                        style={styles.milestoneGiftBox}>
                                                        <View style={styles.giftIconWrapper}>
                                                            <GiftIcon width={28} height={28} />
                                                        </View>
                                                    </LiquidGlass>
                                                </Animated.View>
                                            ) : (
                                                <View>
                                                    <LiquidGlass
                                                        onPress={() => {
                                                            if (isReached && onClaimMilestone) {
                                                                // Dismiss sheet first, then show popup after a delay
                                                                sheetRef.current?.dismiss();
                                                                setTimeout(() => {
                                                                    onClaimMilestone(m.costume, isClaimed);
                                                                }, 300);
                                                            }
                                                        }}
                                                        tintColor={liquidTintColor}
                                                        style={styles.milestoneGiftBox}
                                                    >
                                                        <View style={[
                                                            styles.giftIconWrapper,
                                                        ]}>
                                                            <GiftIcon width={28} height={28} />
                                                        </View>
                                                    </LiquidGlass>
                                                    {/* Overlay checkmark if claimed */}
                                                    {isClaimed && (
                                                        <View style={styles.checkBadge}>
                                                            <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                                                        </View>
                                                    )}
                                                </View>
                                            )
                                        ) : (
                                            <View style={[
                                                styles.milestoneLocked,
                                                {
                                                    backgroundColor: lockedBgColor,
                                                }
                                            ]}>
                                                <GiftIcon width={24} height={24} style={{ opacity: 0.3 }} />
                                                {/* <View style={styles.lockBadge}>
                                                    <Ionicons name="lock-closed" size={10} color={subtextColor} />
                                                </View> */}
                                            </View>
                                        )}
                                    </Pressable>
                                </View>
                            );
                        })}
                    </View>
                </View>
            </ScrollView>
        </BottomSheet>
    );
});

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    sheetContent: {
        paddingHorizontal: 24,
    },
    header: {
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
    },
    friendshipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 4,

    },
    friendshipText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    streakIconWrapper: {
        position: 'relative',
        width: 120,
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    glowImage: {
        position: 'absolute',
        width: 200,
        height: 260,
        top: -60,
    },
    streakBadge: {
        position: 'absolute',
        top: 45,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    streakBadgeText: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    heroSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        lineHeight: 20,
    },
    weekdayRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 32,
    },
    weekdayItem: {
        alignItems: 'center',
        gap: 8,
    },
    weekdayLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.6)',
    },
    weekdayCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    weekdayCircleChecked: {
        backgroundColor: '#FF4639',
    },
    weekdayCircleToday: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    weekdayCircleFuture: {
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    weekdayCirclePast: {
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    checkinButton: {
        backgroundColor: '#FF4639',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 999,
        alignSelf: 'center',
        marginBottom: 24,
    },
    checkinButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    milestoneSection: {
        marginBottom: 28,
    },
    milestoneTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    milestoneTitleText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    milestoneDescription: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        lineHeight: 20,
    },
    rewardIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressContainer: {
        height: 32,
        backgroundColor: 'rgba(100,100,100,0.4)',
        borderRadius: 16,
        overflow: 'visible',
        position: 'relative',
        marginBottom: 8,
    },
    progressFill: {
        height: '100%',
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
    },
    progressLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 40,
    },
    progressLabelText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
    },
    trackContainer: {
        height: 48,
        marginTop: 20,
        marginBottom: 8,
        position: 'relative',
        justifyContent: 'center',
    },
    trackBackground: {
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        width: '100%',
        position: 'absolute',
    },
    trackFill: {
        height: 24,
        borderRadius: 12,
        position: 'absolute',
        top: 12, // (48 - 24) / 2
    },
    currentThumb: {
        position: 'absolute',
        top: 4, // Center vertically: (48 - 40) / 2 = 4
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FF4639',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -20,
        elevation: 4,
        zIndex: 10,
    },
    milestoneMarkerContainer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        width: 1, // Point
        overflow: 'visible',
        zIndex: 11, // Above thumb
    },
    // milestoneLine removed as visual clutter with icons centered
    milestoneContent: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 60,
    },
    markerLabelContainer: {
        position: 'absolute',
        bottom: -24,
        alignItems: 'center',
        width: 60,
    },
    markerLabel: {
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    milestoneGiftBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
    },
    giftIconWrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
    },
    milestoneClaimed: {
        // Wrapper for claimed state if needed, currently reusing GiftBox style inside
        justifyContent: 'center',
        alignItems: 'center',
    },
    milestoneLocked: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    checkBadge: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: '#1a1a1a',
        borderRadius: 8,
    },
    lockBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#1a1a1a',
        borderRadius: 6,
        padding: 1,
    },
    // Removed old style classes

    connectionSection: {
        marginBottom: 16,
    },
    connectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    connectionDescription: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 16,
    },
    connectionProgressContainer: {
        height: 32,
        backgroundColor: 'rgba(100,100,100,0.4)',
        borderRadius: 16,
        overflow: 'visible',
        position: 'relative',
        marginBottom: 8,
    },
    connectionProgressFill: {
        height: '100%',
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
    },
    connectionThumb: {
        position: 'absolute',
        top: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FF579A',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -16,
        shadowColor: '#FF579A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
    },
    checkedInContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 32,
        marginBottom: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 999,
        alignSelf: 'center',
    },
    checkedInText: {
        color: '#rgba(255, 255, 255, 0.7)',
        fontSize: 16,
        fontWeight: '600',
    }
});
