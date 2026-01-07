import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Animated } from 'react-native';

interface VoiceLoadingOverlayProps {
    visible: boolean;
    message?: string;
}

export const VoiceLoadingOverlay: React.FC<VoiceLoadingOverlayProps> = ({
    visible,
    message = 'Preparing voice call...',
}) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: visible ? 1 : 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [visible]);

    // if (!visible && fadeAnim._value === 0) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                { opacity: fadeAnim },
                !visible && { pointerEvents: 'none' } // Pass through touches when fading out
            ]}
        >
            <View style={styles.content}>
                <ActivityIndicator size="large" color="#FF2F71" />
                <Text style={styles.text}>{message}</Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.85)', // Dark overlay to simulate blur/focus
        zIndex: 9999, // High z-index to cover everything
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        alignItems: 'center',
        padding: 24,
    },
    text: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '600',
        marginTop: 16,
        letterSpacing: 0.5,
    },
});
