import { css, useTheme } from '@emotion/react';
import { type FormEvent, useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import { JsonlUploadCard } from '@/feat/admin/components/JsonlUploadCard';
import { useAdminJsonlUpload } from '@/feat/admin/hooks/useAdminJsonlUpload';
import {
  adminService,
  type ProfileCharacterCreateResponse,
  type ProfileCharacterUploadSummary,
} from '@/services/adminService';
import type { Theme } from '@/styles/theme';

/**
 * 관리자 프로필 캐릭터 등록 페이지
 */
export const AdminProfileCharacters = () => {
  const theme = useTheme();
  const [imageUrl, setImageUrl] = useState('');
  const [priceDiamonds, setPriceDiamonds] = useState('0');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitStatus, setSubmitStatus] = useState('대기 중');
  const [submitResult, setSubmitResult] = useState<ProfileCharacterCreateResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { status, result, busy, hasFile, onFileChange, onSubmit } =
    useAdminJsonlUpload<ProfileCharacterUploadSummary>(adminService.uploadProfileCharacters);

  const isFormReady = useMemo(() => {
    const trimmedUrl = imageUrl.trim();
    const parsedPrice = Number(priceDiamonds);

    if (!trimmedUrl) return false;
    if (!Number.isFinite(parsedPrice)) return false;
    if (parsedPrice < 0) return false;

    return true;
  }, [imageUrl, priceDiamonds]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isFormReady) {
      setSubmitStatus('필수 입력을 확인해주세요.');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('등록 중...');
    setSubmitResult(null);

    try {
      const payload = {
        imageUrl: imageUrl.trim(),
        priceDiamonds: Number(priceDiamonds),
        description: description.trim() || null,
        isActive,
      };
      const response = await adminService.createProfileCharacter(payload);
      setSubmitStatus('등록 완료');
      setSubmitResult(response);
      setImageUrl('');
      setPriceDiamonds('0');
      setDescription('');
      setIsActive(true);
    } catch (error) {
      setSubmitStatus('등록 실패');
      setSubmitResult({ error: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div css={pageStyle}>
      <section css={cardStyle(theme)}>
        <h1 css={titleStyle(theme)}>프로필 캐릭터 단일 등록</h1>
        <p css={descriptionStyle(theme)}>
          이미지 URL, 가격, 설명(선택)을 입력하면 단일 캐릭터를 등록합니다.
        </p>
        <form css={formStyle} onSubmit={handleSubmit}>
          <label htmlFor="imageUrl" css={labelStyle(theme)}>
            이미지 URL
          </label>
          <input
            id="imageUrl"
            value={imageUrl}
            onChange={event => setImageUrl(event.target.value)}
            placeholder="https://example.com/character.png"
            css={inputStyle(theme)}
          />

          <label htmlFor="priceDiamonds" css={labelStyle(theme)}>
            다이아 가격
          </label>
          <input
            id="priceDiamonds"
            type="number"
            min={0}
            value={priceDiamonds}
            onChange={event => setPriceDiamonds(event.target.value)}
            css={inputStyle(theme)}
          />

          <label htmlFor="description" css={labelStyle(theme)}>
            설명(선택)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder="설명은 선택입니다."
            css={textareaStyle(theme)}
          />

          <label css={checkboxLabelStyle(theme)}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={event => setIsActive(event.target.checked)}
            />
            판매/노출 여부
          </label>

          <div css={footerStyle}>
            <Button type="submit" disabled={!isFormReady || isSubmitting} fullWidth>
              {isSubmitting ? '등록 중...' : '등록하기'}
            </Button>
          </div>
        </form>

        <div css={statusBoxStyle(theme)}>
          <span css={statusDot(submitStatus)} />
          {submitStatus}
        </div>
        <pre css={preStyle(theme, 260)}>{JSON.stringify(submitResult ?? {}, null, 2)}</pre>
      </section>

      <JsonlUploadCard
        title="프로필 캐릭터 JSONL 업로드"
        description="profile_characters.jsonl 형식의 JSONL 파일을 업로드하면 이미지 URL 기준으로 업서트합니다."
        status={status}
        result={result}
        busy={busy}
        hasFile={hasFile}
        onFileChange={onFileChange}
        onSubmit={onSubmit}
        example={
          <pre>
            {`{"image_url":"https://.../char01.png","price_diamonds":1,"description":"기본 캐릭터","is_active":true}
{"image_url":"https://.../char02.png","price_diamonds":5,"is_active":true}`}
          </pre>
        }
        tip={
          <>
            <span style={{ marginRight: '6px' }}>💡</span>
            TIP: 동일한 image_url이 있으면 가격/설명/노출 여부를 업데이트합니다.
          </>
        }
      />
    </div>
  );
};

const pageStyle = css`
  width: 100%;
  display: flex;
  gap: 24px;
  align-items: start;

  @media (max-width: 1024px) {
    flex-direction: column;
  }
`;

const cardStyle = (theme: Theme) => css`
  flex: 1;
  background: ${theme.colors.surface.strong};
  padding: 32px;
  border-radius: ${theme.borderRadius.large};
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);

  @media (max-width: 1024px) {
    width: 100%;
  }
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

const formStyle = css`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const labelStyle = (theme: Theme) => css`
  font-weight: 700;
  color: ${theme.colors.text.strong};
`;

const inputStyle = (theme: Theme) => css`
  width: 100%;
  padding: 12px 14px;
  border-radius: ${theme.borderRadius.medium};
  border: 1px solid ${theme.colors.border.default};
  background: ${theme.colors.surface.default};
  color: ${theme.colors.text.default};

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary.main};
  }
`;

const textareaStyle = (theme: Theme) => css`
  width: 100%;
  min-height: 90px;
  padding: 12px 14px;
  border-radius: ${theme.borderRadius.medium};
  border: 1px solid ${theme.colors.border.default};
  background: ${theme.colors.surface.default};
  color: ${theme.colors.text.default};
  resize: vertical;

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary.main};
  }
`;

const checkboxLabelStyle = (theme: Theme) => css`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${theme.colors.text.default};
  font-weight: 600;
`;

const footerStyle = css`
  margin-top: 12px;
`;

const statusBoxStyle = (theme: Theme) => css`
  display: flex;
  align-items: center;
  margin-top: 20px;
  padding: 12px 16px;
  background: ${theme.colors.surface.default};
  border-radius: 8px;
  font-weight: 600;
  color: ${theme.colors.text.strong};
`;

const statusDot = (status: string) => {
  let color = '#eab308';
  if (status === '등록 완료') color = '#22c55e';
  if (status === '등록 실패') color = '#ef4444';

  return css`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 10px;
    background: ${color};
  `;
};

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
