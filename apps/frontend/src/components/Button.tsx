import { css, useTheme } from '@emotion/react';
import type { ButtonHTMLAttributes } from 'react';

import type { Theme } from '../styles/theme';

type Variant = 'primary' | 'secondary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

export const Button = ({
  variant = 'primary',
  fullWidth = false,
  children,
  ...props
}: ButtonProps) => {
  const theme = useTheme();

  return (
    <button
      css={[
        baseStyle(theme, fullWidth),
        variant === 'primary' ? primaryStyle(theme) : secondaryStyle(theme),
        props.disabled && disabledStyle(theme),
      ]}
      {...props}
    >
      <span css={labelStyle(theme)}>{children}</span>
    </button>
  );
};

const baseStyle = (theme: Theme, fullWidth: boolean) => css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${fullWidth ? '100%' : 'auto'};
  padding: 8px 12px;
  border: 0;
  border-radius: ${theme.borderRadius.medium};
  cursor: pointer;
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
`;

const primaryStyle = (theme: Theme) => css`
  background: ${theme.colors.primary.main};
  color: ${theme.colors.text.light};
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
  color: ${theme.colors.text.default};
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
  box-shadow: none;
  border-color: ${theme.colors.border.default};
`;

const labelStyle = (theme: Theme) => css`
  font-size: ${theme.typography['16Medium'].fontSize};
  line-height: ${theme.typography['16Medium'].lineHeight};
  font-weight: ${theme.typography['16Medium'].fontWeight};
`;
