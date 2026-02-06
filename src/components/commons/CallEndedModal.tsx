import React from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import DiamondIcon from '../../assets/icons/diamond.svg';
import { ModalLiquidGlass } from './ModalLiquidGlass';

interface CallEndedModalProps {
    visible: boolean;
    characterName: string;
    characterAvatar?: string;
    callDuration: string; // Format: "MM:SS"
    isPro: boolean;
    onClose: () => void;
    onUpgrade: () => void;
}

export const CallEndedModal: React.FC<CallEndedModalProps> = ({
    visible,
    characterName,
    characterAvatar,
    callDuration,
    isPro,
    onClose,
    onUpgrade,
}) => {
    const insets = useSafeAreaInsets();

    const message = isPro
        ? `Your monthly call time has been used up. It will reset at the start of next month.`
        : `You've used all your call time for now. Upgrade to spend more time with ${characterName}`;

    return (
        <ModalLiquidGlass
            visible={visible}
            onRequestClose={onClose}
            containerStyle={[styles.content, { paddingBottom: Math.max(24) }]}
        >
            {/* X Close Button */}
            <Pressable style={styles.xCloseButton} onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={24} color="black" />
            </Pressable>

            {/* Avatar */}
            <View style={styles.avatarContainer}>
                {characterAvatar ? (
                    <Image
                        source={{ uri: characterAvatar }}
                        style={styles.avatar}
                        contentFit="cover"
                    />
                ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]} />
                )}
            </View>

            {/* Title */}
            <Text style={styles.title}>Call ended</Text>
            <Text style={styles.duration}>{callDuration}</Text>

            {/* Message */}
            <Text style={styles.message}>{message}</Text>

            {/* Premium Card (only for non-pro users) */}
            {!isPro && (
                <LinearGradient
                    colors={['#FF6B8A', '#FF8FA3']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.premiumCard}
                >
                    <View style={styles.premiumCardContent}>
                        <View style={styles.premiumCardLeft}>
                            <View style={styles.premiumBadgeRow}>
                                <Text style={styles.lustyText}>Lusty</Text>
                                <View style={styles.premiumBadge}>
                                    <Text style={styles.premiumBadgeText}>Premium</Text>
                                </View>
                            </View>
                            <Text style={styles.premiumDescription}>
                                Unlock unlimited content and{'\n'}premium features.
                            </Text>
                        </View>
                        <DiamondIcon width={60} height={60} fill="#FF8FA3" />
                    </View>

                    <Pressable
                        style={styles.upgradeButton}
                        onPress={() => {
                            onClose();
                            onUpgrade();
                        }}
                    >
                        <Text style={styles.upgradeButtonText}>Unlock Premium</Text>
                    </Pressable>
                </LinearGradient>
            )}
        </ModalLiquidGlass>
    );
};

const styles = StyleSheet.create({
    content: {
        alignItems: 'center',
        paddingTop: 40,
        paddingHorizontal: 20,
    },
    xCloseButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 40,
        height: 40,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    avatarContainer: {
        marginBottom: 24,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    avatarPlaceholder: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        marginBottom: 8,
    },
    duration: {
        fontSize: 18,
        marginBottom: 20,
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
        paddingHorizontal: 10,
    },
    premiumCard: {
        width: '100%',
        borderRadius: 20,
        padding: 20,
        overflow: 'hidden',
    },
    premiumCardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    premiumCardLeft: {
        flex: 1,
    },
    premiumBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    lustyText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
    },
    premiumBadge: {
        backgroundColor: '#FFE66D',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    premiumBadgeText: {
        color: '#000',
        fontSize: 12,
        fontWeight: '700',
    },
    premiumDescription: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        lineHeight: 20,
    },
    upgradeButton: {
        backgroundColor: '#FFE66D',
        borderRadius: 25,
        paddingVertical: 14,
        alignItems: 'center',
    },
    upgradeButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
    },
    closeButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 25,
        paddingVertical: 14,
        paddingHorizontal: 60,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default CallEndedModal;
