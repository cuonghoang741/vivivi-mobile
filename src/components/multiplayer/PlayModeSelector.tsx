import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconUser, IconUsers, IconSparkles } from '@tabler/icons-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';

interface PlayModeSelectorProps {
    onSelectSolo: () => void;
    onSelectMultiplayer: () => void;
    characterPreviewUrl?: string;
}

export const PlayModeSelector: React.FC<PlayModeSelectorProps> = ({
    onSelectSolo,
    onSelectMultiplayer,
}) => {
    const insets = useSafeAreaInsets();
    const { width } = Dimensions.get('window');
    const cardWidth = (width - 48 - 12) / 2;

    const handleSolo = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSelectSolo();
    };

    const handleMultiplayer = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSelectMultiplayer();
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
            {/* Background gradient */}
            <LinearGradient
                colors={['#0a0a0f', '#1a1a2e', '#16213e']}
                style={StyleSheet.absoluteFill}
            />

            {/* Header */}
            <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
                <View style={styles.logoContainer}>
                    <IconSparkles size={28} color="#ff6b9d" />
                    <Text style={styles.logoText}>DIDI</Text>
                </View>
                <Text style={styles.subtitle}>Choose your experience</Text>
            </Animated.View>

            {/* Mode Cards */}
            <View style={styles.cardsContainer}>
                {/* Solo Mode Card */}
                <Animated.View entering={FadeInUp.delay(200)}>
                    <Pressable onPress={handleSolo}>
                        <BlurView intensity={20} tint="dark" style={[styles.card, { width: cardWidth }]}>
                            <LinearGradient
                                colors={['rgba(139, 92, 246, 0.3)', 'rgba(139, 92, 246, 0.1)']}
                                style={styles.cardGradient}
                            >
                                <View style={styles.iconContainer}>
                                    <IconUser size={48} color="#a78bfa" strokeWidth={1.5} />
                                </View>
                                <Text style={styles.cardTitle}>Solo</Text>
                                <Text style={styles.cardDescription}>
                                    Chat privately with your AI companion
                                </Text>
                            </LinearGradient>
                        </BlurView>
                    </Pressable>
                </Animated.View>

                {/* Multiplayer Mode Card */}
                <Animated.View entering={FadeInUp.delay(300)}>
                    <Pressable onPress={handleMultiplayer}>
                        <BlurView intensity={20} tint="dark" style={[styles.card, { width: cardWidth }]}>
                            <LinearGradient
                                colors={['rgba(255, 107, 157, 0.3)', 'rgba(255, 107, 157, 0.1)']}
                                style={styles.cardGradient}
                            >
                                <View style={styles.iconContainer}>
                                    <IconUsers size={48} color="#ff6b9d" strokeWidth={1.5} />
                                </View>
                                <Text style={styles.cardTitle}>Multiplayer</Text>
                                <Text style={styles.cardDescription}>
                                    Share the experience with friends
                                </Text>
                                <View style={styles.newBadge}>
                                    <Text style={styles.newBadgeText}>NEW</Text>
                                </View>
                            </LinearGradient>
                        </BlurView>
                    </Pressable>
                </Animated.View>
            </View>

            {/* Footer hint */}
            <Animated.View entering={FadeInUp.delay(400)} style={styles.footer}>
                <Text style={styles.footerText}>
                    Swipe up to see your characters
                </Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    logoText: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 2,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: '500',
    },
    cardsContainer: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'center',
    },
    card: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    cardGradient: {
        padding: 24,
        alignItems: 'center',
        minHeight: 200,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    cardDescription: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.6)',
        textAlign: 'center',
        lineHeight: 18,
    },
    newBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: '#ff6b9d',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    newBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 1,
    },
    footer: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 40,
    },
    footerText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.4)',
    },
});
