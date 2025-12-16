import { css, useTheme } from '@emotion/react';
import type { HTMLAttributes } from 'react';

import type { Theme } from '../styles/theme';

export interface CodeBlockProps extends HTMLAttributes<HTMLPreElement> {
  children: React.ReactNode;
  language?: string; // 우측 상단 라벨을 위한 props 추가
}

export const CodeBlock = ({ children, language = 'JavaScript' }: CodeBlockProps) => {
  const theme = useTheme();

  return (
    <div css={codeBlockContainerStyle(theme)}>
      <div css={badgeContainerStyle(theme)}>
        <div css={badgeStyle(theme)}>
          <span>{language}</span>
        </div>
      </div>
      <pre>
        <code css={codeStyle(theme)}>{children}</code>
      </pre>
    </div>
  );
};

const codeBlockContainerStyle = (theme: Theme) => css`
  background: ${theme.colors.text.strong};
  border-radius: ${theme.borderRadius.medium};
  border: 1px solid ${theme.colors.border.default};
  overflow: hidden;
`;

const badgeContainerStyle = (theme: Theme) => css`
  background: ${theme.colors.text.default};
  border-bottom: 1px solid ${theme.colors.text.light};
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 8px 12px;
`;

const badgeStyle = (theme: Theme) => css`
  background: #fff9c4;
  padding: 4px 12px;
  border-radius: 20px;

  span {
    color: ${theme.colors.text.default};
    font-size: ${theme.typography['12Medium'].fontSize};
  }
`;

const codeStyle = (theme: Theme) => css`
  font-family: 'D2Coding', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: ${theme.colors.surface.default};
  white-space: pre;
  padding: 20px;
`;
