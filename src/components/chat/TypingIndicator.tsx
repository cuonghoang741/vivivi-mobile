import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

export const TypingIndicator: React.FC = () => {
  const dot1Scale = useSharedValue(0.6);
  const dot2Scale = useSharedValue(0.6);
  const dot3Scale = useSharedValue(0.6);
  const dot1Y = useSharedValue(0);
  const dot2Y = useSharedValue(0);
  const dot3Y = useSharedValue(0);

  useEffect(() => {
    // Wave animation
    dot1Y.value = withRepeat(
      withTiming(-6, { duration: 400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    dot1Scale.value = withRepeat(
      withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    dot2Y.value = withDelay(
      150,
      withRepeat(
        withTiming(-6, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
    dot2Scale.value = withDelay(
      150,
      withRepeat(
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );

    dot3Y.value = withDelay(
      300,
      withRepeat(
        withTiming(-6, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
    dot3Scale.value = withDelay(
      300,
      withRepeat(
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  }, []);

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1Y.value }, { scale: dot1Scale.value }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2Y.value }, { scale: dot2Scale.value }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3Y.value }, { scale: dot3Scale.value }],
  }));

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={['rgba(167,139,250,0.4)', 'rgba(139,92,246,0.4)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}
      >
        <BlurView intensity={30} tint="dark" style={styles.container}>
          <Animated.View style={[styles.dot, styles.dot1, dot1Style]} />
          <Animated.View style={[styles.dot, styles.dot2, dot2Style]} />
          <Animated.View style={[styles.dot, styles.dot3, dot3Style]} />
        </BlurView>
      </LinearGradient>
      {/* Glow */}
      <View style={styles.glow} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginVertical: 4,
  },
  gradientBorder: {
    padding: 1.5,
    borderRadius: 22,
    borderTopLeftRadius: 6,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 20,
    borderTopLeftRadius: 4,
    gap: 8,
    overflow: 'hidden',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dot1: {
    backgroundColor: '#a78bfa',
  },
  dot2: {
    backgroundColor: '#a78bfa',
  },
  dot3: {
    backgroundColor: '#6dd5ed',
  },
  glow: {
    position: 'absolute',
    bottom: -4,
    left: 8,
    right: 8,
    height: 8,
    backgroundColor: 'rgba(167,139,250,0.2)',
    borderRadius: 20,
    transform: [{ scaleY: 0.5 }],
  },
});

export default TypingIndicator;
