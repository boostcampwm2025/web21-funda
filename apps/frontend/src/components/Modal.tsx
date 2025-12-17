import { css, useTheme } from '@emotion/react';

import type { Theme } from '../styles/theme';

interface ModalProps {
  title: string;
  content: React.ReactNode;
  onClose: () => void;
}

export const Modal = ({ title, content, onClose }: ModalProps) => {
  const theme = useTheme();

  return (
    <div css={modalOverlayStyle} onClick={onClose}>
      <div css={modalContentStyle(theme)} onClick={e => e.stopPropagation()}>
        <div css={modalHeaderStyle}>
          <h2 css={modalTitleStyle(theme)}>{title}</h2>
          <button css={modalCloseButtonStyle} onClick={onClose}>
            ✕
          </button>
        </div>
        <div css={modalBodyStyle(theme)}>{content}</div>
      </div>
    </div>
  );
};

const modalOverlayStyle = css`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
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
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
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
`;

const modalBodyStyle = (theme: Theme) => css`
  font-size: ${theme.typography['16Medium'].fontSize};
  line-height: ${theme.typography['16Medium'].lineHeight};
  font-weight: ${theme.typography['16Medium'].fontWeight};
`;
