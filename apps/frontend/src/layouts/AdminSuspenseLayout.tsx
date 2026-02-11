import { css, useTheme } from '@emotion/react';
import { type ReactNode, Suspense } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';

import { Loading } from '@/components/Loading';
import { Sidebar } from '@/layouts/Sidebar';
import type { Theme } from '@/styles/theme';

interface AdminLayoutProps {
  children?: ReactNode;
}

const ADMIN_TABS = [
  {
    label: '랭킹 관리',
    to: '/admin/leaderboard',
    isActive: (pathname: string) => pathname === '/admin/leaderboard',
  },
  {
    label: '퀴즈 리포트',
    to: '/admin/quizzes/reports',
    isActive: (pathname: string) => pathname.startsWith('/admin/quizzes/reports'),
  },
  // Uploads use a query string for the selected type; active state should ignore search params.
  {
    label: '업로드',
    to: '/admin/uploads?type=quizzes',
    isActive: (pathname: string) => pathname === '/admin/uploads',
  },
  {
    label: '프로필 캐릭터 관리',
    to: '/admin/profile-characters/manage',
    isActive: (pathname: string) => pathname === '/admin/profile-characters/manage',
  },
] as const;

export const AdminSuspenseLayout = ({ children }: AdminLayoutProps) => {
  const theme = useTheme();
  const location = useLocation();

  if (location.pathname === '/admin') return <Navigate to={ADMIN_TABS[0].to} replace />;

  return (
    <div css={containerStyle}>
      <Sidebar />
      <main css={mainContentStyle}>
        <header css={headerStyle(theme)}>
          <h1 css={titleStyle(theme)}>관리자 대시보드</h1>
          <nav css={tabListStyle}>
            {ADMIN_TABS.map(tab => (
              <Link
                key={tab.to}
                to={tab.to}
                css={[
                  tabItemStyle(theme),
                  tab.isActive(location.pathname) && activeTabStyle(theme),
                ]}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </header>

        <section css={contentAreaStyle}>
          <div css={scrollInnerStyle}>
            <Suspense fallback={<Loading />}>{children || <Outlet />}</Suspense>
          </div>
        </section>
      </main>
    </div>
  );
};

const containerStyle = css`
  display: flex;
  height: 100vh;
  flex-direction: row;
  overflow: hidden;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const mainContentStyle = css`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  position: relative;

  @media (max-width: 768px) {
    padding-bottom: 96px;
  }
`;

const headerStyle = (theme: Theme) => css`
  flex-shrink: 0;
  padding: 32px 32px 0 32px;
  background: ${theme.colors.surface.strong};
  border-bottom: 1px solid ${theme.colors.border.default};
`;

const titleStyle = (theme: Theme) => css`
  font-size: ${theme.typography['24Bold'].fontSize};
  margin-bottom: 24px;
  color: ${theme.colors.text.strong};
`;

const tabListStyle = css`
  display: flex;
  gap: 8px;
`;

const tabItemStyle = (theme: Theme) => css`
  padding: 12px 20px;
  text-decoration: none;
  font-size: ${theme.typography['16Medium'].fontSize};
  color: ${theme.colors.text.weak};
  border-bottom: 2px solid transparent;
  transition: all 0.2s;

  &:hover {
    color: ${theme.colors.primary.main};
  }

  @media (max-width: 768px) {
    font-size: ${theme.typography['12Medium'].fontSize};
  }
`;

const activeTabStyle = (theme: Theme) => css`
  color: ${theme.colors.primary.main};
  font-weight: 700;
  border-bottom: 2px solid ${theme.colors.primary.main};
`;

const contentAreaStyle = css`
  flex: 1;
  overflow-y: auto;
  padding: 32px;

  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const scrollInnerStyle = css`
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
`;
