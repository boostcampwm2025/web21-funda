import { css, useTheme } from '@emotion/react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../components/Button';
import type { Theme } from '../styles/theme';
import { palette } from '../styles/token';

// TODO: 실제 날짜에 맞춰서 정렬되도록 수정
const streakData = {
  days: 3,
  completedDays: ['We', 'Th', 'Fr'],
  allDays: ['We', 'Th', 'Fr', 'Sa', 'Su', 'Mo', 'Tu'],
};

export const Streak = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const handleNavigate = useCallback(() => {
    navigate('/learn');
  }, [navigate]);

  return (
    <div css={containerStyle}>
      <div css={contentStyle}>
        <div css={flameContainerStyle}>
          <span css={flameStyle}>🔥</span>
        </div>
        <h1 css={titleStyle(theme)}>{streakData.days}일 연속 학습</h1>
        <div css={daysContainerStyle}>
          {streakData.allDays.map(day => {
            const isCompleted = streakData.completedDays.includes(day);
            return (
              <div key={day} css={dayContainerStyle}>
                <span css={dayLabelStyle(theme)}>{day}</span>
                <div css={dayCircleStyle(theme, isCompleted)}>
                  {isCompleted && <span css={checkmarkStyle}>✓</span>}
                </div>
              </div>
            );
          })}
        </div>
        <p css={encouragementStyle(theme)}>계속 학습해서 {streakData.days + 1}일차로 이어가세요!</p>
        <Button variant="secondary" onClick={handleNavigate} fullWidth css={buttonStyle()}>
          클릭하여 넘어가기
        </Button>
      </div>
    </div>
  );
};

const containerStyle = css`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
`;

const contentStyle = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  max-width: 600px;
  width: 100%;
`;

const flameContainerStyle = css`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const flameStyle = css`
  font-size: 120px;
  filter: drop-shadow(0 0 20px rgba(255, 140, 0, 0.5));
`;

const titleStyle = (theme: Theme) => css`
  font-size: ${theme.typography['32Bold'].fontSize};
  line-height: ${theme.typography['32Bold'].lineHeight};
  font-weight: ${theme.typography['32Bold'].fontWeight};
  color: ${theme.colors.success.main};
  margin: 0;
`;

const daysContainerStyle = css`
  display: flex;
  gap: 20px;
  margin: 16px 0 0 0;
`;

const dayContainerStyle = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 16px 0;
`;

const dayCircleStyle = (theme: Theme, isCompleted: boolean) => css`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: ${isCompleted ? theme.colors.success.main : palette.grayscale[400]};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
`;

const checkmarkStyle = css`
  color: white;
  font-size: 30px;
  font-weight: bold;
`;

const dayLabelStyle = (theme: Theme) => css`
  font-size: ${theme.typography['24Bold'].fontSize};
  line-height: ${theme.typography['24Bold'].lineHeight};
  font-weight: ${theme.typography['24Bold'].fontWeight};
  color: ${theme.colors.text.default};
`;

const encouragementStyle = (theme: Theme) => css`
  font-size: ${theme.typography['16Medium'].fontSize};
  line-height: ${theme.typography['16Medium'].lineHeight};
  font-weight: ${theme.typography['16Medium'].fontWeight};
  color: ${theme.colors.text.light};
  margin: 0;
  text-align: center;
`;

const buttonStyle = () => css`
  margin-top: 1rem;
  width: 25rem;
`;
