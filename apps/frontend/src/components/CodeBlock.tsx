import { css, useTheme } from '@emotion/react';
import type { HTMLAttributes } from 'react';

import type { Theme } from '@/styles/theme';

export interface CodeBlockProps extends HTMLAttributes<HTMLPreElement> {
  children: React.ReactNode;
  language?: string;
}

export const CodeBlock = ({ children, language = 'JavaScript' }: CodeBlockProps) => {
  const theme = useTheme();

  // 백엔드에서 받은 데이터의 엔터를 구분하여 처리
  const formatCode = (content: React.ReactNode): React.ReactNode => {
    if (typeof content === 'string') {
      // 문자열인 경우 엔터(\n)를 <br>로 변환
      return content.split('\n').map((line, index, array) => (
        <span key={index}>
          {line}
          {index < array.length - 1 && <br />}
        </span>
      ));
    }
    return content;
  };

  return (
    <div css={codeBlockContainerStyle(theme)}>
      <div css={badgeContainerStyle(theme)}>
        <div css={badgeStyle(theme)}>{language}</div>
      </div>
      <pre css={preStyle}>
        <code css={codeStyle(theme)}>{formatCode(children)}</code>
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
  color: ${theme.colors.text.default};
  font-size: ${theme.typography['12Medium'].fontSize};
`;

const preStyle = css`
  margin: 0;
  padding: 20px;
  overflow-x: auto;
`;

const codeStyle = (theme: Theme) => css`
  font-family: 'D2Coding', 'Courier New', monospace;
  font-size: ${theme.typography['16Medium'].fontSize};
  line-height: 1.6;
  color: ${theme.colors.surface.default};
  white-space: pre-wrap;
  word-wrap: break-word;
`;
