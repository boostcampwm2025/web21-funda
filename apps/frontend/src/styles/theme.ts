// src/styles/theme.ts
import { colors } from './color';
import { typography } from './typography';

export const lightTheme = {
  colors: colors.light,
  typography,
};

export const darkTheme = {
  colors: colors.dark,
  typography,
};

export type Theme = typeof lightTheme;
