import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, ViewStyle, StyleProp, View } from 'react-native';
import { LiquidGlass } from './LiquidGlass';

type ModalLiquidGlassProps = {
  visible: boolean;
  onRequestClose?: () => void;
  children: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  disableBackgroundDismiss?: boolean;
  animationDuration?: number;
};

export const ModalLiquidGlass: React.FC<ModalLiquidGlassProps> = ({
  visible,
  onRequestClose,
  children,
  containerStyle,
  disableBackgroundDismiss,
  animationDuration = 180,
}) => {
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: animationDuration,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 13,
          stiffness: 170,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: animationDuration * 0.75,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.94,
          duration: animationDuration * 0.75,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, animationDuration, opacityAnim, scaleAnim]);

  const handleBackdropPress = () => {
    if (disableBackgroundDismiss) {
      return;
    }
    onRequestClose?.();
  };

  return (
    <View style={styles.portal} pointerEvents="box-none">
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]} pointerEvents={visible ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
      </Animated.View>

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.modalWrapper,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <LiquidGlass style={[styles.liquidContainer, containerStyle]} pressable={false}>
          {children}
        </LiquidGlass>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  portal: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100000,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  modalWrapper: {
    width: '90%',
    maxWidth: 420,
    paddingHorizontal: 6,
  },
  liquidContainer: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
  },
});

