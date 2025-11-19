import React from 'react';
import {
  ActivityIndicator,
  ColorValue,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LiquidGlass } from './LiquidGlass';
import HapticPressable from './ui/HapticPressable';
import { buttonColors, type ButtonColorKey } from '../styles/color';

export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'link' | 'liquid';

export interface ButtonProps {
  children?: React.ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
  color?: 'primary' | 'error' | 'success' | 'gray';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  isIconOnly?: boolean;
  startIconName?: keyof typeof Ionicons.glyphMap;
  endIconName?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  size = 'md',
  variant = 'liquid',
  color = 'primary',
  disabled,
  loading,
  fullWidth,
  isIconOnly,
  startIconName,
  endIconName,
  onPress,
  style,
}) => {
  const baseColors = getBaseColors(color);
  const { buttonStyle, textStyle, iconSize } = getStyles({
    size,
    variant,
    baseColors,
    fullWidth: !!fullWidth,
    disabled: !!disabled,
    loading: !!loading,
    isIconOnly: !!isIconOnly,
  });

  const baseStyle = style ? StyleSheet.flatten([buttonStyle, style]) : buttonStyle;

  const content = (
    <View style={styles.content}>
      {startIconName ? (
        <Ionicons
          name={startIconName}
          size={iconSize}
          color={textStyle.color as string}
          style={styles.icon}
        />
      ) : null}
      {!isIconOnly && children ? (
        <Text style={textStyle}>{children}</Text>
      ) : null}
      {endIconName ? (
        <Ionicons
          name={endIconName}
          size={iconSize}
          color={textStyle.color as string}
          style={styles.icon}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator
          size="small"
          color={textStyle.color as string}
          style={styles.loader}
        />
      ) : null}
    </View>
  );

  const renderPressable = (buttonStyleOverride?: ViewStyle) => (
    <HapticPressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        buttonStyleOverride ?? baseStyle,
        pressed && !disabled && !loading && styles.pressed,
      ]}
    >
      {content}
    </HapticPressable>
  );

  if (variant === 'liquid') {
    const glassStyle = { ...(baseStyle as ViewStyle) };
    const tintColor = getBackgroundColor(glassStyle);
    if ('backgroundColor' in glassStyle) {
      delete glassStyle.backgroundColor;
    }

    const pressableStyle: ViewStyle = {
      ...glassStyle,
      backgroundColor: 'transparent',
    };

    return (
      <LiquidGlass style={glassStyle} tintColor={tintColor}>
        {renderPressable(pressableStyle)}
      </LiquidGlass>
    );
  }

  return renderPressable();
};

const getBaseColors = (color: NonNullable<ButtonProps['color']>) => {
  const key = color as ButtonColorKey;
  return buttonColors[key] ?? buttonColors.primary;
};

const getStyles = ({
  size,
  variant,
  baseColors,
  fullWidth,
  disabled,
  loading,
  isIconOnly,
}: {
  size: ButtonSize;
  variant: ButtonVariant;
  baseColors: { bg: ColorValue; text: ColorValue; border: ColorValue };
  fullWidth: boolean;
  disabled: boolean;
  loading: boolean;
  isIconOnly: boolean;
}) => {
  const sizeCfg = SIZE_CONFIG[size];

  let backgroundColor: ColorValue = 'transparent';
  let borderWidth = 0;
  let borderColor: ColorValue = 'transparent';
  let textColor: ColorValue = baseColors.text;

  switch (variant) {
    case 'solid':
      backgroundColor = baseColors.bg;
      borderWidth = 1;
      borderColor = baseColors.border;
      break;
    case 'outline':
      backgroundColor = 'transparent';
      borderWidth = 1;
      borderColor = baseColors.border || baseColors.text;
      textColor = baseColors.bg;
      break;
    case 'ghost':
      backgroundColor = 'transparent';
      borderWidth = 0;
      borderColor = 'transparent';
      break;
    case 'link':
      backgroundColor = 'transparent';
      borderWidth = 0;
      borderColor = 'transparent';
      break;
    case 'liquid':
      backgroundColor = 'transparent';
      borderWidth = 0;
      borderColor = 'transparent';
      break;
  }

  const button: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor,
    borderWidth,
    borderColor,
    paddingHorizontal: isIconOnly ? sizeCfg.iconPadding : sizeCfg.horizontal,
    paddingVertical: sizeCfg.vertical,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    width: fullWidth ? '100%' : undefined,
    opacity: disabled || loading ? 0.65 : 1,
  };

  const text: TextStyle = {
    color: textColor,
    fontSize: sizeCfg.fontSize,
    fontWeight: '500',
  };

  return {
    buttonStyle: button,
    textStyle: text,
    iconSize: sizeCfg.iconSize,
  };
};

const SIZE_CONFIG: Record<ButtonSize, { horizontal: number; vertical: number; fontSize: number; iconSize: number; iconPadding: number }> =
  {
    sm: {
      horizontal: 10,
      vertical: 6,
      fontSize: 13,
      iconSize: 16,
      iconPadding: 8,
    },
    md: {
      horizontal: 14,
      vertical: 8,
      fontSize: 15,
      iconSize: 18,
      iconPadding: 10,
    },
    lg: {
      horizontal: 18,
      vertical: 10,
      fontSize: 17,
      iconSize: 20,
      iconPadding: 12,
    },
  };

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginHorizontal: 4,
  },
  loader: {
    marginLeft: 8,
  },
  pressed: {
    opacity: 0.85,
  },
});

const getBackgroundColor = (style?: ViewStyle): string | undefined => {
  if (!style) {
    return undefined;
  }
  const color = style.backgroundColor;
  return typeof color === 'string' ? color : undefined;
};


export default Button;


