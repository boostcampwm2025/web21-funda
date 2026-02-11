import { css, useTheme } from '@emotion/react';

import SVGIcon from '@/components/SVGIcon';
import type { Theme } from '@/styles/theme';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination = ({ currentPage, totalPages, onPageChange }: PaginationProps) => {
  const theme = useTheme();

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav css={wrapperStyle} aria-label="페이지 이동">
      <button
        type="button"
        css={buttonStyle(theme)}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!canGoPrev}
      >
        <SVGIcon icon="ArrowLeft" size="sm" />
        <span>이전</span>
      </button>

      <span css={pageTextStyle(theme)}>
        {currentPage} / {totalPages}
      </span>

      <button
        type="button"
        css={buttonStyle(theme)}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!canGoNext}
      >
        <span>다음</span>
        <SVGIcon icon="ArrowLeft" size="sm" style={{ transform: 'rotate(180deg)' }} />
      </button>
    </nav>
  );
};

const wrapperStyle = css`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
`;

const buttonStyle = (theme: Theme) => css`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: ${theme.colors.text.default};
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 120ms ease;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const pageTextStyle = (theme: Theme) => css`
  min-width: 72px;
  text-align: center;
  color: ${theme.colors.text.weak};
  font-size: ${theme.typography['12Medium'].fontSize};
`;
