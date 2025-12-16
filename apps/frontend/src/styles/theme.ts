import { colors } from './color';
import { typography } from './typography';

export const borderRadius = {
  small: '8px',
  medium: '16px',
  large: '24px',
  xlarge: '40px',
} as const;

export const lightTheme = {
  colors: colors.light,
  typography,
  borderRadius,
};

export const darkTheme = {
  colors: colors.dark,
  typography,
  borderRadius,
};

export type Theme = typeof lightTheme;
