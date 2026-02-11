import { useCallback, useEffect, useState } from 'react';

import type { AdminQuizDetailResponse } from '@/services/adminService';
import { adminService } from '@/services/adminService';
import type { ReportResponse } from '@/services/reportService';
import { reportService } from '@/services/reportService';

type Params = {
  reportId: number | null;
};

export const useReportQuizData = ({ reportId }: Params) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [quiz, setQuiz] = useState<AdminQuizDetailResponse | null>(null);

  const refresh = useCallback(async () => {
    if (reportId === null || !Number.isInteger(reportId) || reportId <= 0) {
      setError('유효한 reportId가 필요합니다.');
      setLoading(false);
      setReport(null);
      setQuiz(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let reportDetail: ReportResponse;
      try {
        reportDetail = await reportService.getReport(reportId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        throw new Error(`getReport failed: ${message}`);
      }

      let quizDetail: AdminQuizDetailResponse;
      try {
        quizDetail = await adminService.getQuiz(reportDetail.quizId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        throw new Error(`getQuiz failed: ${message}`);
      }

      setReport(reportDetail);
      setQuiz(quizDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    loading,
    error,
    report,
    quiz,
    setQuiz,
    refresh,
  };
};
