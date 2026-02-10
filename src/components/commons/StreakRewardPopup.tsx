import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Image, Animated, ImageBackground, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CostumeItem } from '../../repositories/CostumeRepository';

// Import particle SVGs
import Particle1 from '../../assets/icons/particles/1.svg';
import Particle2 from '../../assets/icons/particles/2.svg';
import Particle3 from '../../assets/icons/particles/3.svg';
import Particle5 from '../../assets/icons/particles/5.svg';
import Particle6 from '../../assets/icons/particles/6.svg';

const BACKGROUND_IMAGE = 'https://d1j8r0kxyu9tj8.cloudfront.net/files/iosHq5VnHsYbT4Xn9CfmSWLbWh7fuyqORtAC9Q2k.png';

// Particle components array
const PARTICLE_COMPONENTS = [Particle1, Particle2, Particle3, Particle5, Particle6];

interface SparkleData {
    id: number;
    particleIndex: number;
    size: number;
    angle: number;
    distance: number;
    delay: number;
    duration: number;
    rotation: number;
    shouldStay: boolean; // If true, particle stays visible after animation
}

// Generate sparkle particles
const generateSparkles = (count: number): SparkleData[] => {
    // Most particles stay visible (around 18)
    const stayCount = Math.floor(Math.random() * 3) + 17; // 17-19
    const stayIndices = new Set<number>();
    while (stayIndices.size < Math.min(stayCount, count)) {
        stayIndices.add(Math.floor(Math.random() * count));
    }

    return Array.from({ length: count }, (_, i) => {
        const shouldStay = stayIndices.has(i);
        return {
            id: i,
            particleIndex: Math.floor(Math.random() * PARTICLE_COMPONENTS.length),
            size: Math.random() * 20 + 20, // 20-40px
            angle: (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5,
            // Staying particles are closer (60-120px), others go further (100-250px)
            distance: shouldStay
                ? Math.random() * 60 + 60  // 60-120px for staying
                : Math.random() * 150 + 100, // 100-250px for fading
            delay: Math.random() * 300,
            duration: Math.random() * 600 + 1000, // 1000-1600ms
            rotation: Math.random() * 360, // Random initial rotation
            shouldStay,
        };
    });
};

// Sparkle component
const Sparkle: React.FC<{ data: SparkleData; startAnimation: boolean }> = ({ data, startAnimation }) => {
    const animValue = useRef(new Animated.Value(0)).current;
    const opacityValue = useRef(new Animated.Value(0)).current;
    const rotateValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (startAnimation) {
            animValue.setValue(0);
            opacityValue.setValue(0);
            rotateValue.setValue(0);

            setTimeout(() => {
                Animated.parallel([
                    Animated.timing(animValue, {
                        toValue: 1,
                        duration: data.duration,
                        useNativeDriver: true,
                    }),
                    // If shouldStay, fade in and stay; otherwise fade in then out
                    data.shouldStay
                        ? Animated.timing(opacityValue, {
                            toValue: 0.7, // Stay at 70% opacity
                            duration: 300,
                            useNativeDriver: true,
                        })
                        : Animated.sequence([
                            Animated.timing(opacityValue, {
                                toValue: 1,
                                duration: 200,
                                useNativeDriver: true,
                            }),
                            Animated.timing(opacityValue, {
                                toValue: 0,
                                duration: data.duration - 200,
                                useNativeDriver: true,
                            }),
                        ]),
                    Animated.timing(rotateValue, {
                        toValue: 1,
                        duration: data.duration,
                        useNativeDriver: true,
                    }),
                ]).start();
            }, data.delay);
        }
    }, [startAnimation]);

    const translateX = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, Math.cos(data.angle) * data.distance],
    });

    const translateY = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, Math.sin(data.angle) * data.distance],
    });

    const scale = animValue.interpolate({
        inputRange: [0, 0.3, 1],
        outputRange: [0, 1.3, data.shouldStay ? 0.8 : 0.5], // Staying particles are a bit bigger
    });

    const rotate = rotateValue.interpolate({
        inputRange: [0, 1],
        outputRange: [`${data.rotation}deg`, `${data.rotation + 180}deg`],
    });

    const ParticleComponent = PARTICLE_COMPONENTS[data.particleIndex];

    return (
        <Animated.View
            style={[
                styles.sparkle,
                {
                    opacity: opacityValue,
                    transform: [{ translateX }, { translateY }, { scale }, { rotate }],
                },
            ]}
        >
            <ParticleComponent width={data.size} height={data.size} />
        </Animated.View>
    );
};

