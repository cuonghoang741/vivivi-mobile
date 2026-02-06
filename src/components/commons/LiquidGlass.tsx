import React from 'react';
import { View, type ViewProps, PressableProps, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { glassButtonStyle } from '../../styles/glass';
import HapticPressable from '../ui/HapticPressable';

type Props = ViewProps & {
  children: React.ReactNode;
  tintColor?: string;
  interactive?: boolean;
  pressable?: boolean;
  onPress?: PressableProps['onPress'];
  disabled?: boolean;
  isDarkBackground?: boolean;
  intensity?: number;
};

/**
 * LiquidGlass - wrapper component
 * Fallback to Expo BlurView for stability
 */
export const LiquidGlass: React.FC<Props> = ({
  style,
  children,
  tintColor,
  interactive,
  pressable = true,
  onPress,
  disabled,
  isDarkBackground,
  intensity = 20,
  ...rest
}) => {
  const baseStyle = [glassButtonStyle, style];

  // Content wrapper - BlurView
  const renderContent = () => {
    return (
      <View style={[baseStyle, { overflow: 'hidden' }]} {...rest}>
        <BlurView
          intensity={intensity}
          tint={isDarkBackground ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </View>
    );
  };

  if (pressable && onPress) {
    return (
      <HapticPressable
        onPress={onPress}
        disabled={disabled}
      >
        {renderContent()}
      </HapticPressable>
    );
  }

  return renderContent();
};


