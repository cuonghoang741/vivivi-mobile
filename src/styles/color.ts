import type { ColorValue } from 'react-native';
import palette from './palette';

export type ButtonColorKey = 'primary' | 'error' | 'success' | 'gray';

export type ButtonColorToken = {
  bg: ColorValue;
  text: ColorValue;
  border: ColorValue;
};

export const buttonColors: Record<ButtonColorKey, ButtonColorToken> = {
  primary: {
    bg: palette.grayDark[900],
    text: palette.white,
    border: palette.transparent,
  },
  error: {
    bg: palette.error[600],
    text: palette.white,
    border: palette.error[700],
  },
  success: {
    bg: palette.success[600],
    text: palette.white,
    border: palette.transparent,
  },
  gray: {
    bg: palette.grayNeutral[800],
    text: palette.grayNeutral[25],
    border: palette.grayNeutral[500],
  },
};


export const sheetColors = {
  light: "rgba(255,255,255,0.85)",
  dark: "rgba(39, 39, 39, 0.7)",
}