import { ThemeProvider } from '@emotion/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { Landing } from '@/pages/Landing';
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

const renderLanding = () =>
  render(
    <ThemeProvider theme={lightTheme}>
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    </ThemeProvider>,
  );

describe('Landing 컴포넌트 테스트', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('"사용해 보기" 버튼이 렌더링된다', () => {
    renderLanding();

    const button = screen.getByText('사용해 보기');
    expect(button).toBeInTheDocument();
  });

  it('"사용해 보기" 버튼 클릭 시 /fields로 이동한다', () => {
    renderLanding();

    const button = screen.getByText('사용해 보기');
    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/fields');
  });

  it('"전 이미 계정이 있어요" 버튼이 렌더링된다', () => {
    renderLanding();

    const button = screen.getByText('전 이미 계정이 있어요');
    expect(button).toBeInTheDocument();
  });

  it('"전 이미 계정이 있어요" 버튼 클릭 시 /login으로 이동한다', () => {
    renderLanding();

    const button = screen.getByText('전 이미 계정이 있어요');
    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
