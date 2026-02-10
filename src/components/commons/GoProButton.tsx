import React from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSubscription } from '../../context/SubscriptionContext';

const DIAMOND_ICON_URL = 'https://s3.cloudfly.vn/colorme/files/P8UIHKMAHhfOrVIv6xaJufgaojWC5zOYpeuqJlNC.png';

type GoProButtonProps = {
    onPress?: () => void;
    label?: string;
};

export const GoProButton: React.FC<GoProButtonProps> = ({
    onPress,
    label = 'UnlockAll',
}) => {
    const { isPro } = useSubscription();

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
                isPro && styles.proContainer
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
        backgroundColor: 'rgba(139, 92, 246, 0.6)',
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

