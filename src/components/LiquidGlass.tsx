import React from 'react';
import { View, type ViewProps, PressableProps } from 'react-native';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { glassButtonStyle } from '../styles/glass';
import HapticPressable from './ui/HapticPressable';

type Props = ViewProps & {
  children: React.ReactNode;
  tintColor?: string;
  interactive?: boolean;
  pressable?: boolean;
  onPress?: PressableProps['onPress'];
  disabled?: boolean;
  isDarkBackground?: boolean;
};

/**
 * LiquidGlass - wrapper component
 * - Nếu thiết bị support liquid-glass (iOS 26+), dùng LiquidGlassView
 * - Nếu không, fallback về View với style glassButtonStyle
 * - Khi pressable=true (default), tự động bọc trong HapticPressable để có hiệu ứng press
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
  ...rest
}) => {
  const baseStyle = [glassButtonStyle, style];

  // Determine tint color based on isDarkBackground if not explicitly provided
  const effectiveTintColor = tintColor ?? (isDarkBackground ? "#000000a7" : "#ffffff50");

  // Content wrapper - LiquidGlassView hoặc View
  const renderContent = () => {
    if (isLiquidGlassSupported) {
      // Only pass valid props to LiquidGlassView
      const liquidProps: any = {
        style: baseStyle,
        tintColor: effectiveTintColor,
        effect: 'regular',
      };

      // Interactive prop: true nếu có pressable và onPress, hoặc nếu được set explicitly
      const shouldBeInteractive = interactive !== undefined
        ? interactive
        : (pressable && !!onPress);

      if (shouldBeInteractive) {
        liquidProps.interactive = true;
      }

      return (
        <LiquidGlassView {...liquidProps}>
          {children}
        </LiquidGlassView>
      );
    }

    return (
      <View style={baseStyle} {...rest}>
        {children}
      </View>
    );
  };

  // Nếu pressable và có onPress, bọc trong HapticPressable
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

  // Không có pressable hoặc không có onPress, render trực tiếp
  return renderContent();
};


