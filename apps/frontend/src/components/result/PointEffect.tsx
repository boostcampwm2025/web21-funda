import { css, keyframes } from '@emotion/react';

import type { Theme } from '@/styles/theme';

interface PointEffectProps {
  points: number;
}

export const PointEffect = ({ points }: PointEffectProps) => (
  <div css={containerStyle}>
    <div css={starContainerStyle}>
      <span css={starStyle}>🌟</span>
    </div>
    <div css={labelStyle}>POINT</div>
    <div css={pointsStyle}>{points}</div>
  </div>
);

const starShineAnimation = keyframes`
  0%, 100% {
    filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.8));
  }
  25% {
    filter: drop-shadow(0 0 20px rgba(255, 215, 0, 1));
  }
  50% {
    filter: drop-shadow(0 0 30px rgba(255, 215, 0, 1));
  }
  75% {
    filter: drop-shadow(0 0 20px rgba(255, 215, 0, 1));
  }
`;

const containerStyle = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 100vh;
  background: #000;
`;

const starContainerStyle = css`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const starStyle = css`
  font-size: 120px;
  animation: ${starShineAnimation} 1s ease-in-out infinite;
  filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.8));
`;

const labelStyle = (theme: Theme) => css`
  padding: 8px 24px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: ${theme.colors.primary.surface};
  letter-spacing: 2px;
`;

const pointsStyle = css`
  font-size: 72px;
  font-weight: 700;
  color: #a29aff;
  text-shadow: 0 0 20px rgba(162, 154, 255, 0.6);
`;
