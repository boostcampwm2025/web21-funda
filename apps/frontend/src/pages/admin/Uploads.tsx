import { css, useTheme } from '@emotion/react';
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AdminProfileCharacters } from '@/pages/admin/ProfileCharacters';
import { AdminQuizUpload } from '@/pages/admin/QuizUpload';
import { AdminUnitOverviewUpload } from '@/pages/admin/UnitOverviewUpload';
import type { Theme } from '@/styles/theme';

type UploadType = 'quizzes' | 'unit-overviews' | 'profile-characters';

const UPLOAD_OPTIONS: Array<{ value: UploadType; label: string }> = [
  { value: 'quizzes', label: '퀴즈(JSONL)' },
  { value: 'unit-overviews', label: '유닛 개요(JSONL)' },
  { value: 'profile-characters', label: '프로필 캐릭터(단일/JSONL)' },
];

const DEFAULT_TYPE: UploadType = 'quizzes';

const isUploadType = (value: string | null): value is UploadType =>
  value === 'quizzes' || value === 'unit-overviews' || value === 'profile-characters';

export const AdminUploads = () => {
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawType = searchParams.get('type');
  const selectedType: UploadType = isUploadType(rawType) ? rawType : DEFAULT_TYPE;

  // Normalize invalid/missing type to a stable default (keeps the URL shareable).
  useEffect(() => {
    if (isUploadType(rawType)) return;
    setSearchParams({ type: DEFAULT_TYPE }, { replace: true });
  }, [rawType, setSearchParams]);

  const pageTitle = useMemo(() => {
    const option = UPLOAD_OPTIONS.find(item => item.value === selectedType);
    return option?.label ?? '업로드';
  }, [selectedType]);

  return (
    <div css={pageStyle}>
      <section css={headerCardStyle(theme)}>
        <div>
          <h1 css={titleStyle(theme)}>업로드</h1>
          <p css={descStyle(theme)}>업로드 유형을 선택하면 해당 화면으로 전환됩니다.</p>
        </div>
        <label css={selectLabelStyle(theme)} htmlFor="admin-upload-type">
          <span>업로드 유형</span>
          <select
            id="admin-upload-type"
            value={selectedType}
            onChange={event => setSearchParams({ type: event.target.value as UploadType })}
            css={selectStyle(theme)}
          >
            {UPLOAD_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section css={contentStyle} aria-label={`선택된 업로드: ${pageTitle}`}>
        {selectedType === 'quizzes' && <AdminQuizUpload />}
        {selectedType === 'unit-overviews' && <AdminUnitOverviewUpload />}
        {selectedType === 'profile-characters' && <AdminProfileCharacters />}
      </section>
    </div>
  );
};

const pageStyle = css`
  width: fit-content;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const headerCardStyle = (theme: Theme) => css`
  width: 100%;
  margin: 0 auto;
  padding: 20px;
  border-radius: ${theme.borderRadius.large};
  border: 1px solid ${theme.colors.border.default};
  background: ${theme.colors.surface.strong};
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const titleStyle = (theme: Theme) => css`
  margin: 0 0 8px;
  font-size: ${theme.typography['20Bold'].fontSize};
  color: ${theme.colors.text.strong};
`;

const descStyle = (theme: Theme) => css`
  margin: 0;
  font-size: ${theme.typography['14Medium'].fontSize};
  color: ${theme.colors.text.default};
  line-height: 1.6;
`;

const selectLabelStyle = (theme: Theme) => css`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: ${theme.typography['12Medium'].fontSize};
  color: ${theme.colors.text.default};
  min-width: 220px;
`;

const selectStyle = (theme: Theme) => css`
  padding: 10px 12px;
  border-radius: ${theme.borderRadius.medium};
  border: 1px solid ${theme.colors.border.default};
  background: ${theme.colors.surface.default};
  color: ${theme.colors.text.default};
  font-size: ${theme.typography['16Medium'].fontSize};
  line-height: ${theme.typography['16Medium'].lineHeight};

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary.main};
    box-shadow: 0 0 0 2px ${theme.colors.primary.light};
  }
`;

const contentStyle = css`
  width: 100%;
`;
