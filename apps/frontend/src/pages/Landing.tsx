import { css, useTheme } from '@emotion/react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../components/Button';
import type { Theme } from '../styles/theme';

export const Landing = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const handleStart = useCallback(() => {
    navigate('/fields');
  }, [navigate]);

  const handleLogin = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  return (
    <div css={containerStyle()}>
      <div css={placeholderStyle(theme)}></div>
      <div css={textSectionStyle}>
        <h1 css={titleStyle(theme)}>
          "컴퓨터 사이언스를 배우기 위한 <br /> 가장 재밌고 효과적인 방법"
        </h1>
        <div css={buttonGroupStyle}>
          <Button variant="primary" onClick={handleStart} fullWidth>
            사용해 보기
          </Button>
          <Button variant="secondary" onClick={handleLogin} fullWidth>
            전 이미 계정이 있어요
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
  gap: 64px;
  padding: 48px 24px;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 32px;
  }
`;

const placeholderStyle = (theme: Theme) => css`
  width: 200px;
  height: 200px;
  background: ${theme.colors.surface.strong};
  border-radius: ${theme.borderRadius.large};
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;

  @media (max-width: 768px) {
    width: 300px;
    height: 300px;
  }
`;

const textSectionStyle = css`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 32px;
`;

const titleStyle = (theme: Theme) => css`
  font-size: ${theme.typography['36ExtraBold'].fontSize};
  line-height: ${theme.typography['36ExtraBold'].lineHeight};
  font-weight: ${theme.typography['36ExtraBold'].fontWeight};
  color: ${theme.colors.text.weak};
  margin: 0;
  text-align: center;
`;

const buttonGroupStyle = css`
  display: flex;
  flex-direction: column;
  gap: 28px;
  width: 100%;
`;
