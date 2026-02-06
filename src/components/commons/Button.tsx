import React from 'react';
import {
  ActivityIndicator,
  ColorValue,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import HapticPressable from '../ui/HapticPressable';
import { buttonColors, type ButtonColorKey } from '../../styles/color';
import { glassButtonStyle } from '../../styles/glass';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';
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
  startIcon?: React.ElementType;
  endIcon?: React.ElementType;
  iconColor?: ColorValue;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  textProps?: React.ComponentProps<typeof Text>;
  tintColor?: string;
  isDarkBackground?: boolean;
  iconSizeMin?: number;
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
  startIcon: StartIcon,
  endIcon: EndIcon,
  iconColor,
  onPress,
  style,
  textStyle: customTextStyle,
  textProps,
  tintColor,
  isDarkBackground,
  iconSizeMin,
}) => {
  const baseColors = getBaseColors(color);
  const { buttonStyle, textStyle: generatedTextStyle, iconSize } = getStyles({
    size,
    variant,
    baseColors,
    fullWidth: !!fullWidth,
    disabled: !!disabled,
    loading: !!loading,
    isIconOnly: !!isIconOnly,
  });

  const baseStyle = style ? StyleSheet.flatten([buttonStyle, style]) : buttonStyle;
  const combinedTextStyle = StyleSheet.flatten([generatedTextStyle, customTextStyle]);

  // Button content
  const buttonContent = (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: loading ? 0 : 1,
        }}
      >
        {StartIcon ? (
          <StartIcon
            width={iconSizeMin ?? iconSize}
            height={iconSizeMin ?? iconSize}
            color={(iconColor ?? combinedTextStyle.color) as string}
            style={styles.icon}
          />
        ) : startIconName ? (
          <Ionicons
            name={startIconName}
            size={iconSizeMin ?? iconSize}
            color={(iconColor ?? combinedTextStyle.color) as string}
            style={styles.icon}
          />
        ) : null}
        {!isIconOnly && children ? (
          <Text style={combinedTextStyle} {...textProps}>{children}</Text>
        ) : null}
        {EndIcon ? (
          <EndIcon
            width={iconSizeMin ?? iconSize}
            height={iconSizeMin ?? iconSize}
            color={(iconColor ?? combinedTextStyle.color) as string}
            style={styles.icon}
          />
        ) : endIconName ? (
          <Ionicons
            name={endIconName}
            size={iconSize}
            color={(iconColor ?? combinedTextStyle.color) as string}
            style={styles.icon}
          />
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={combinedTextStyle.color as string}
          style={{ position: 'absolute' }}
        />
      ) : null}
    </View>
  );

  // Render with liquid/blur effect
  if (variant === 'liquid') {
    const glassStyle = { ...(baseStyle as ViewStyle) };

    const styleBg = getBackgroundColor(glassStyle);
    const effectiveTintColor = tintColor ?? styleBg; // simplified

    if ('backgroundColor' in glassStyle) {
      delete glassStyle.backgroundColor;
    }

    return (
      <HapticPressable onPress={onPress} disabled={disabled || loading}>
        <View style={[
          glassButtonStyle,
          buttonStyle,
          { backgroundColor: 'transparent', overflow: 'hidden' },
          style
        ]}>
          <BlurView
            intensity={20}
            tint={isDarkBackground ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View style={{ zIndex: 1 }}>
            {buttonContent}
          </View>
        </View>
      </HapticPressable>
    );
  }

  // Fallback for non-liquid variants
  return (
    <HapticPressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        baseStyle,
        pressed && !disabled && !loading && styles.pressed,
      ]}
    >
      {buttonContent}
    </HapticPressable>
  );
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

  // Calculate circular button size for icon-only buttons
  // Size = icon size + padding on both sides
  const iconButtonSize = isIconOnly
    ? sizeCfg.iconPadding * 2 + sizeCfg.iconSize
    : undefined;

  const button: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor,
    borderWidth,
    borderColor,
    // When icon-only, use fixed width/height and no padding for perfect centering
    paddingHorizontal: isIconOnly ? 0 : sizeCfg.horizontal,
    paddingVertical: isIconOnly ? 0 : sizeCfg.vertical,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    width: fullWidth ? '100%' : isIconOnly ? iconButtonSize : undefined,
    height: isIconOnly ? iconButtonSize : undefined,
    minWidth: isIconOnly ? iconButtonSize : undefined,
    minHeight: isIconOnly ? iconButtonSize : undefined,
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
  xl: {
    horizontal: 24,
    vertical: 14,
    fontSize: 19,
    iconSize: 24,
    iconPadding: 16,
  },
};

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginHorizontal: 0,
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


