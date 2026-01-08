import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Image, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CostumeItem } from '../repositories/CostumeRepository';

interface StreakRewardPopupProps {
    visible: boolean;
    costume: CostumeItem | null;
    isClaimed?: boolean;
    onClaim: () => Promise<void>;
    onClose: () => void;
}

export const StreakRewardPopup: React.FC<StreakRewardPopupProps> = ({
    visible,
    costume,
    isClaimed = false,
    onClaim,
    onClose
}) => {
    const [isClaiming, setIsClaiming] = React.useState(false);
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            scaleAnim.setValue(0.8);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    if (!visible || !costume) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Animated.View style={[styles.container, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
                    {/* Close Button */}
                    <Pressable style={styles.closeButton} onPress={onClose}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </Pressable>

                    {/* Top Gift Box Image - Placeholder or Asset */}
                    <View style={styles.giftBoxContainer}>
                        {/* Using a nice 3D gift box image URL here would be ideal. 
                            For now, using a large icon with a glow background. */}
                        <View style={styles.giftGlow} />
                        <Ionicons name="gift" size={80} color="#FFD700" style={styles.giftIcon} />
                    </View>

                    {/* Ribbon Header (Simulated) */}
                    <View style={styles.ribbonContainer}>
                        <LinearGradient
                            colors={['#FF5FA1', '#FF247C']}
                            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                            style={styles.ribbon}
                        >
                            <Ionicons name="sparkles" size={16} color="#fff" style={styles.ribbonStarLeft} />
                            <Ionicons name="sparkles" size={16} color="#fff" style={styles.ribbonStarRight} />
                        </LinearGradient>
                    </View>

                    {/* Card Content */}
                    <View style={styles.card}>
                        <View style={styles.contentSpacer} />

                        {/* Costume Image */}
                        <View style={styles.costumeContainer}>
                            {costume.thumbnail ? (
                                <Image
                                    source={{ uri: costume.thumbnail }}
                                    style={styles.costumeImage}
                                    resizeMode="contain"
                                />
                            ) : (
                                <View style={styles.placeholderCostume}>
                                    <Ionicons name="shirt" size={60} color="#ccc" />
                                </View>
                            )}
                        </View>

                        {/* Sparkles around costume */}
                        <Ionicons name="star" size={24} color="#FFD700" style={[styles.sparkle, styles.sparkle1]} />
                        <Ionicons name="star" size={16} color="#FFD700" style={[styles.sparkle, styles.sparkle2]} />

                        {/* Title/Subtitle */}
                        <Text style={styles.rewardTitle}>New Costume!</Text>
                        <Text style={styles.rewardName}>{costume.costume_name}</Text>

                        {/* Claim Button */}
                        <Pressable
                            style={[styles.claimButton, (isClaimed || isClaiming) && styles.claimButtonDisabled]}
                            onPress={async () => {
                                if (isClaimed) {
                                    onClose();
                                    return;
                                }
                                setIsClaiming(true);
                                try {
                                    await onClaim();
                                    onClose();
                                } catch (error) {
                                    console.error('Failed to claim costume:', error);
                                } finally {
                                    setIsClaiming(false);
                                }
                            }}
                            disabled={isClaiming}
                        >
                            <LinearGradient
                                colors={isClaimed ? ['#999', '#777'] : ['#FF5FA1', '#FF247C']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                style={styles.claimButtonGradient}
                            >
                                <Text style={styles.claimButtonText}>
                                    {isClaiming ? 'Claiming...' : isClaimed ? 'Claimed' : 'Claim Gift'}
                                </Text>
                            </LinearGradient>
                        </Pressable>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: 300,
        alignItems: 'center',
        position: 'relative',
    },
    closeButton: {
        position: 'absolute',
        top: -40,
        right: 0,
        zIndex: 20,
        padding: 8,
    },
    giftBoxContainer: {
        zIndex: 10,
        alignItems: 'center',
        marginBottom: -40, // Overlap deeply
    },
    giftIcon: {
        zIndex: 11,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 8,
    },
    giftGlow: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 215, 0, 0.3)',
        top: -10,
    },
    ribbonContainer: {
        zIndex: 5,
        width: '110%',
        alignItems: 'center',
        marginBottom: -10,
    },
    ribbon: {
        width: '100%',
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
        // Fancy ribbon shape not fully implemented, just a bar for now
    },
    ribbonStarLeft: {
        position: 'absolute',
        left: 20,
    },
    ribbonStarRight: {
        position: 'absolute',
        right: 20,
    },
    card: {
        backgroundColor: '#fff',
        width: '100%',
        borderRadius: 24,
        padding: 20,
        alignItems: 'center',
        paddingTop: 50, // Space for gift/ribbon overlap
    },
    contentSpacer: {
        height: 10,
    },
    costumeContainer: {
        width: 160,
        height: 200, // Tall for full body
        marginBottom: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    costumeImage: {
        width: '100%',
        height: '100%',
    },
    placeholderCostume: {
        width: 100,
        height: 100,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sparkle: {
        position: 'absolute',
    },
    sparkle1: {
        top: 80,
        left: 10,
    },
    sparkle2: {
        top: 100,
        right: 10,
    },
    rewardTitle: {
        fontSize: 14,
        color: '#888',
        fontWeight: '600',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    rewardName: {
        fontSize: 20,
        color: '#333',
        fontWeight: '800',
        marginBottom: 24,
        textAlign: 'center',
    },
    claimButton: {
        width: '100%',
        borderRadius: 999,
        overflow: 'hidden',
        shadowColor: '#FF247C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    claimButtonDisabled: {
        opacity: 0.8,
        shadowOpacity: 0.1,
    },
    claimButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    claimButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
});
