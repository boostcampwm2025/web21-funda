import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { QuizResultContainer } from '@/feat/quiz/components/QuizResultContainer';

vi.mock('@/feat/quiz/components/PointEffect', () => ({
  PointEffect: () => <div data-testid="point-effect" />,
}));

vi.mock('@/feat/quiz/components/Streak', () => ({
  Streak: () => <div data-testid="streak-animation" />,
}));

vi.mock('@/feat/quiz/components/QuizResultContent', () => ({
  QuizResultContent: ({
    onNextNavigation,
    onMainNavigation,
  }: {
    onNextNavigation?: () => void;
    onMainNavigation?: () => void;
  }) => (
    <div>
      <button type="button" onClick={onNextNavigation}>
        학습 계속하기
      </button>
      <button type="button" onClick={onMainNavigation}>
        메인 페이지로 이동하기
      </button>
    </div>
  ),
}));

describe('QuizResultContainer', () => {
  it('로그인 사용자가 학습 계속하기를 누르면 step id와 order index를 함께 증가시킨다', () => {
    const onNavigate = vi.fn();
    const removeGuestStepAttempt = vi.fn();
    const updateUIState = vi.fn();

    render(
      <QuizResultContainer
        resultState={{
          currentStreak: 3,
          isFirstSolveToday: false,
          experience: 0,
        }}
        isLogin
        onNavigate={onNavigate}
        removeGuestStepAttempt={removeGuestStepAttempt}
        updateUIState={updateUIState}
        uiState={{ current_quiz_step_id: 6, current_step_order_index: 6 }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '학습 계속하기' }));

    expect(updateUIState).toHaveBeenCalledWith({
      current_quiz_step_id: 7,
      current_step_order_index: 7,
    });
    expect(onNavigate).toHaveBeenCalledWith('/quiz');
  });

  it('비로그인 사용자가 학습 계속하기를 누르면 auth/check로 이동한다', () => {
    const onNavigate = vi.fn();
    const removeGuestStepAttempt = vi.fn();
    const updateUIState = vi.fn();

    render(
      <QuizResultContainer
        resultState={{
          currentStreak: 2,
          isFirstSolveToday: false,
          experience: 0,
        }}
        isLogin={false}
        onNavigate={onNavigate}
        removeGuestStepAttempt={removeGuestStepAttempt}
        updateUIState={updateUIState}
        uiState={{ current_quiz_step_id: 6, current_step_order_index: 6 }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '학습 계속하기' }));

    expect(onNavigate).toHaveBeenCalledWith('/auth/check', { from: '/quiz' });
    expect(updateUIState).not.toHaveBeenCalled();
  });
});
