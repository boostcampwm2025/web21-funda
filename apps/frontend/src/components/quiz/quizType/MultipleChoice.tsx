import { CodeBlock } from '@comp/CodeBlock';
import { QuizOption } from '@comp/quiz/QuizOption';
import { css, useTheme } from '@emotion/react';

import type { Theme } from '@/styles/theme';

export interface MultipleChoiceQuestion {
  id: number;
  question: string;
  code?: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface MultipleChoiceProps {
  question: MultipleChoiceQuestion;
  selectedAnswer: number;
  showResult: boolean;
  onOptionClick: (optionIndex: number) => void;
  disabled?: boolean;
}

export const MultipleChoice = ({
  question,
  selectedAnswer,
  showResult,
  onOptionClick,
  disabled = false,
}: MultipleChoiceProps) => {
  const theme = useTheme();
  const isCorrect = selectedAnswer === question.correctAnswer;

  return (
    <div css={quizCardStyle(theme)}>
      {question.code && (
        <div css={codeBlockWrapperStyle}>
          <CodeBlock language="JavaScript">{question.code}</CodeBlock>
        </div>
      )}

      <div css={optionsContainerStyle}>
        {question.options.map((option, index) => {
          const label = String.fromCharCode(65 + index); // A, B, C, D, E
          const isSelected = selectedAnswer === index;
          const isCorrectOption = showResult && index === question.correctAnswer;
          const isWrongOption = showResult && isSelected && !isCorrect;

          return (
            <QuizOption
              key={index}
              label={label}
              option={option}
              isSelected={isSelected}
              isCorrect={isCorrectOption}
              isWrong={isWrongOption}
              onClick={() => onOptionClick(index)}
              disabled={disabled}
            />
          );
        })}
      </div>
    </div>
  );
};

const quizCardStyle = (theme: Theme) => css`
  width: 100%;
  max-width: 800px;
  background: ${theme.colors.surface.strong};
`;

const codeBlockWrapperStyle = css`
  margin-bottom: 24px;
`;

const optionsContainerStyle = css`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
`;
