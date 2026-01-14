import { ThemeProvider } from '@emotion/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type * as ReactRouterDom from 'react-router-dom';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LearnRightSidebar } from '@/feat/learn/components/RightSidebar';
import { ModalProvider } from '@/store/modalStore';
import { lightTheme } from '@/styles/theme';

// SVGIcon 모킹
vi.mock('@/comp/SVGIcon', () => ({
  default: ({ icon }: { icon: string }) => <span data-testid={`icon-${icon}`} />,
}));

const updateUIStateMock = vi.fn();

// useStorage 모킹
const mockUseStorage = vi.fn(() => ({
  progress: { heart: 5, last_solved_unit_id: [] },
  uiState: {
    last_viewed: { field_slug: 'frontend', unit_id: 1 },
    current_quiz_step_id: 0,
  },
  solvedStepHistory: [],
  updateProgress: vi.fn(),
  updateUIState: updateUIStateMock,
  addStepHistory: vi.fn(),
  updateLastSolvedUnit: vi.fn(),
}));

vi.mock('@/hooks/useStorage', () => ({
  useStorage: () => mockUseStorage(),
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof ReactRouterDom>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// useAuthStore 모킹
const mockUseAuthStore = vi.fn(() => false);

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { authStatus: string; user: unknown }) => boolean) => {
    const isLoggedIn = mockUseAuthStore();
    const state = {
      authStatus: isLoggedIn ? 'authenticated' : 'unauthenticated',
      user: isLoggedIn
        ? {
            id: 1,
            displayName: 'Test User',
            email: 'test@example.com',
            role: 'user',
            heartCount: 5,
            maxHeartCount: 5,
            experience: 100,
            currentStreak: 3,
            provider: 'github',
          }
        : null,
    };
    return selector(state);
  },
  useAuthUser: () => {
    const isLoggedIn = mockUseAuthStore();
    return isLoggedIn
      ? {
          id: 1,
          displayName: 'Test User',
          email: 'test@example.com',
          role: 'user',
          heartCount: 5,
          maxHeartCount: 5,
          experience: 100,
          currentStreak: 3,
          provider: 'github',
        }
      : null;
  },
  useIsLoggedIn: () => mockUseAuthStore(),
}));

const mockGetFields = vi.fn();

vi.mock('@/services/fieldService', () => ({
  fieldService: {
    getFields: () => mockGetFields(),
  },
}));

const renderSidebar = () =>
  render(
    <ThemeProvider theme={lightTheme}>
      <ModalProvider>
        <MemoryRouter>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              backgroundColor: lightTheme.colors.surface.default,
              minHeight: '100vh',
              padding: '24px',
            }}
          >
            <LearnRightSidebar />
          </div>
        </MemoryRouter>
      </ModalProvider>
    </ThemeProvider>,
  );

describe('LearnRightSidebar 컴포넌트 테스트', () => {
  beforeEach(() => {
    mockGetFields.mockResolvedValue({
      fields: [
        {
          slug: 'frontend',
          name: '프론트엔드',
          description: '프론트엔드',
          icon: 'Frontend',
        },
        {
          slug: 'backend',
          name: '백엔드',
          description: '백엔드',
          icon: 'Backend',
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    updateUIStateMock.mockClear();
    mockNavigate.mockClear();
    mockUseAuthStore.mockReturnValue(false);
  });

  it('기본 렌더링이 올바르게 동작한다', () => {
    renderSidebar();

    expect(screen.getByText(/FRONTEND/i)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // 하트 개수
  });

  it('필드 이름이 표시된다', () => {
    renderSidebar();

    expect(screen.getByText(/FRONTEND/i)).toBeInTheDocument();
  });

  it('비로그인 상태에서 하트 개수가 표시된다', () => {
    mockUseAuthStore.mockReturnValue(false);
    renderSidebar();

    expect(screen.getByText('5')).toBeInTheDocument(); // progress.heart
    expect(screen.getByTestId('icon-Heart')).toBeInTheDocument();
  });

  it('로그인 상태에서 Diamond와 Streak이 표시된다', () => {
    mockUseAuthStore.mockReturnValue(true);
    renderSidebar();

    expect(screen.getByText('0')).toBeInTheDocument(); // Diamond
    expect(screen.getByText('5')).toBeInTheDocument(); // Streak
    expect(screen.getByTestId('icon-Diamond')).toBeInTheDocument();
    expect(screen.getByTestId('icon-Streak')).toBeInTheDocument();
  });

  it('로그인 상태에서 learningDays가 표시된다', () => {
    mockUseAuthStore.mockReturnValue(true);
    renderSidebar();

    // USER_STATS.learningDays = 4
    const heartNumbers = screen.getAllByText('4');
    expect(heartNumbers.length).toBeGreaterThan(0);
  });

  it('오답 노트 카드가 표시된다', () => {
    renderSidebar();

    expect(screen.getByText('오답 노트')).toBeInTheDocument();
  });

  it('비로그인 상태에서 오답 노트에 로그인 링크가 표시된다', () => {
    mockUseAuthStore.mockReturnValue(false);
    renderSidebar();

    expect(screen.getByText(/로그인 후 문제를 복습해보세요/)).toBeInTheDocument();
  });

  it('로그인 상태에서 오답 노트에 문제 개수가 표시된다', () => {
    mockUseAuthStore.mockReturnValue(true);
    renderSidebar();

    expect(screen.getByText(/5개 문제 복습 필요/)).toBeInTheDocument();
  });

  it('오늘의 목표 카드가 표시된다', () => {
    renderSidebar();

    expect(screen.getByText('오늘의 목표')).toBeInTheDocument();
  });

  it('비로그인 상태에서 오늘의 목표에 로그인 링크가 표시된다', () => {
    mockUseAuthStore.mockReturnValue(false);
    renderSidebar();

    expect(screen.getByText(/로그인 후 진도를 저장해보세요/)).toBeInTheDocument();
  });

  it('로그인 상태에서 오늘의 목표가 표시된다', () => {
    mockUseAuthStore.mockReturnValue(true);
    renderSidebar();

    expect(screen.getByText(/10 XP 획득하기/)).toBeInTheDocument();
    expect(screen.getByText(/2개의 완벽한 레슨 끝내기/)).toBeInTheDocument();
    expect(screen.getByText(/20\/50/)).toBeInTheDocument();
    expect(screen.getByText(/2\/2/)).toBeInTheDocument();
  });

  it('로그인 상태에서 진행률 바가 표시된다', () => {
    mockUseAuthStore.mockReturnValue(true);
    renderSidebar();

    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBe(2); // 두 개의 목표
  });

  it('아이콘들이 올바르게 렌더링된다', () => {
    renderSidebar();

    expect(screen.getByTestId('icon-Frontend')).toBeInTheDocument();
    expect(screen.getByTestId('icon-Heart')).toBeInTheDocument();
    expect(screen.getByTestId('icon-Book')).toBeInTheDocument();
    expect(screen.getByTestId('icon-Fire')).toBeInTheDocument();
  });

  it('드롭다운 옵션을 선택했을 때 상태가 갱신되고 이동이 호출되어야 한다', async () => {
    renderSidebar();

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(await screen.findByRole('option', { name: '백엔드' }));

    expect(updateUIStateMock).toHaveBeenCalledWith({
      last_viewed: {
        field_slug: 'backend',
        unit_id: 0,
      },
    });
    expect(mockNavigate).toHaveBeenCalledWith(0);
  });
});
