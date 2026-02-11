import { memo } from 'react';

import { QuizCode } from '@/feat/quiz/components/quizType/QuizCode';
import { QuizMatching } from '@/feat/quiz/components/quizType/QuizMatching';
import { QuizMCQ } from '@/feat/quiz/components/quizType/QuizMCQ';
import { QuizOX } from '@/feat/quiz/components/quizType/QuizOX';
import type {
  AnswerType,
  CorrectAnswerType,
  QuizComponentProps,
  QuizQuestion,
  QuizType,
} from '@/feat/quiz/types';

interface QuizRendererProps {
  question: QuizQuestion;
  selectedAnswer: AnswerType | null;
  correctAnswer: CorrectAnswerType | null;
  onAnswerChange: (answer: AnswerType) => void;
  onSelectPosition?: (position: { x: number; y: number }) => void;
  showResult: boolean;
  disabled: boolean;
  /**
   * 렌더링 모드
   * - solve: 기존 퀴즈 풀이용(기본)
   * - readonly: 관리자/미리보기 등에서 UI만 보여주기 위한 모드(항상 disabled + 결과 표시)
   */
  mode?: 'solve' | 'readonly';
}

const QUIZ_MAP: Record<QuizType, React.ComponentType<QuizComponentProps>> = {
  mcq: QuizMCQ as React.ComponentType<QuizComponentProps>,
  ox: QuizOX as React.ComponentType<QuizComponentProps>,
  code: QuizCode as React.ComponentType<QuizComponentProps>,
  matching: QuizMatching as React.ComponentType<QuizComponentProps>,
};

export const QuizRenderer = memo(({ question, ...props }: QuizRendererProps) => {
  const Component = QUIZ_MAP[question.type];

  if (!Component) return <div>지원하지 않는 퀴즈 유형입니다: {question.type}</div>;

  const effectiveProps =
    props.mode === 'readonly'
      ? {
          ...props,
          disabled: true,
          showResult: true,
          onAnswerChange: () => {},
          onSelectPosition: undefined,
        }
      : props;

  return <Component content={question.content} {...effectiveProps} />;
});
