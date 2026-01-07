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
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import StreakIcon from '../../assets/icons/streak.svg';
import { LiquidGlass } from '../LiquidGlass';

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
}, ref) => {
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

    // Calculate milestone progress (streak towards 7-day goal)
    // Progress resets after each 7-day cycle
    const milestoneTarget = 7;

    // Calculate day within current 7-day cycle (1-7)
    // If streakDays = 0, show Day 0
    // If streakDays = 1-7, show Day 1-7 
    // If streakDays = 8, show Day 1 (new cycle)
    // If streakDays = 14, show Day 7 (completed second cycle)
    const currentMilestoneDay = streakDays === 0
        ? 0
        : ((streakDays - 1) % milestoneTarget) + 1;

    // Progress bar: currentMilestoneDay / 7
    const milestoneProgress = currentMilestoneDay / milestoneTarget;

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
                        Check in every day to keep your streak{'\n'}and earn a special costume every 7 days!
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
                            <Text style={styles.milestoneTitleText}>Next Costume Reward</Text>
                            <Text style={styles.milestoneDescription}>
                                Reach a 7-day streak to unlock{'\n'}a random costume for {characterName}
                            </Text>
                        </View>
                        <View style={styles.rewardIconContainer}>
                            <Ionicons name="shirt-outline" size={28} color="rgba(255,255,255,0.4)" />
                        </View>
                    </View>

                    <View style={styles.progressContainer}>
                        <LinearGradient
                            colors={['#FF4639', '#FF8E86']}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={[styles.progressFill, { width: `${milestoneProgress * 100}%` }]}
                        />
                        <View style={[styles.progressThumb, { left: `${milestoneProgress * 100}%` }]}>
                            <Ionicons name="flame" size={14} color="#fff" />
                        </View>
                    </View>
                    <View style={styles.progressLabels}>
                        <Text style={styles.progressLabelText}>Day {currentMilestoneDay}</Text>
                        <Text style={styles.progressLabelText}>Day {milestoneTarget}</Text>
                    </View>
                </View>

                {/* Connection Section */}
                <View style={styles.connectionSection}>
                    <Text style={styles.connectionTitle}>Connection Level</Text>
                    <Text style={styles.connectionDescription}>
                        Chat to improve your connection
                    </Text>

                    <View style={styles.connectionProgressContainer}>
                        <LinearGradient
                            colors={['#FF579A', '#AE0045']}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={[styles.connectionProgressFill, { width: `${connectionProgress * 100}%` }]}
                        />
                        <View style={[styles.connectionThumb, { left: `${connectionProgress * 100}%` }]}>
                            <Ionicons name="heart" size={14} color="#fff" />
                        </View>
                    </View>
                    <View style={styles.progressLabels}>
                        <Text style={styles.progressLabelText}>Level {connectionLevel}</Text>
                        <Text style={styles.progressLabelText}>Level {(connectionLevel || 0) + 1}</Text>
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
    progressThumb: {
        position: 'absolute',
        top: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FF4639',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -16,
        shadowColor: '#FF4639',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
    },
    progressLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    progressLabelText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
    },
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
