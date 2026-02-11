import type { MouseEvent } from 'react';

/** 문제 풀이 상태 */
export type QuestionStatus = 'idle' | 'checking' | 'checked';

/** 퀴즈 유형 */
export type QuizType = 'mcq' | 'ox' | 'matching' | 'code';

/** 선택지 옵션 구조 (ID 기반) */
export interface QuizOption {
  id: string; // 'c1', 'o', 'x' 등
  text: string; // 화면에 보여줄 텍스트
}

/** 매칭 항목 구조 (id 기반) */
export interface MatchingItem {
  id: string;
  text: string;
}

/** 매칭 문제의 쌍(Pair) 구조 (id 기반 - api 요청/응답용) */
export interface MatchingPair {
  left: string;
  right: string;
}

/** -----------------------------------------
 * 퀴즈 문제 상세 콘텐츠 구조
 * ----------------------------------------- */

interface BaseQuizContent {
  question: string;
}

/** MCQ, OX */
export interface DefaultContent extends BaseQuizContent {
  options: QuizOption[];
}

/** CODE 전용 */
export interface CodeContent extends BaseQuizContent {
  options: QuizOption[];
  code_metadata: {
    language: string;
    snippet: string;
  };
}

/** MATCHING 전용 */
export interface MatchingContent extends BaseQuizContent {
  matching_metadata: {
    left: MatchingItem[];
    right: MatchingItem[];
  };
}

/** -----------------------------------------
 * 퀴즈 전체 객체 구조
 * ----------------------------------------- */

export type QuizQuestion =
  | { id: number; type: 'ox' | 'mcq'; content: DefaultContent }
  | { id: number; type: 'code'; content: CodeContent }
  | { id: number; type: 'matching'; content: MatchingContent };

/** -----------------------------------------
 * 퀴즈 정답
 * ----------------------------------------- */

/** 퀴즈 유형별 정답 데이터 타입 정의 */
export type AnswerType = string | { pairs: MatchingPair[] } | null;
export type CorrectAnswerType = string | { pairs: MatchingPair[] | null };

/** 정답 및 해설 구조 */
export interface QuizSolution {
  question_id: number;
  answer_id: string;
  is_correct: boolean;
  solution: {
    explanation: string;
    correct_option_id?: string; // MCQ, OX, CODE
    correct_pairs?: MatchingPair[]; // MATCHING
  };
}

/** -----------------------------------------
 * 스탭 결과
 * ----------------------------------------- */

export interface StepCompletionResult {
  successRate: number;
  xpGained: number;
  durationMs: number;
}

/** -----------------------------------------
 * 공통 매개변수
 * ----------------------------------------- */

/** 각 퀴즈 컴포넌트에서 공통으로 사용하는 매개변수 */
export interface QuizComponentProps {
  content: QuizQuestion['content'];
  selectedAnswer: AnswerType | null;
  correctAnswer: CorrectAnswerType | null;
  onAnswerChange: (answer: AnswerType) => void;
  onSelectPosition?: (position: { x: number; y: number }) => void;
  showResult: boolean;
  disabled: boolean;
  mode?: 'solve' | 'readonly';
}

/** 퀴즈의 옵션 컴포넌트 공통 매개견수 */
export interface QuizOptionProps {
  label?: string;
  option: string;
  isSelected: boolean;
  isMatched?: boolean;
  isCorrect?: boolean;
  isWrong?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  size?: 'default' | 'compact';
}
