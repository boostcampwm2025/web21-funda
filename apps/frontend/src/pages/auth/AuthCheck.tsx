import { css, type Theme, useTheme } from '@emotion/react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/comp/Button';
import { FundyPreviewCanvas } from '@/feat/fundy/components/FundyPreviewCanvas';
import { useStorage } from '@/hooks/useStorage';

export const AuthCheck = () => {
  const { updateUIState, uiState } = useStorage();
  const location = useLocation();
  const navigate = useNavigate();
  const { from } = (location.state as { from?: string } | undefined) ?? {};
  const theme = useTheme();

  const handleLogin = () => {
    navigate('/login');
  };

  const handleContinue = () => {
    if (from === '/quiz') {
      navigate('/quiz');
      const nextStepId = uiState.current_quiz_step_id + 1;
      const nextOrderIndex =
        typeof uiState.current_step_order_index === 'number'
          ? uiState.current_step_order_index + 1
          : undefined;

      updateUIState({
        current_quiz_step_id: nextStepId,
        ...(nextOrderIndex !== undefined
          ? { current_step_order_index: nextOrderIndex }
          : undefined),
      });
    } else {
      navigate('/learn');
    }
  };

  return (
    <div css={containerStyle()}>
      <div css={contentStyle(theme)}>
        <div css={placeholderStyle}>
          <FundyPreviewCanvas
            initialAnimation={{ lookAt: true }}
            idleExpression="wink"
            idleExpressionDelayMs={300}
            autoHello
          />
        </div>
        <div>
          <h1 css={titleStyle(theme)}>프로필을 생성하세요!</h1>
          <p css={descriptionStyle(theme)}>프로필을 만들어 학습 진도를 저장하고 계속 학습하세요!</p>
        </div>
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
  text-align: center;
`;

const contentStyle = (theme: Theme) => css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  max-width: 500px;
  width: 100%;
  color: ${theme.colors.text.light};
`;

const placeholderStyle = css`
  width: 100%;
  height: 400px;
  overflow: hidden;
`;

const titleStyle = (theme: Theme) => css`
  font-size: ${theme.typography['24Bold'].fontSize};
  line-height: ${theme.typography['24Bold'].lineHeight};
  font-weight: ${theme.typography['24Bold'].fontWeight};
  margin-bottom: 0.5rem;
`;

const descriptionStyle = (theme: Theme) => css`
  font-size: ${theme.typography['20Medium'].fontSize};
  line-height: ${theme.typography['20Medium'].lineHeight};
  font-weight: ${theme.typography['20Medium'].fontWeight};
`;

const buttonGroupStyle = css`
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  margin-top: 8px;
`;
