import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

type NotificationDotProps = {
    style?: ViewStyle;
    size?: number;
};

export const NotificationDot: React.FC<NotificationDotProps> = ({
    style,
    size = 15
}) => {
    return (
        <View style={[styles.container, style]}>
            <View
                style={[
                    styles.dot,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2
                    }
                ]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: -1,
        right: -1,
        zIndex: 10,
    },
    dot: {
        backgroundColor: '#FF3B30',
        borderWidth: 2,
        borderColor: '#ffffffa5',
    },
});
