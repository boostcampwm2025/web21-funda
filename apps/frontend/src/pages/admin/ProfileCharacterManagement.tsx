import { css, keyframes, useTheme } from '@emotion/react';
import { useCallback, useEffect, useState } from 'react';

import SVGIcon from '@/comp/SVGIcon';
import { Button } from '@/components/Button';
import {
  type AdminProfileCharacterItem,
  type AdminProfileCharacterUpdateRequest,
  adminService,
} from '@/services/adminService';
import type { Theme } from '@/styles/theme';

type AdminProfileCharacterRow = AdminProfileCharacterItem & {
  draftPriceDiamonds: string;
  draftIsActive: boolean;
  isSaving: boolean;
  saveMessage: string | null;
};

type ManagementStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * 관리자 프로필 캐릭터 관리 페이지
 */
export const AdminProfileCharacterManagement = () => {
  const theme = useTheme();
  const [managementStatus, setManagementStatus] = useState<ManagementStatus>('idle');
  const [managementMessage, setManagementMessage] = useState<string | null>(null);
  const [characterRows, setCharacterRows] = useState<AdminProfileCharacterRow[]>([]);

  /**
   * 관리자용 캐릭터 목록을 화면 상태로 변환한다.
   *
   * @param characters 관리자용 캐릭터 목록
   * @returns 화면용 캐릭터 목록
   */
  const buildCharacterRows = useCallback(
    (characters: AdminProfileCharacterItem[]): AdminProfileCharacterRow[] =>
      characters.map(character => ({
        ...character,
        draftPriceDiamonds: String(character.priceDiamonds),
        draftIsActive: character.isActive,
        isSaving: false,
        saveMessage: null,
      })),
    [],
  );

  /**
   * 관리자용 캐릭터 목록을 다시 불러온다.
   */
  const fetchCharacterRows = useCallback(async () => {
    setManagementStatus('loading');
    setManagementMessage(null);

    try {
      const response = await adminService.getProfileCharacters();
      setCharacterRows(buildCharacterRows(response));
      setManagementStatus('success');
    } catch (error) {
      setManagementStatus('error');
      setManagementMessage((error as Error).message);
    }
  }, [buildCharacterRows]);

  useEffect(() => {
    void fetchCharacterRows();
  }, [fetchCharacterRows]);

  const updateCharacterRow = useCallback(
    (characterId: number, updater: (row: AdminProfileCharacterRow) => AdminProfileCharacterRow) => {
      setCharacterRows(prevRows =>
        prevRows.map(row => (row.id === characterId ? updater(row) : row)),
      );
    },
    [],
  );

  const handlePriceChange = useCallback(
    (characterId: number, value: string) => {
      updateCharacterRow(characterId, row => ({
        ...row,
        draftPriceDiamonds: value,
        saveMessage: null,
      }));
    },
    [updateCharacterRow],
  );

  const handleActiveChange = useCallback(
    (characterId: number, nextValue: boolean) => {
      updateCharacterRow(characterId, row => ({
        ...row,
        draftIsActive: nextValue,
        saveMessage: null,
      }));
    },
    [updateCharacterRow],
  );

  const handleSaveCharacter = useCallback(
    async (row: AdminProfileCharacterRow) => {
      const parsedPrice = Number(row.draftPriceDiamonds);
      const isValidPrice = Number.isFinite(parsedPrice) && parsedPrice >= 0;

      if (!isValidPrice) {
        updateCharacterRow(row.id, current => ({
          ...current,
          saveMessage: '가격을 확인해주세요.',
        }));
        return;
      }

      const payload: AdminProfileCharacterUpdateRequest = {
        priceDiamonds: parsedPrice,
        isActive: row.draftIsActive,
      };

      updateCharacterRow(row.id, current => ({
        ...current,
        isSaving: true,
        saveMessage: '저장 중...',
      }));

      try {
        await adminService.updateProfileCharacter(row.id, payload);
        updateCharacterRow(row.id, current => ({
          ...current,
          priceDiamonds: parsedPrice,
          isActive: row.draftIsActive,
          isSaving: false,
          saveMessage: '저장 완료',
        }));
      } catch (error) {
        updateCharacterRow(row.id, current => ({
          ...current,
          isSaving: false,
          saveMessage: (error as Error).message,
        }));
      }
    },
    [updateCharacterRow],
  );

  return (
    <div css={pageStyle}>
      <section css={cardStyle(theme)}>
        <div css={cardHeaderStyle}>
          <div>
            <h1 css={titleStyle(theme)}>프로필 캐릭터 관리</h1>
            <p css={descriptionStyle(theme)}>캐릭터별 가격과 노출 여부를 수정할 수 있습니다.</p>
          </div>
          <button
            type="button"
            onClick={fetchCharacterRows}
            disabled={managementStatus === 'loading'}
            css={refreshButtonStyle(theme, managementStatus === 'loading')}
            aria-label="목록 새로고침"
            title="목록 새로고침"
          >
            <SVGIcon icon="Refresh" size="sm" />
          </button>
        </div>

        {managementStatus === 'loading' && (
          <div css={infoBoxStyle(theme)}>목록을 불러오는 중입니다.</div>
        )}

        {managementStatus === 'error' && (
          <div css={errorBoxStyle(theme)}>
            목록을 불러오지 못했습니다.
            {managementMessage && <span css={errorDetailStyle(theme)}>{managementMessage}</span>}
          </div>
        )}

        {managementStatus === 'success' && characterRows.length === 0 && (
          <div css={infoBoxStyle(theme)}>등록된 캐릭터가 없습니다.</div>
        )}

        {characterRows.length > 0 && (
          <div css={tableWrapperStyle}>
            <table css={tableStyle}>
              <thead>
                <tr>
                  <th>캐릭터</th>
                  <th>이미지</th>
                  <th>다이아 가격</th>
                  <th>노출 여부</th>
                  <th>저장</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {characterRows.map(row => {
                  const priceText = row.draftPriceDiamonds.trim();
                  const parsedPrice = Number(priceText);
                  const isValidPrice = Number.isFinite(parsedPrice) && parsedPrice >= 0;
                  const hasChanges =
                    priceText !== String(row.priceDiamonds) || row.draftIsActive !== row.isActive;

                  return (
                    <tr key={row.id} data-testid={`character-row-${row.id}`}>
                      <td>
                        <div css={characterIdStyle}>#{row.id}</div>
                        <div css={characterNameStyle(theme)}>{row.name}</div>
                        <div css={characterDescStyle(theme)}>{row.description ?? '설명 없음'}</div>
                      </td>
                      <td>
                        <img
                          src={row.imageUrl}
                          alt={`캐릭터 ${row.id} 이미지`}
                          css={characterImageStyle}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={row.draftPriceDiamonds}
                          onChange={event => handlePriceChange(row.id, event.target.value)}
                          css={inputStyle(theme)}
                          aria-label={`캐릭터 ${row.id} 다이아 가격`}
                          aria-invalid={!isValidPrice}
                        />
                      </td>
                      <td>
                        <label css={toggleLabelStyle(theme)}>
                          <input
                            type="checkbox"
                            checked={row.draftIsActive}
                            onChange={event => handleActiveChange(row.id, event.target.checked)}
                            aria-label={`캐릭터 ${row.id} 활성 상태`}
                          />
                          {row.draftIsActive ? '활성' : '비활성'}
                        </label>
                      </td>
                      <td>
                        <Button
                          type="button"
                          onClick={() => handleSaveCharacter(row)}
                          disabled={!hasChanges || row.isSaving || !isValidPrice}
                          aria-label={`캐릭터 ${row.id} 저장`}
                          css={saveButtonStyle}
                        >
                          {row.isSaving ? '저장 중' : '저장'}
                        </Button>
                      </td>
                      <td>
                        <span css={statusTextStyle(theme)}>{row.saveMessage ?? '대기'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

const pageStyle = css`
  width: 100%;
`;

const cardStyle = (theme: Theme) => css`
  width: 100%;
  box-sizing: border-box;
  background: ${theme.colors.surface.strong};
  padding: 32px;
  border-radius: ${theme.borderRadius.large};
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
`;

const cardHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
`;

const spinKeyframes = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const refreshButtonStyle = (theme: Theme, isRefreshing: boolean) => css`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: ${theme.colors.primary.main};
  border-radius: ${theme.borderRadius.medium};
  transition: background-color 150ms ease;

  ${isRefreshing &&
  css`
    animation: ${spinKeyframes} 1s linear infinite;
  `}

  &:hover {
    background: ${isRefreshing ? 'transparent' : theme.colors.surface.bold};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
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

const infoBoxStyle = (theme: Theme) => css`
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  background: ${theme.colors.surface.default};
  color: ${theme.colors.text.default};
  font-weight: 600;
`;

const errorBoxStyle = (theme: Theme) => css`
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  background: ${theme.colors.surface.default};
  color: ${theme.colors.error.main};
  font-weight: 600;
`;

const errorDetailStyle = (theme: Theme) => css`
  display: block;
  margin-top: 6px;
  color: ${theme.colors.text.default};
  font-size: ${theme.typography['12Medium'].fontSize};
`;

const tableWrapperStyle = css`
  margin-top: 16px;
  overflow-x: auto;
`;

const tableStyle = css`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 12px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    text-align: left;
    vertical-align: middle;
  }

  th {
    font-weight: 700;
    white-space: nowrap;
  }
`;

const characterIdStyle = css`
  font-weight: 700;
`;

const characterNameStyle = (theme: Theme) => css`
  color: ${theme.colors.text.default};
  font-size: ${theme.typography['14Medium'].fontSize};
`;

const characterDescStyle = (theme: Theme) => css`
  color: ${theme.colors.text.weak};
  font-size: ${theme.typography['12Medium'].fontSize};
  margin-top: 4px;
`;

const characterImageStyle = css`
  width: 64px;
  height: 64px;
  object-fit: contain;
  border-radius: 12px;
  background: #f8fafc;
`;

const toggleLabelStyle = (theme: Theme) => css`
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${theme.colors.text.default};
  font-weight: 600;
`;

const statusTextStyle = (theme: Theme) => css`
  color: ${theme.colors.text.default};
  font-weight: 600;
  font-size: ${theme.typography['12Medium'].fontSize};
`;

const saveButtonStyle = css`
  white-space: nowrap;
  min-width: 72px;
`;
