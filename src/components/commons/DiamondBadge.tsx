import React, { useMemo } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { LiquidGlassView } from '@callstack/liquid-glass';
import DiamondIcon from '../../assets/icons/diamond.svg';

type BadgeSize = 'sm' | 'md' | 'lg';

interface DiamondBadgeProps {
    style?: StyleProp<ViewStyle>;
    size?: BadgeSize;
}

const SIZE_CONFIG = {
    sm: { container: 28, icon: 16, borderRadius: 14 },
    md: { container: 44, icon: 24, borderRadius: 22 },
    lg: { container: 52, icon: 32, borderRadius: 26 },
};

export const DiamondBadge: React.FC<DiamondBadgeProps> = ({ style, size = 'md' }) => {
    const config = SIZE_CONFIG[size];

    const glassStyle = useMemo(() => ({
        width: config.container,
        height: config.container,
        borderRadius: config.borderRadius,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
    }), [config]);

    return (
        <View style={[styles.container, { borderRadius: config.borderRadius }, style]}>
            <LiquidGlassView style={glassStyle} tintColor="#f8cbdfa5">
                <DiamondIcon width={config.icon} height={config.icon} />
            </LiquidGlassView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        shadowColor: '#fff',
        shadowOffset: {
            width: 0,
            height: 0,
        },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 5,
    },
});
