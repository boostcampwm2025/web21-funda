import { css, useTheme } from '@emotion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Theme } from '../../styles/theme';
import { Button } from '../Button';

interface QuizHeaderProps {
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
}

export const QuizHeader = ({ currentStep, totalSteps, completedSteps }: QuizHeaderProps) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [showExitModal, setShowExitModal] = useState(false);

  const handleCloseClick = () => {
    if (completedSteps > 0) {
      setShowExitModal(true);
    } else {
      navigate('/learn');
    }
  };

  const handleContinue = () => {
    setShowExitModal(false);
  };

  const handleExit = () => {
    navigate('/learn');
  };

  const progress = (completedSteps / totalSteps) * 100;

  return (
    <>
      <header css={headerStyle(theme)}>
        <div css={headerContentStyle}>
          <button css={closeButtonStyle} onClick={handleCloseClick}>
            ✕
          </button>
          <div css={progressContainerStyle(theme)}>
            <div css={progressBarStyle(theme, progress)} />
          </div>
          <div css={progressTextStyle(theme)}>
            {currentStep}/{totalSteps}
          </div>
        </div>
      </header>

      {showExitModal && (
        <div css={modalOverlayStyle} onClick={handleContinue}>
          <div css={modalContentStyle(theme)} onClick={e => e.stopPropagation()}>
            <div css={modalHeaderStyle}>
              <h2 css={modalTitleStyle(theme)}>학습 종료</h2>
              <button css={modalCloseButtonStyle} onClick={handleContinue}>
                ✕
              </button>
            </div>
            <div css={modalBodyStyle(theme)}>진행 중인 학습을 종료하시겠습니까?</div>
            <div css={modalFooterStyle}>
              <Button variant="secondary" css={modalButtonStyle} onClick={handleContinue}>
                계속 학습하기
              </Button>
              <Button variant="primary" css={modalButtonStyle} onClick={handleExit}>
                학습 종료하기
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const headerStyle = (theme: Theme) => css`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  background: ${theme.colors.surface.strong};
  border-bottom: 1px solid ${theme.colors.border.default};
`;

const headerContentStyle = css`
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: 45rem;
  width: 100%;
  margin: 0 auto;
`;

const closeButtonStyle = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
`;

const progressContainerStyle = (theme: Theme) => css`
  flex: 1;
  height: 8px;
  background: ${theme.colors.surface.default};
  border-radius: ${theme.borderRadius.small};
  overflow: hidden;
`;

const progressBarStyle = (theme: Theme, progress: number) => css`
  height: 100%;
  width: ${progress}%;
  background: ${theme.colors.primary.main};
  border-radius: ${theme.borderRadius.small};
  transition: width 300ms ease;
`;

const progressTextStyle = (theme: Theme) => css`
  font-size: ${theme.typography['16Medium'].fontSize};
  line-height: ${theme.typography['16Medium'].lineHeight};
  font-weight: ${theme.typography['16Medium'].fontWeight};
  color: ${theme.colors.text.default};
  min-width: 48px;
  text-align: right;
`;

const modalOverlayStyle = css`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const modalContentStyle = (theme: Theme) => css`
  background: ${theme.colors.surface.strong};
  border-radius: ${theme.borderRadius.large};
  padding: 24px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
`;

const modalHeaderStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const modalTitleStyle = (theme: Theme) => css`
  font-size: ${theme.typography['20Bold'].fontSize};
  line-height: ${theme.typography['20Bold'].lineHeight};
  font-weight: ${theme.typography['20Bold'].fontWeight};
  color: ${theme.colors.text.strong};
  margin: 0;
`;

const modalCloseButtonStyle = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
`;

const modalBodyStyle = (theme: Theme) => css`
  font-size: ${theme.typography['16Medium'].fontSize};
  line-height: ${theme.typography['16Medium'].lineHeight};
  font-weight: ${theme.typography['16Medium'].fontWeight};
  color: ${theme.colors.text.default};
  margin-bottom: 24px;
`;

const modalFooterStyle = css`
  display: flex;
  gap: 12px;
`;

const modalButtonStyle = css`
  flex: 1;
`;
