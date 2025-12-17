import { css, useTheme } from '@emotion/react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../components/Button';
import type { Theme } from '../styles/theme';

export const AuthCheck = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const handleLogin = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  const handleContinue = useCallback(() => {
    navigate('/learn');
  }, [navigate]);

  return (
    <div css={containerStyle()}>
      <div css={contentStyle()}>
        <div css={placeholderStyle(theme)}>
          <span css={emojiStyle}></span>
        </div>
        <h1 css={titleStyle(theme)}>프로필을 생성하세요!</h1>
        <p css={descriptionStyle(theme)}>프로필을 만들어 학습 진도를 저장하고 계속 학습하세요!</p>
        <div css={buttonGroupStyle}>
          <Button variant="primary" onClick={handleLogin} fullWidth>
            로그인하기
          </Button>
          <Button variant="secondary" onClick={handleContinue} fullWidth>
            그냥 사용할래요
          </Button>
        </div>
      </div>
    </div>
  );
};

const containerStyle = () => css`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
`;

const contentStyle = () => css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  max-width: 500px;
  width: 100%;
`;

const placeholderStyle = (theme: Theme) => css`
  width: 200px;
  height: 200px;
  background: ${theme.colors.surface.strong};
  border-radius: ${theme.borderRadius.large};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const emojiStyle = css`
  font-size: 100px;
`;

const titleStyle = (theme: Theme) => css`
  font-size: ${theme.typography['36ExtraBold'].fontSize};
  line-height: ${theme.typography['36ExtraBold'].lineHeight};
  font-weight: ${theme.typography['36ExtraBold'].fontWeight};
  color: ${theme.colors.text.default};
  margin: 0;
  text-align: center;
`;

const descriptionStyle = (theme: Theme) => css`
  font-size: ${theme.typography['20Medium'].fontSize};
  line-height: ${theme.typography['20Medium'].lineHeight};
  font-weight: ${theme.typography['20Medium'].fontWeight};
  color: ${theme.colors.text.light};
  margin: 0;
  text-align: center;
`;

const buttonGroupStyle = css`
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  margin-top: 8px;
`;
