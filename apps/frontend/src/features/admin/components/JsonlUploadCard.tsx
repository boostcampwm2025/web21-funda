import { css, useTheme } from '@emotion/react';
import { type ChangeEvent, type FormEventHandler, memo, useMemo } from 'react';

import { Button } from '@/components/Button';
import type { Theme } from '@/styles/theme';

export interface JsonlUploadCardProps {
  title: string;
  description: string;
  example?: React.ReactNode;

  status: string;
  result: unknown;
  busy: boolean;
  hasFile: boolean;
  onFileChange: (hasFile: boolean) => void;
  onSubmit: (files: File[]) => void;

  tip?: React.ReactNode;
  inputAccept?: string;
}

export const JsonlUploadCard = memo(
  ({
    title,
    description,
    example,
    status,
    result,
    busy,
    hasFile,
    onFileChange,
    onSubmit,
    tip,
    inputAccept = '.jsonl,.txt,.json',
  }: JsonlUploadCardProps) => {
    const theme = useTheme();

    const prettyResult = useMemo(() => {
      if (!result) return '{}';
      try {
        return JSON.stringify(result, null, 2);
      } catch {
        return String(result);
      }
    }, [result]);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
      onFileChange(!!e.target.files?.length);
    };

    const handleFormSubmit: FormEventHandler<HTMLFormElement> = event => {
      event.preventDefault();
      const fileInput = event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]');
      const files = fileInput?.files ? Array.from(fileInput.files) : [];
      if (files.length > 0) onSubmit(files);
    };

    return (
      <div css={cardStyle(theme)}>
        <h1 css={titleStyle(theme)}>{title}</h1>
        <p css={descriptionStyle(theme)}>{description}</p>

        {example ? (
          <div css={[exampleBoxStyle(theme), examplePreStyle(theme)]}>{example}</div>
        ) : null}

        <form onSubmit={handleFormSubmit}>
          <label htmlFor="file" css={labelStyle(theme)}>
            JSONL 파일
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept={inputAccept}
            onChange={handleFileChange}
            css={fileInputStyle(theme)}
            multiple
          />
          <div css={footerStyle}>
            <Button variant="primary" type="submit" disabled={busy || !hasFile} fullWidth>
              {busy ? '업로드 중...' : '업로드 실행'}
            </Button>
          </div>
        </form>

        <div css={statusBoxStyle(theme)}>
          <span css={statusDot(status)} />
          {status}
        </div>

        <pre css={preStyle(theme, 360)}>{prettyResult}</pre>

        {tip ? <div css={tipStyle(theme)}>{tip}</div> : null}
      </div>
    );
  },
);

const cardStyle = (theme: Theme) => css`
  flex: 1;
  max-width: 45rem;
  background: ${theme.colors.surface.strong};
  padding: 32px;
  border-radius: ${theme.borderRadius.large};
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
`;

const titleStyle = (theme: Theme) => css`
  font-size: ${theme.typography['20Bold'].fontSize};
  color: ${theme.colors.text.strong};
  margin: 0 0 12px;
`;

const descriptionStyle = (theme: Theme) => css`
  font-size: ${theme.typography['16Medium'].fontSize};
  color: ${theme.colors.text.default};
  line-height: 1.6;
  margin-bottom: 20px;
`;

const exampleBoxStyle = (theme: Theme) => css`
  background: ${theme.colors.surface.default};
  border-radius: ${theme.borderRadius.medium};
  padding: 12px 16px;
  margin-bottom: 20px;
  color: ${theme.colors.text.default};
  font-size: 14px;
`;

const examplePreStyle = (theme: Theme) => css`
  & pre {
    margin: 8px 0 0;
    font-family: 'D2Coding', monospace;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    color: ${theme.colors.text.default};
  }
`;

const labelStyle = (theme: Theme) => css`
  display: block;
  margin-bottom: 8px;
  font-weight: 700;
  color: ${theme.colors.text.strong};
`;

const fileInputStyle = (theme: Theme) => css`
  width: 100%;
  padding: 16px;
  border: 1px dashed ${theme.colors.border.default};
  border-radius: ${theme.borderRadius.medium};
  background: ${theme.colors.surface.default};
  color: ${theme.colors.text.default};
  cursor: pointer;
  &:focus {
    outline: none;
    border-color: ${theme.colors.primary.main};
  }
`;

const footerStyle = css`
  margin-top: 24px;
  display: flex;
`;

const statusBoxStyle = (theme: Theme) => css`
  display: flex;
  align-items: center;
  margin-top: 24px;
  padding: 12px 16px;
  background: ${theme.colors.surface.default};
  border-radius: 8px;
  font-weight: 600;
  color: ${theme.colors.text.strong};
`;

const statusDot = (status: string) => css`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 10px;
  background: ${status === '업로드 완료'
    ? '#22c55e'
    : status === '업로드 실패'
      ? '#ef4444'
      : '#eab308'};
`;

const preStyle = (theme: Theme, maxHeight: number) => css`
  margin-top: 16px;
  padding: 16px;
  background: #1e293b;
  color: #f8fafc;
  border-radius: 8px;
  font-family: 'D2Coding', monospace;
  font-size: 14px;
  overflow: auto;
  max-height: ${maxHeight}px;
  border: 1px solid ${theme.colors.border.default};
  white-space: pre-wrap;
  word-break: break-word;
`;

const tipStyle = (theme: Theme) => css`
  margin-top: 16px;
  font-size: 14px;
  color: ${theme.colors.text.weak};
`;
