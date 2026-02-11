import type { WeeklyRankingResult } from '@/features/leaderboard/types';

import { apiFetch } from './api';

export interface AdminQuizOption {
  id: string;
  text: string;
}

export interface AdminQuizMatchingPair {
  left: string;
  right: string;
}

export interface AdminQuizDetailResponse {
  id: number;
  type: string;
  content: {
    question: string;
    options?: AdminQuizOption[];
    code_metadata?: { language?: string; snippet: string };
    matching_metadata?: {
      left: Array<{ id: string; text: string }>;
      right: Array<{ id: string; text: string }>;
    };
  };
  answer: unknown;
  explanation: string | null;
  difficulty: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminQuizUpdateRequest {
  question?: string;
  explanation?: string | null;
  options?: AdminQuizOption[];
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

export interface UploadSummary {
  processed: number;
  fieldsCreated: number;
  fieldsUpdated: number;
  unitsCreated: number;
  unitsUpdated: number;
  stepsCreated: number;
  stepsUpdated: number;
  quizzesCreated: number;
  quizzesUpdated: number;
}

export interface UnitOverviewUploadSummary {
  processed: number;
  unitsUpdated: number;
  unitsNotFound: number;
}

export interface ProfileCharacterUploadSummary {
  processed: number;
  charactersCreated: number;
  charactersUpdated: number;
}

export interface ProfileCharacterCreateRequest {
  imageUrl: string;
  priceDiamonds: number;
  description?: string | null;
  isActive?: boolean;
}

export interface AdminProfileCharacterItem {
  id: number;
  name: string;
  imageUrl: string;
  priceDiamonds: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProfileCharacterUpdateRequest {
  priceDiamonds: number;
  isActive: boolean;
}

export type ProfileCharacterCreateResponse =
  | { id: number; created: boolean; updated: boolean }
  | { error: string };

export type UploadResponse =
  | { summary: UploadSummary }
  | { message: string; frontendPath?: string; error?: string }
  | { error: string };

export interface AdminWeeklyRankingParams {
  tierName: string;
  groupIndex: number;
  weekKey?: string | null;
}

export const adminService = {
  /**
   * JSONL 파일을 업로드하여 퀴즈 데이터를 일괄 업로드합니다.
   * @param files 업로드할 JSONL 파일 목록
   * @returns 업로드 결과 요약 또는 에러 메시지
   */
  async uploadQuizzes(files: File[]): Promise<UploadResponse> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('file', file);
    });
    return apiFetch.post<UploadResponse>('/admin/quizzes/upload', formData);
  },

  /**
   * JSONL 파일을 업로드하여 유닛 개요를 일괄 업데이트합니다.
   * @param files 업로드할 JSONL 파일 목록
   * @returns 업로드 결과 요약
   */
  async uploadUnitOverviews(files: File[]): Promise<UnitOverviewUploadSummary> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('file', file);
    });
    return apiFetch.post<UnitOverviewUploadSummary>('/admin/units/overview/upload', formData);
  },

  /**
   * 프로필 캐릭터를 단일 등록합니다.
   * @param payload 단일 등록 요청
   * @returns 등록 결과
   */
  async createProfileCharacter(
    payload: ProfileCharacterCreateRequest,
  ): Promise<ProfileCharacterCreateResponse> {
    return apiFetch.post<ProfileCharacterCreateResponse>('/admin/profile-characters', payload);
  },

  /**
   * 관리자용 프로필 캐릭터 목록을 조회합니다.
   */
  async getProfileCharacters(): Promise<AdminProfileCharacterItem[]> {
    return apiFetch.get<AdminProfileCharacterItem[]>('/admin/profile-characters');
  },

  /**
   * 관리자용 프로필 캐릭터 정보를 수정합니다.
   * @param characterId 수정할 캐릭터 ID
   * @param payload 수정할 값
   */
  async updateProfileCharacter(
    characterId: number,
    payload: AdminProfileCharacterUpdateRequest,
  ): Promise<{ id: number; updated: boolean }> {
    return apiFetch.patch<{ id: number; updated: boolean }>(
      `/admin/profile-characters/${characterId}`,
      payload,
    );
  },

  /**
   * 프로필 캐릭터 JSONL 파일을 업로드합니다.
   * @param files 업로드할 JSONL 파일 목록
   * @returns 업로드 결과 요약
   */
  async uploadProfileCharacters(files: File[]): Promise<ProfileCharacterUploadSummary> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('file', file);
    });
    return apiFetch.post<ProfileCharacterUploadSummary>(
      '/admin/profile-characters/upload',
      formData,
    );
  },

  /**
   * 관리자용 주간 랭킹 정보를 가져옵니다.
   */
  async getWeeklyRankingByGroup(params: AdminWeeklyRankingParams): Promise<WeeklyRankingResult> {
    const query = new URLSearchParams();
    query.set('tierName', params.tierName);
    query.set('groupIndex', String(params.groupIndex));
    if (params.weekKey) {
      query.set('weekKey', params.weekKey);
    }

    return apiFetch.get<WeeklyRankingResult>(`/admin/ranking/weekly?${query.toString()}`);
  },

  /**
   * 관리자용 퀴즈 단건 상세 조회
   */
  async getQuiz(quizId: number): Promise<AdminQuizDetailResponse> {
    return apiFetch.get<AdminQuizDetailResponse>(`/admin/quizzes/${quizId}`);
  },

  /**
   * 관리자용 퀴즈 부분 수정 (변경된 필드만 전송 권장)
   */
  async updateQuiz(
    quizId: number,
    payload: AdminQuizUpdateRequest,
  ): Promise<AdminQuizUpdateResponse> {
    return apiFetch.patch<AdminQuizUpdateResponse>(`/admin/quizzes/${quizId}`, payload);
  },
};
