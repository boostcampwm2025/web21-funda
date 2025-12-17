import { Button } from '@comp/Button';
import { css, useTheme } from '@emotion/react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Theme } from '@/styles/theme';

interface QuizResultData {
  xp: number;
  successRate: number;
  timeTaken: string;
}

const METRIC_ITEMS = [
  {
    key: 'xp' as const,
    title: '획득 XP',
    icon: '⭐',
    color: 'purple' as const,
    iconStyle: css`
      font-size: 24px;
    `,
  },
  {
    key: 'successRate' as const,
    title: '성공률',
    icon: '↑',
    color: 'green' as const,
    iconStyle: css`
      font-size: 24px;
      color: #02d05c;
    `,
  },
  {
    key: 'timeTaken' as const,
    title: '소요 시간',
    icon: '🕐',
    color: 'gray' as const,
    iconStyle: css`
      font-size: 24px;
    `,
  },
] as const;

interface QuizResultContentProps {
  resultData: QuizResultData;
  isLogin: boolean;
  isFirstToday: boolean;
}

export const QuizResultContent = ({
  resultData,
  isLogin,
  isFirstToday,
}: QuizResultContentProps) => {
  const theme = useTheme();
  const navigate = useNavigate();

  const handleContinue = useCallback(() => {
    if (!isLogin) navigate('/auth/check');
    else if (isFirstToday) navigate('/streak');
    else navigate('/learn');
  }, [isLogin, isFirstToday, navigate]);

  const handleGoToMain = useCallback(() => {
    if (!isLogin) navigate('/auth/check');
    else if (isFirstToday) navigate('/streak');
    else navigate('/learn');
  }, [isLogin, isFirstToday, navigate]);

  return (
    <div css={containerStyle}>
      <h1 css={titleStyle(theme)}>LESSON COMPLETE!</h1>

      <div css={placeholderStyle(theme)} />

      <div css={metricsContainerStyle}>
        {METRIC_ITEMS.map(item => (
          <div key={item.key} css={metricCardStyle(theme, item.color)}>
            <div css={metricTitleStyle(theme, item.color)}>{item.title}</div>
            <div css={metricValueContainerStyle}>
              <span css={item.iconStyle}>{item.icon}</span>
              <span css={metricValueStyle(theme, item.color)}>
                {item.key === 'xp'
                  ? resultData.xp
                  : item.key === 'successRate'
                    ? `${resultData.successRate}%`
                    : resultData.timeTaken}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div css={buttonsContainerStyle}>
        <Button variant="primary" onClick={handleContinue} css={continueButtonStyle}>
          학습 계속하기
        </Button>
        <Button variant="secondary" onClick={handleGoToMain} css={mainButtonStyle}>
          메인 페이지로 이동하기
        </Button>
      </div>
    </div>
  );
};

const containerStyle = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  min-height: 100vh;
  padding: 48px 24px;
  background: linear-gradient(180deg, #eef1ff 0%, #f7f7fc 100%);
`;

const titleStyle = (theme: Theme) => css`
  font-size: ${theme.typography['32Bold'].fontSize};
  line-height: ${theme.typography['32Bold'].lineHeight};
  font-weight: ${theme.typography['32Bold'].fontWeight};
  color: ${theme.colors.primary.dark};
  margin: 0;
  text-align: center;
`;

const placeholderStyle = (theme: Theme) => css`
  width: 200px;
  height: 200px;
  background: ${theme.colors.surface.strong};
  border-radius: ${theme.borderRadius.large};
`;

const metricsContainerStyle = css`
  display: flex;
  gap: 16px;
  width: 100%;
  max-width: 600px;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const metricCardStyle = (theme: Theme, color: 'purple' | 'green' | 'gray') => css`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: ${color === 'purple'
    ? theme.colors.primary.surface
    : color === 'green'
      ? theme.colors.success.light
      : theme.colors.surface.default};
  border: 2px solid
    ${color === 'purple'
      ? theme.colors.primary.main
      : color === 'green'
        ? theme.colors.success.main
        : theme.colors.border.default};
  border-radius: ${theme.borderRadius.medium};
`;

const metricTitleStyle = (theme: Theme, color: 'purple' | 'green' | 'gray') => css`
  font-size: ${theme.typography['16Medium'].fontSize};
  line-height: ${theme.typography['16Medium'].lineHeight};
  font-weight: ${theme.typography['16Medium'].fontWeight};
  color: ${color === 'purple'
    ? theme.colors.primary.dark
    : color === 'green'
      ? theme.colors.success.main
      : theme.colors.text.default};
  text-align: center;
`;

const metricValueContainerStyle = css`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const metricValueStyle = (theme: Theme, color: 'purple' | 'green' | 'gray') => css`
  font-size: ${theme.typography['24Bold'].fontSize};
  line-height: ${theme.typography['24Bold'].lineHeight};
  font-weight: ${theme.typography['24Bold'].fontWeight};
  color: ${color === 'purple'
    ? theme.colors.primary.dark
    : color === 'green'
      ? theme.colors.success.main
      : theme.colors.text.default};
`;

const buttonsContainerStyle = css`
  display: flex;
  flex-direction: column;
  gap: 28px;
  width: 100%;
  max-width: 400px;
`;

const continueButtonStyle = css`
  width: 100%;
`;

const mainButtonStyle = css`
  width: 100%;
`;
