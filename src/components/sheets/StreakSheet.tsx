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
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import StreakIcon from '../../assets/icons/streak.svg';
import GiftIcon from '../../assets/icons/gift.svg';
import { LiquidGlass } from '../LiquidGlass';
import { CostumeRepository, type CostumeItem } from '../../repositories/CostumeRepository';

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
}, ref) => {
    const shakeAnimation = useRef(new Animated.Value(0)).current;

    // Store all milestones
    const [milestones, setMilestones] = React.useState<{ day: number, costume: any }[]>([]);
    const [maxMilestoneDay, setMaxMilestoneDay] = React.useState(7);

    // Current next target for text display (optional)
    const [nextTarget, setNextTarget] = React.useState<number>(7);

    // State to track expanded milestone info if needed, or just visual
    const [loadingMilestones, setLoadingMilestones] = React.useState(true);
    const [ownedCostumeIds, setOwnedCostumeIds] = React.useState<Set<string>>(new Set());
    const sheetRef = useRef<TrueSheet>(null);
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

        for (let i = 0; i < 7; i++) {
            if (i < mondayBasedToday) {
                // Past days - check if within streak
                const daysAgo = mondayBasedToday - i;
                if (daysAgo <= streakDays) {
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

                // Fetch owned costumes to check claimed status
                const { data: ownedData } = await costumeRepo.client
                    .from('user_costumes')
                    .select('costume_id')
                    .eq('user_id', costumeRepo.userId);

                if (ownedData) {
                    setOwnedCostumeIds(new Set(ownedData.map((i: any) => i.costume_id)));
                }

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

    return (
        <TrueSheet
            ref={sheetRef}
            detents={['auto', 0.95]}
            cornerRadius={24}
            grabber={true}
            backgroundColor="#1a1a1a"
            onDidDismiss={onDismiss}
        >
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 20 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>{characterName}</Text>
                        <View style={styles.friendshipRow}>
                            <Ionicons name="flame" size={16} color="#FF4639" />
                            <Text style={styles.friendshipText}>{streakDays} streak day{streakDays !== 1 ? 's' : ''}</Text>
                        </View>
                    </View>
                    <LiquidGlass style={styles.closeButton} onPress={handleDismiss}>
                        <Ionicons name="close" size={20} color="#fff" />
                    </LiquidGlass>
                </View>

                {/* Streak Hero Section */}
                <View style={styles.heroSection}>
                    <View style={styles.streakIconWrapper}>
                        {/* Glow image behind flame */}
                        <Image
                            source={{ uri: 'https://d1j8r0kxyu9tj8.cloudfront.net/files/56KM6ztUz4iI9nIGqmNvypBstLupr8UxilTbBZv3.png' }}
                            style={styles.glowImage}
                        />
                        <StreakIcon width={100} height={100} />
                        <View style={styles.streakBadge}>
                            <Text style={styles.streakBadgeText}>{streakDays}</Text>
                        </View>
                    </View>
                    <Text style={styles.heroTitle}>Daily Streak</Text>
                    <Text style={styles.heroSubtitle}>
                        Check in every day to keep your streak{'\n'}and earn a special costume at milestones!
                    </Text>
                </View>

                {/* Weekday Indicators */}
                <View style={styles.weekdayRow}>
                    {WEEKDAYS.map((day, index) => {
                        const state = dayStates[index];
                        return (
                            <View key={index} style={styles.weekdayItem}>
                                <Text style={styles.weekdayLabel}>{day}</Text>
                                <View style={[
                                    styles.weekdayCircle,
                                    state === 'checked' && styles.weekdayCircleChecked,
                                    state === 'today' && styles.weekdayCircleToday,
                                    state === 'future' && styles.weekdayCircleFuture,
                                    state === 'past' && styles.weekdayCirclePast
                                ]}>
                                    {state === 'checked' && (
                                        <Ionicons name="checkmark" size={16} color="#fff" />
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Check-in Button */}
                {canCheckin ? (
                    <Pressable style={styles.checkinButton} onPress={onCheckin}>
                        <Text style={styles.checkinButtonText}>Check In</Text>
                    </Pressable>
                ) : (
                    <View style={styles.checkedInContainer}>
                        <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                        <Text style={styles.checkedInText}>You've checked in today!</Text>
                    </View>
                )}

                {/* Milestone Section */}
                <View style={styles.milestoneSection}>
                    <View style={styles.milestoneTitleRow}>
                        <View>
                            <Text style={styles.milestoneTitleText}>Costume Rewards</Text>
                            <Text style={styles.milestoneDescription}>
                                Reach streak milestones to unlock{'\n'}special costumes for {characterName}
                            </Text>
                        </View>
                    </View>

                    {/* Progress Track */}
                    <View style={styles.trackContainer}>
                        {/* Background Bar */}
                        <View style={styles.trackBackground} />

                        {/* Fill Bar */}
                        <LinearGradient
                            colors={['#FF4639', '#FF8E86']}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={[styles.trackFill, { width: fillWidthPercent }]}
                        />

                        {/* Current Progress Thumb - Sliding */}
                        <View style={[styles.currentThumb, { left: fillWidthPercent }]}>
                            <Ionicons name="flame" size={12} color="#fff" />
                        </View>

                        {/* Milestones */}
                        {milestones.map((m, index) => {
                            const positionPercent = (m.day / maxMilestoneDay) * 100;
                            const isReached = streakDays >= m.day;
                            const isNext = streakDays < m.day && (index === 0 || streakDays >= milestones[index - 1].day);

                            // Determine content
                            // If reached: Gift box or Costume Thumb?
                            // User said: "display thumb of received costume"
                            // If reached and claimable (for now handled as reached) -> Show thumb.
                            // If box shakes: wrap in animated view.

                            const isClaimed = ownedCostumeIds.has(m.costume.id);
                            const shouldShake = isReached && !isClaimed; // Only shake if reached but not claimed

                            return (
                                <View
                                    key={m.day}
                                    style={[styles.milestoneMarkerContainer, { left: `${positionPercent}%` }]}
                                >
                                    {/* <View style={styles.milestoneLine} /> removed */}

                                    <Pressable

                                        style={styles.milestoneContent}
                                    >
                                        <View style={styles.markerLabelContainer}>
                                            <Text style={styles.markerLabel}>
                                                Day {m.day}
                                            </Text>
                                        </View>

                                        {/* Gift content renders AFTER label in DOM but label is absolute positioned below */}

                                        {isReached ? (
                                            <Animated.View style={shouldShake ? { transform: [{ rotate: shakeRotate }] } : undefined}>
                                                <LiquidGlass
                                                    onPress={() => {
                                                        if (isReached && onClaimMilestone) {
                                                            // Dismiss sheet first, then show popup after a delay
                                                            sheetRef.current?.dismiss();
                                                            setTimeout(() => {
                                                                onClaimMilestone(m.costume, isClaimed);
                                                            }, 300);
                                                        }
                                                    }} style={styles.milestoneGiftBox}>
                                                    <GiftIcon width={32} height={32} />
                                                </LiquidGlass>
                                                {/* Overlay checkmark if claimed */}
                                                {isClaimed && (
                                                    <View style={styles.checkBadge}>
                                                        <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                                                    </View>
                                                )}
                                            </Animated.View>
                                        ) : (
                                            <View style={styles.milestoneLocked}>
                                                <GiftIcon width={24} height={24} style={{ opacity: 0.3 }} />
                                                <View style={styles.lockBadge}>
                                                    <Ionicons name="lock-closed" size={10} color="rgba(255,255,255,0.6)" />
                                                </View>
                                            </View>
                                        )}
                                    </Pressable>
                                </View>
                            );
                        })}
                    </View>

                    <View style={styles.progressLabels}>
                        <Text style={styles.progressLabelText}>Start</Text>
                        <Text style={styles.progressLabelText}>Day {maxMilestoneDay}</Text>
                    </View>
                </View>
            </ScrollView>
        </TrueSheet>
    );
});

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    sheetContent: {
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
    },
    friendshipRow: {
        flexDirection: 'row',
        alignItems: 'center',
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
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
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
        borderWidth: 3,
        borderColor: '#1a1a1a',
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
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    milestoneGiftBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: '#1a1a1a', // Dark bg to stand out on track
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FF4639',
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
        backgroundColor: '#1a1a1a',
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
