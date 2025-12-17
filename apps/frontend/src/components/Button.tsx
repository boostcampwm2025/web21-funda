import { css, type CSSObject, useTheme } from '@emotion/react';
import type { ButtonHTMLAttributes } from 'react';

import type { Theme } from '@/styles/theme';

type Variant = 'primary' | 'secondary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  css?: CSSObject;
}

export const Button = ({
  variant = 'primary',
  fullWidth = false,
  children,
  css: customCss,
  ...props
}: ButtonProps) => {
  const theme = useTheme();

  return (
    <button
      css={[
        baseStyle(theme, fullWidth),
        variant === 'primary' ? primaryStyle(theme) : secondaryStyle(theme),
        props.disabled && disabledStyle(theme),
        customCss,
      ]}
      {...props}
    >
      {children}
    </button>
  );
};

const baseStyle = (theme: Theme, fullWidth: boolean) => css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${fullWidth ? '100%' : 'auto'};
  padding: 12px;
  border: 0;
  border-radius: ${theme.borderRadius.medium};
  transition:
    transform 150ms ease,
    box-shadow 150ms ease,
    filter 150ms ease;
  font-family:
    'SUIT',
    'Inter',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  background: transparent;

  font-size: ${theme.typography['16Medium'].fontSize};
  line-height: ${theme.typography['16Medium'].lineHeight};
  font-weight: ${theme.typography['16Medium'].fontWeight};
`;

const primaryStyle = (theme: Theme) => css`
  background: ${theme.colors.primary.main};
  color: ${theme.colors.surface.strong};
  box-shadow: 0 10px 0 ${theme.colors.primary.dark};

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 0 ${theme.colors.primary.dark};
    filter: brightness(1.02);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 8px 0 ${theme.colors.primary.dark};
  }
`;

const secondaryStyle = (theme: Theme) => css`
  background: ${theme.colors.surface.strong};
  color: ${theme.colors.text.light};
  border: 2px solid ${theme.colors.primary.surface};
  box-shadow: 0 10px 0 ${theme.colors.primary.surface};

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 0 ${theme.colors.primary.surface};
    filter: brightness(0.99);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 8px 0 ${theme.colors.primary.surface};
  }
`;

const disabledStyle = (theme: Theme) => css`
  opacity: 0.5;
  cursor: not-allowed;
  border-color: ${theme.colors.border.default};
`;
