import { borderRadius, colors } from './token';
import { typography } from './typography';

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
