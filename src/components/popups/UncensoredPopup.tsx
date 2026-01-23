import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { DiamondBadge } from '../DiamondBadge';
import * as Animatable from 'react-native-animatable';
import { LiquidGlass } from '../LiquidGlass';
import Ionicons from '@expo/vector-icons/Ionicons';

interface UncensoredPopupProps {
    visible: boolean;
    onClose: () => void;
    onUpgrade: () => void;
    isDarkBackground?: boolean;
}

export const UncensoredPopup: React.FC<UncensoredPopupProps> = ({
    visible,
    onClose,
    onUpgrade,
    isDarkBackground = true,
}) => {
    const { width } = useWindowDimensions();

    if (!visible) return null;

    return (
        <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="box-none">
            <Animatable.View
                animation="fadeInUp"
                duration={400}
                style={[styles.contentContainer, { width: Math.min(width - 40, 340) }]}
            >
                <LiquidGlass style={styles.glassContainer}>
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="eye-off" size={24} color="#fff" />
                        </View>
                        <DiamondBadge size="md" />
                    </View>

                    <Text style={styles.title}>Uncensored Mode</Text>
                    <Text style={styles.description}>
                        Upgrade to Pro to remove the blur and unlock uncensored experience.
                    </Text>

                    <TouchableOpacity style={styles.upgradeButton} onPress={onUpgrade}>
                        <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.backButton} onPress={onClose}>
                        <Text style={styles.backButtonText}>No thanks, go back</Text>
                    </TouchableOpacity>
                </LiquidGlass>
            </Animatable.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    contentContainer: {
        borderRadius: 24,
        overflow: 'hidden',
    },
    glassContainer: {
        padding: 24,
        alignItems: 'center',
        backgroundColor: 'rgba(20, 20, 30, 0.85)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    upgradeButton: {
        width: '100%',
        paddingVertical: 14,
        backgroundColor: '#FFD700',
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    upgradeButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
    },
    backButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    backButtonText: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: '500',
    },
});
