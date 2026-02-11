import { useEffect, useState } from 'react';

import { ReportsContainer } from '@/feat/admin/components/ReportsContainer';
import { type ReportResponse, reportService } from '@/services/reportService';

const REPORTS_PAGE_SIZE = 10;

export const Reports = () => {
  const [reports, setReports] = useState<ReportResponse[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await reportService.getReports({
          page: currentPage,
          limit: REPORTS_PAGE_SIZE,
        });

        setReports(data.items.slice(0, REPORTS_PAGE_SIZE));
        setTotalPages(Math.max(1, data.totalPages));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [currentPage]);

  return (
    <ReportsContainer
      reports={reports}
      loading={loading}
      error={error}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={page => {
        if (page < 1 || page > totalPages) {
          return;
        }
        setCurrentPage(page);
      }}
    />
  );
};
