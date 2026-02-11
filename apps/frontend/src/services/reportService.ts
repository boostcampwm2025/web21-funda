import { apiFetch } from './api';

interface ReportRequest {
  report_description: string;
  userId?: number;
}

export interface ReportResponse {
  id: number;
  quizId: number;
  question?: string | null;
  userId?: number | null;
  userDisplayName?: string | null;
  userEmail?: string | null;
  report_description: string;
  createdAt: string;
}

export interface GetReportsParams {
  page?: number;
  limit?: number;
}

export interface PaginatedReportsResponse {
  items: ReportResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const reportService = {
  /**
   * 퀴즈 신고 제출
   * @param quizId 퀴즈 ID
   * @param data 신고 요청 데이터
   * @returns 신고 성공 여부
   */
  createReport: async (quizId: number, data: ReportRequest): Promise<ReportResponse> =>
    apiFetch.post<ReportResponse>(`/quizzes/${quizId}/reports`, data),

  /**
   * 모든 신고 목록을 조회합니다.
   * @returns 신고 목록
   */
  async getReports({
    page = 1,
    limit = 10,
  }: GetReportsParams = {}): Promise<PaginatedReportsResponse> {
    const queryParams = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    return apiFetch.get<PaginatedReportsResponse>(`/quizzes/reports?${queryParams.toString()}`);
  },

  /**
   * 신고 단건을 조회합니다. (관리자)
   */
  async getReport(reportId: number): Promise<ReportResponse> {
    return apiFetch.get<ReportResponse>(`/quizzes/reports/${reportId}`);
  },
};
