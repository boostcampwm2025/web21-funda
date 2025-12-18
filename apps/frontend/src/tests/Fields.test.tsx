import { ThemeProvider } from '@emotion/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { Fields } from '@/pages/Fields';
import { lightTheme } from '@/styles/theme';

// useNavigate 모킹
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderFields = () =>
  render(
    <ThemeProvider theme={lightTheme}>
      <MemoryRouter>
        <Fields />
      </MemoryRouter>
    </ThemeProvider>,
  );

describe('Fields 컴포넌트 테스트', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('필드 버튼들이 렌더링된다', () => {
    renderFields();

    expect(screen.getByText('프론트엔드')).toBeInTheDocument();
    expect(screen.getByText('백엔드')).toBeInTheDocument();
    expect(screen.getByText('모바일')).toBeInTheDocument();
    expect(screen.getByText('CS 기초')).toBeInTheDocument();
  });

  it('필드 버튼 클릭 시 토글이 잘된다', () => {
    renderFields();

    const frontendButton = screen.getByText('프론트엔드').closest('button');

    // 처음에는 체크마크가 없음
    expect(frontendButton).not.toHaveTextContent('✓');

    // 클릭하여 선택 (체크마크 표시)
    fireEvent.click(frontendButton!);
    expect(frontendButton).toHaveTextContent('✓');

    // 다시 클릭하여 해제 (체크마크 사라짐)
    fireEvent.click(frontendButton!);
    expect(frontendButton).not.toHaveTextContent('✓');
  });

  it('선택 전에는 "선택 완료하고 시작하기" 버튼이 비활성화된다', () => {
    renderFields();

    const completeButton = screen.getByText('선택 완료하고 시작하기');
    expect(completeButton).toBeDisabled();
  });

  it('필드 선택 후 버튼이 활성화되고 클릭 시 /learn으로 이동한다', () => {
    renderFields();

    const frontendButton = screen.getByText('프론트엔드').closest('button');
    const completeButton = screen.getByText('선택 완료하고 시작하기');

    // 필드 선택
    fireEvent.click(frontendButton!);

    // 버튼 활성화 확인
    expect(completeButton).not.toBeDisabled();

    // 버튼 클릭
    fireEvent.click(completeButton);

    // /learn으로 이동 확인
    expect(mockNavigate).toHaveBeenCalledWith('/learn');
  });

  it('여러 필드 선택 후 버튼 활성화된다', () => {
    renderFields();

    const frontendButton = screen.getByText('프론트엔드').closest('button');
    const backendButton = screen.getByText('백엔드').closest('button');
    const completeButton = screen.getByText('선택 완료하고 시작하기');

    // 여러 필드 선택
    fireEvent.click(frontendButton!);
    fireEvent.click(backendButton!);

    // 버튼 활성화 확인
    expect(completeButton).not.toBeDisabled();
  });
});
