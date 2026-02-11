import { css, useTheme } from '@emotion/react';

import * as S from '@/feat/quiz/components/quizOptions/QuizOption.styles';
import type { QuizOptionProps } from '@/features/quiz/types';
import type { Theme } from '@/styles/theme';
import { TextWithCodeStyle } from '@/utils/textParser';

export const QuizOXOption = ({
  option,
  isSelected,
  isCorrect,
  isWrong,
  onClick,
  disabled,
  size = 'default',
}: QuizOptionProps) => {
  const theme = useTheme();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isSelected}
      data-selected={isSelected}
      data-correct={isCorrect}
      data-wrong={isWrong}
      css={[
        oxBaseStyle(theme, size),
        S.commonHoverStyle(theme),
        isSelected && S.selectedOptionStyle(theme),
        isCorrect && S.correctOptionStyle(theme),
        isWrong && S.wrongOptionStyle(theme),
        disabled && S.disabledOptionStyle,
      ]}
    >
      <span css={oxTextStyle(theme, size)}>
        <TextWithCodeStyle text={option} />
      </span>
    </button>
  );
};

const oxBaseStyle = (theme: Theme, size: QuizOptionProps['size']) => css`
  flex: 1;
  aspect-ratio: ${size === 'compact' ? '1 / 0.85' : '1 / 1.1'};
  min-height: ${size === 'compact' ? '180px' : 'unset'};
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.colors.surface.strong};
  border: 2px solid ${theme.colors.border.default};
  border-radius: ${theme.borderRadius.large};
  cursor: pointer;
  transition: all 0.2s ease;
`;

const oxTextStyle = (theme: Theme, size: QuizOptionProps['size']) => css`
  font-size: ${size === 'compact' ? '3rem' : '5rem'};
  color: ${theme.colors.text.strong};
`;
