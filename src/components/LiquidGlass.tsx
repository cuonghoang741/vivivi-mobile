import React from 'react';
import { View, type ViewProps } from 'react-native';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { glassButtonStyle } from '../styles/glass';

type Props = ViewProps & {
  children: React.ReactNode;
  tintColor?: string;
};

/**
 * LiquidGlass - wrapper component
 * - Nếu thiết bị support liquid-glass (iOS 26+), dùng LiquidGlassView
 * - Nếu không, fallback về View với style glassButtonStyle
 */
export const LiquidGlass: React.FC<Props> = ({ style, children, tintColor, ...rest }) => {
  const baseStyle = [glassButtonStyle, style];

  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView style={baseStyle} {...rest} tintColor={tintColor} effect={"regular"}>
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


