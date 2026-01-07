import React, { useMemo, useRef } from 'react';
import {
    View,
    StyleSheet,
    Animated,
    PanResponder,
    Dimensions,
    type ViewStyle,
    type StyleProp,
    GestureResponderEvent,
    PanResponderGestureState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isLiquidGlassSupported, LiquidGlassView } from '@callstack/liquid-glass';
import { sheetColors } from '../styles/color';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CustomSheetProps {
    children: React.ReactNode;
    /** Snap points as percentages of screen height (0-1), e.g. [0.25, 0.5, 0.85] */
    snapPoints?: number[];
    /** Initial snap point index */
    initialSnapIndex?: number;
    /** Background color when LiquidGlass is not supported */
    fallbackBackgroundColor?: string;
    /** Whether to use dark theme (affects fallback colors) */
    isDark?: boolean;
    /** Additional style for the sheet container */
    style?: StyleProp<ViewStyle>;
    /** Corner radius */
    cornerRadius?: number;
    /** Called when sheet snaps to a different point */
    onSnapChange?: (index: number) => void;
}

export const CustomSheet: React.FC<CustomSheetProps> = ({
    children,
    snapPoints: snapPointsPercentage = [0.25, 0.5, 0.85],
    initialSnapIndex = 0,
    fallbackBackgroundColor,
    isDark = true,
    style,
    cornerRadius = 24,
    onSnapChange,
}) => {
    const insets = useSafeAreaInsets();

    // Calculate snap points in pixels
    const snapPoints = useMemo(
        () => snapPointsPercentage.map(p => SCREEN_HEIGHT * p),
        [snapPointsPercentage]
    );

    const initialHeight = snapPoints[initialSnapIndex];
    const sheetHeight = useRef(new Animated.Value(initialHeight)).current;
    const lastSnapIndex = useRef(initialSnapIndex);

    const panResponder = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: (_: GestureResponderEvent, gestureState: PanResponderGestureState) =>
            Math.abs(gestureState.dy) > 5,
        onPanResponderGrant: () => {
            sheetHeight.stopAnimation();
        },
        onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
            const currentHeight = snapPoints[lastSnapIndex.current];
            const newHeight = currentHeight - gestureState.dy;
            const minHeight = snapPoints[0];
            const maxHeight = snapPoints[snapPoints.length - 1];
            const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
            sheetHeight.setValue(clampedHeight);
        },
        onPanResponderRelease: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
            const currentHeight = snapPoints[lastSnapIndex.current];
            const newHeight = currentHeight - gestureState.dy;

            // Find closest snap point
            let closestIndex = 0;
            let closestDistance = Math.abs(newHeight - snapPoints[0]);
            for (let i = 1; i < snapPoints.length; i++) {
                const distance = Math.abs(newHeight - snapPoints[i]);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestIndex = i;
                }
            }

            // Consider velocity for snap direction
            if (Math.abs(gestureState.vy) > 0.5) {
                if (gestureState.vy > 0 && closestIndex > 0) {
                    closestIndex--;
                } else if (gestureState.vy < 0 && closestIndex < snapPoints.length - 1) {
                    closestIndex++;
                }
            }

            const prevIndex = lastSnapIndex.current;
            lastSnapIndex.current = closestIndex;

            if (prevIndex !== closestIndex && onSnapChange) {
                onSnapChange(closestIndex);
            }

            Animated.spring(sheetHeight, {
                toValue: snapPoints[closestIndex],
                useNativeDriver: false,
                friction: 8,
                tension: 65,
            }).start();
        },
    })).current;

    const defaultFallbackColor = isDark
        ? 'rgba(255,255,255,0.95)'
        : 'rgba(0,0,0,0.95)';

    const containerStyle = useMemo(() => ({
        borderTopLeftRadius: cornerRadius,
        borderTopRightRadius: cornerRadius,
        backgroundColor: isLiquidGlassSupported ? 'transparent' : (fallbackBackgroundColor || defaultFallbackColor),
        overflow: 'hidden' as const,
        flex: 1,
    }), [cornerRadius, fallbackBackgroundColor, defaultFallbackColor]);

    const grabberColor = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)';

    const renderGrabber = () => (
        <View style={styles.grabberContainer} {...panResponder.panHandlers}>
            <View style={[styles.grabber, { backgroundColor: grabberColor }]} />
        </View>
    );

    const renderContent = () => (
        <View style={[containerStyle, style]}>
            {renderGrabber()}
            {children}
        </View>
    );

    if (isLiquidGlassSupported) {
        return (
            <Animated.View style={[styles.wrapper, { height: sheetHeight }]}>
                <LiquidGlassView style={styles.liquidGlass} effect="regular" tintColor={isDark ? sheetColors.light : sheetColors.dark}>
                    {renderGrabber()}
                    {children}
                </LiquidGlassView>
            </Animated.View>
        );
    }

    return (
        <Animated.View style={[styles.wrapper, { height: sheetHeight }]}>
            {renderContent()}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    liquidGlass: {
        flex: 1,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    grabberContainer: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 8,
        minHeight: 36,
        justifyContent: 'center',
    },
    grabber: {
        width: 40,
        height: 5,
        borderRadius: 2.5,
    },
});

export default CustomSheet;
