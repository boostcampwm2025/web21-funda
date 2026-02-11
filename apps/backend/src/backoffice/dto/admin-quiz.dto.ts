import type { QuizContent } from '../../roadmap/dto/quiz-list.dto';

export interface AdminQuizContent extends QuizContent {
  // Raw DB values for admin use (renderer uses code_metadata).
  code?: string;
  language?: string;
}

export interface AdminQuizDetailResponse {
  id: number;
  type: string;
  content: AdminQuizContent;
  // Raw DB values for admin use (not shuffled, not hidden).
  answer: unknown;
  explanation: string | null;
  difficulty: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminQuizOption {
  id: string;
  text: string;
}

export interface AdminQuizMatchingPair {
  left: string;
  right: string;
}

export interface AdminQuizUpdateRequest {
  question?: string;
  explanation?: string | null;
  options?: AdminQuizOption[];
  // CODE quiz support (optional).
  code?: string;
  language?: string;
  correctOptionId?: string;
  correctPairs?: AdminQuizMatchingPair[];
}

export interface AdminQuizUpdateResponse {
  id: number;
  updated: boolean;
  updatedFields: Array<'question' | 'explanation' | 'options' | 'code' | 'language' | 'answer'>;
}
