import type { MatchingPair, QuizQuestion, StepCompletionResult } from '@/feat/quiz/types';

import { apiFetch } from './api';

export interface QuizSubmissionRequest {
  quiz_id: number;
  type: 'MCQ' | 'OX' | 'MATCHING' | 'CODE';
  selection: {
    option_id?: string;
    pairs?: MatchingPair[];
  };
  step_attempt_id?: number;
}

export interface QuizSubmissionResponse {
  is_correct: boolean;
  solution: {
    explanation: string;
    correct_option_id?: string;
    correct_pairs?: MatchingPair[];
  };
}

export interface StepCompletionPayload {
  stepAttemptId?: number;
}

export interface StepStartResult {
  stepAttemptId: number;
}

export const quizService = {
  /**
   * 특정 스텝의 퀴즈 목록을 가져옵니다.
   * @param stepId 스텝 ID
   * @param limit 가져올 퀴즈 개수 (기본값: 10)
   */
  async getQuizzesByStep(stepId: number, limit = 10): Promise<QuizQuestion[]> {
    return apiFetch.get<QuizQuestion[]>(`/steps/${stepId}/quizzes?limit=${limit}`);
  },

  /**
   * 퀴즈 정답 제출 API 호출
   * @param quizId 퀴즈 ID
   * @param payload 제출 요청 데이터
   * @returns 정답 및 해설
   */
  async submitQuiz(
    quizId: number,
    payload: QuizSubmissionRequest,
  ): Promise<QuizSubmissionResponse> {
    return apiFetch.post<QuizSubmissionResponse>(`/quizzes/${quizId}/submissions`, payload);
  },

  /**
   * 이 step의 모든 quiz 풀이가 끝났음을 서버에 확정하는 요청
   * @param stepId 스텝 ID
   * @param payload 완료 처리할 스텝 시도 ID
   * @returns 퀴즈 결과 (점수, 성공률, 소요 시간 등)
   */
  async completeStep(
    stepId: number,
    payload: StepCompletionPayload,
  ): Promise<StepCompletionResult> {
    return apiFetch.post<StepCompletionResult>(`/progress/steps/${stepId}/complete`, payload);
  },

  /**
   * 스텝 풀이 시작 요청
   * @param stepId 스텝 ID
   * @returns 스텝 시도 ID
   */
  async startStep(stepId: number): Promise<StepStartResult> {
    return apiFetch.post<StepStartResult>(`/progress/steps/${stepId}/start`);
  },
};
