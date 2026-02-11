import { css } from '@emotion/react';

import { QuizOXOption } from '@/feat/quiz/components/quizOptions/QuizOXOption';
import type { DefaultContent, QuizComponentProps } from '@/feat/quiz/types';

export const QuizOX = ({
  content,
  selectedAnswer,
  correctAnswer,
  onAnswerChange,
  onSelectPosition,
  showResult,
  disabled = false,
  mode = 'solve',
}: QuizComponentProps) => {
  const { options } = content as DefaultContent;

  const correctAnswerId = correctAnswer as string | null;

  return (
    <div css={[oxWrapperStyle, mode === 'readonly' && oxWrapperCompactStyle]}>
      {options.map(option => {
        const isSelected = selectedAnswer === option.id;
        const isCorrectOption =
          showResult && correctAnswerId !== null && option.id === correctAnswerId;
        const isWrongOption =
          showResult && isSelected && correctAnswerId !== null && option.id !== correctAnswerId;

        return (
          <QuizOXOption
            key={option.id}
            option={option.text}
            isSelected={isSelected}
            isCorrect={isCorrectOption}
            isWrong={isWrongOption}
            size={mode === 'readonly' ? 'compact' : 'default'}
            onClick={event => {
              onAnswerChange(option.id);
              if (!onSelectPosition) return;
              const rect = event.currentTarget.getBoundingClientRect();
              onSelectPosition({
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
              });
            }}
            disabled={disabled || showResult}
          />
        );
      })}
    </div>
  );
};

const oxWrapperStyle = css`
  display: flex;
  gap: 20px;
  width: 100%;
  margin-top: 24px;
`;

const oxWrapperCompactStyle = css`
  gap: 12px;
  margin-top: 12px;
  max-width: 560px;
  margin-left: auto;
  margin-right: auto;
`;
