import { css, useTheme } from '@emotion/react';

import type { Theme } from '../../styles/theme';

interface QuizOptionProps {
  label: string;
  option: string;
  isSelected: boolean;
  isCorrect?: boolean;
  isWrong?: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export const QuizOption = ({
  label,
  option,
  isSelected,
  isCorrect,
  isWrong,
  onClick,
  disabled = false,
}: QuizOptionProps) => {
  const theme = useTheme();

  return (
    <button
      css={[
        optionStyle(theme),
        isSelected && selectedOptionStyle(theme),
        isCorrect && correctOptionStyle(theme),
        isWrong && wrongOptionStyle(theme),
        disabled && disabledOptionStyle,
      ]}
      onClick={onClick}
      disabled={disabled}
    >
      <span css={optionLabelStyle(theme, isSelected, isCorrect, isWrong)}>{label}</span>
      <span css={optionTextStyle(theme)}>{option}</span>
    </button>
  );
};

const optionStyle = (theme: Theme) => css`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: ${theme.colors.surface.strong};
  border: 2px solid ${theme.colors.border.default};
  border-radius: ${theme.borderRadius.medium};
  cursor: pointer;
  transition: all 150ms ease;
  text-align: left;
  width: 100%;

  &:hover:not(:disabled) {
    border-color: ${theme.colors.primary.main};
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const selectedOptionStyle = (theme: Theme) => css`
  border-color: ${theme.colors.primary.main};
  background: ${theme.colors.primary.surface};
`;

const correctOptionStyle = (theme: Theme) => css`
  border-color: ${theme.colors.success.main};
  background: ${theme.colors.success.light};
`;

const wrongOptionStyle = (theme: Theme) => css`
  border-color: ${theme.colors.error.main};
  background: ${theme.colors.error.surface};
`;

const disabledOptionStyle = css`
  cursor: not-allowed;
  opacity: 0.6;
`;

const optionLabelStyle = (
  theme: Theme,
  isSelected: boolean,
  isCorrect?: boolean,
  isWrong?: boolean,
) => css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: ${theme.typography['16Bold'].fontSize};
  font-weight: ${theme.typography['16Bold'].fontWeight};
  flex-shrink: 0;

  ${isSelected &&
  !isCorrect &&
  !isWrong &&
  css`
    background: ${theme.colors.primary.main};
    color: ${theme.colors.surface.strong};
  `}

  ${isCorrect &&
  css`
    background: ${theme.colors.success.main};
    color: ${theme.colors.surface.strong};
  `}

  ${isWrong &&
  css`
    background: ${theme.colors.error.main};
    color: ${theme.colors.surface.strong};
  `}

  ${!isSelected &&
  !isCorrect &&
  !isWrong &&
  css`
    background: ${theme.colors.surface.default};
    color: ${theme.colors.text.default};
    border: 2px solid ${theme.colors.border.default};
  `}
`;

const optionTextStyle = (theme: Theme) => css`
  font-size: ${theme.typography['16Medium'].fontSize};
  line-height: ${theme.typography['16Medium'].lineHeight};
  font-weight: ${theme.typography['16Medium'].fontWeight};
  color: ${theme.colors.text.strong};
`;
