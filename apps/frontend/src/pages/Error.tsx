import { css, useTheme } from '@emotion/react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../components/Button';
import type { Theme } from '../styles/theme';

export const Error = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <div css={containerStyle()}>
      <h1 css={titleStyle(theme)}>페이지를 찾을 수 없습니다.</h1>
      <p css={descriptionStyle(theme)}>
        요청하신 페이지가 존재하지 않거나
        <br />
        접근할 수 없는 페이지입니다.
      </p>
      <div css={buttonWrapperStyle}>
        <Button variant="primary" onClick={() => navigate('/')} fullWidth>
          메인 페이지로 이동
        </Button>
      </div>
    </div>
  );
};

const containerStyle = () => css`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  gap: 32px;
`;

const titleStyle = (theme: Theme) => css`
  font-size: ${theme.typography['32Bold'].fontSize};
  line-height: ${theme.typography['32Bold'].lineHeight};
  font-weight: ${theme.typography['32Bold'].fontWeight};
  color: ${theme.colors.text.default};
  margin: 0;
  text-align: center;
`;

const descriptionStyle = (theme: Theme) => css`
  font-size: ${theme.typography['16Medium'].fontSize};
  line-height: ${theme.typography['16Medium'].lineHeight};
  font-weight: ${theme.typography['16Medium'].fontWeight};
  color: ${theme.colors.text.light};
  margin: 0;
  text-align: center;
  max-width: 400px;
`;

const buttonWrapperStyle = css`
  width: 100%;
  max-width: 300px;
`;
