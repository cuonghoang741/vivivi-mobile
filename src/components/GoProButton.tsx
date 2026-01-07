import React from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DIAMOND_ICON_URL = 'https://d1j8r0kxyu9tj8.cloudfront.net/files/gHCihrZqs0a7K0rms5qSXE1TRs8FuWwPWaEeLIey.png';

type GoProButtonProps = {
    onPress?: () => void;
    label?: string;
};

export const GoProButton: React.FC<GoProButtonProps> = ({
    onPress,
    label = 'Go Unlimited',
}) => {
    const [isPro, setIsPro] = React.useState(false);

    React.useEffect(() => {
        const checkStatus = async () => {
            try {
                const tier = await AsyncStorage.getItem('subscription.tier');
                if (tier?.toLowerCase() === 'pro') {
                    setIsPro(true);
                }
            } catch (e) {
                // ignore
            }
        };
        checkStatus();

        // Add a simple interval or event listener if needed, but for now mount check is okay
        // optimizing to check every time window focus might be better in future
        const interval = setInterval(checkStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
    };

    const finalLabel = isPro ? 'PRO' : label;

    return (
        <Pressable
            style={({ pressed }) => [
                styles.container,
                pressed && styles.pressed,
                isPro && styles.proContainer // Optional: different style for Pro
            ]}
            onPress={handlePress}
        >
            <Image
                source={{ uri: DIAMOND_ICON_URL }}
                style={styles.icon}
            />
            <Text style={styles.label}>{finalLabel}</Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 87, 154, 0.6)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 100,
        gap: 9,
        height: 40,
    },
    pressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }],
    },
    icon: {
        width: 18,
        height: 18,
    },
    label: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    proContainer: {
        backgroundColor: 'rgba(255, 215, 0, 0.2)', // Gold tint
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.5)',
    },
});

export default GoProButton;