// Sparkles container
const SparklesEffect: React.FC<{ visible: boolean }> = ({ visible }) => {
    const sparkles = useMemo(() => generateSparkles(24), []);
    const [startAnimation, setStartAnimation] = React.useState(false);

    useEffect(() => {
        if (visible) {
            setStartAnimation(false);
            // Small delay to ensure component is mounted
            setTimeout(() => setStartAnimation(true), 100);
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <View style={styles.sparklesContainer} pointerEvents="none">
            {sparkles.map((sparkle) => (
                <Sparkle key={sparkle.id} data={sparkle} startAnimation={startAnimation} />
            ))}
        </View>
    );
};

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
                {/* Sparkles Effect */}
                <SparklesEffect visible={visible && !isClaimed} />

                <Animated.View style={[styles.container, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
                    <ImageBackground
                        source={{ uri: BACKGROUND_IMAGE }}
                        style={styles.backgroundImage}
                        resizeMode="contain"
                    >
                        {/* Close Button */}
                        <Pressable style={styles.closeButton} onPress={onClose}>
                            <View style={styles.closeButtonCircle}>
                                <Ionicons name="close" size={20} color="#fff" />
                            </View>
                        </Pressable>

                        {/* Costume Image - Centered */}

                        <View style={{
                            flex: 1,
                            flexDirection: 'column',
                            justifyContent: 'flex-end'
                        }}>
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
                        </View>

                        {/* Bottom Section: Title + Button */}
                        <View style={styles.bottomSection}>
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
                                    colors={isClaimed ? ['#999', '#777'] : ['#a78bfa', '#8b5cf6']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={styles.claimButtonGradient}
                                >
                                    <Text style={styles.claimButtonText}>
                                        {isClaiming ? 'Claiming...' : isClaimed ? 'Claimed' : 'Claim Gift'}
                                    </Text>
                                </LinearGradient>
                            </Pressable>
                        </View>
                    </ImageBackground>
                </Animated.View>
            </View>
        </Modal>
    );
};

const { width: screenWidth } = Dimensions.get('window');
const popupWidth = Math.min(screenWidth * 0.95, 380);
const popupHeight = popupWidth * 1.4; // Maintain aspect ratio based on background image

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: popupWidth,
        height: popupHeight,
    },
    backgroundImage: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 20,
    },
    closeButtonCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    costumeContainer: {
        height: '60%',
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 20,
        paddingHorizontal: 40,
    },
    costumeImage: {
        width: '100%',
        height: '100%',
        maxWidth: 200,
        maxHeight: 260,
    },
    placeholderCostume: {
        width: 120,
        height: 160,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bottomSection: {
        paddingHorizontal: 24,
        paddingBottom: 28,
        alignItems: 'center',
    },
    rewardTitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '600',
        marginBottom: 4,
        textTransform: 'uppercase',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    rewardName: {
        fontSize: 22,
        color: '#fff',
        fontWeight: '800',
        marginBottom: 16,
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    claimButton: {
        width: '90%',
        borderRadius: 999,
        overflow: 'hidden',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
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
    sparklesContainer: {
        position: 'absolute',
        top: '35%',
        left: '50%',
        width: 0,
        height: 0,
        zIndex: 100,
    },
    sparkle: {
        position: 'absolute',
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
});
