import { useTheme } from '@emotion/react';
import { useNavigate, useParams } from 'react-router-dom';

import { AdminReportDetailView } from '@/feat/admin/components/AdminReportDetailView';
import { useAdminReportDetail } from '@/feat/admin/hooks/useAdminReportDetail';

export const AdminReportDetailContainer = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const params = useParams();

  const parsed = params.reportId ? parseInt(params.reportId, 10) : NaN;
  const reportId = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

  const detail = useAdminReportDetail({ reportId });

  return (
    <AdminReportDetailView
      theme={theme}
      reportId={reportId}
      onBack={() => navigate('/admin/quizzes/reports')}
      detail={detail}
    />
  );
};
