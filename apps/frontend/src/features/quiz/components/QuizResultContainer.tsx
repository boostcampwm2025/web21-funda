import { AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

import { PointEffect } from '@/feat/quiz/components/PointEffect';
import { QuizResultContent } from '@/feat/quiz/components/QuizResultContent';
import { Streak } from '@/feat/quiz/components/Streak';
import { formatDuration } from '@/feat/quiz/utils/formatDuration';

export type QuizResultState = {
  answeredQuizzes?: number;
  correctCount?: number;
  currentStreak: number;
  durationSeconds?: number;
  experience?: number;
  isFirstSolveToday: boolean;
  score?: number;
  totalQuizzes?: number | null;
  successRate?: number;
  xpGained?: number;
  durationMs?: number;
  guestStepId?: number;
};

export interface QuizResultContainerProps {
  resultState: QuizResultState | null;
  isLogin: boolean;
  /** path로 이동. auth/check로 보낼 때는 state.from에 원래 목적지 전달 */
  onNavigate: (path: string, state?: { from?: string }) => void;
  removeGuestStepAttempt: (guestStepId: number) => void;
  updateUIState: (patch: {
    current_quiz_step_id?: number;
    current_step_order_index?: number;
  }) => void;
  uiState: { current_quiz_step_id: number; current_step_order_index?: number };
}

export const QuizResultContainer = ({
  resultState,
  isLogin,
  onNavigate,
  removeGuestStepAttempt,
  updateUIState,
  uiState,
}: QuizResultContainerProps) => {
  const response = resultState ?? null;
  const guestStepId = response?.guestStepId;
  const xpValue = response?.experience ?? response?.xpGained;
  const durationMs =
    response?.durationMs ??
    (typeof response?.durationSeconds === 'number' ? response.durationSeconds * 1000 : null);
  const hasXP = typeof xpValue === 'number' && xpValue > 0;

  const resultData = {
    isFirstSolveToday: response?.isFirstSolveToday ?? false,
    currentStreak: response?.currentStreak ?? 1,
    xpGained: response?.xpGained ?? null,
    experience: response?.experience ?? null,
    successRate: response?.successRate ?? null,
    durationMs: formatDuration(durationMs),
  };

  const [showPointEffect, setShowPointEffect] = useState(true);
  const [showStreakAnimation, setShowStreakAnimation] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    if (typeof guestStepId === 'number' && !Number.isNaN(guestStepId)) {
      removeGuestStepAttempt(guestStepId);
    }
  }, [guestStepId, removeGuestStepAttempt]);

  useEffect(() => {
    if (!hasXP) setShowPointEffect(false);
    else {
      const timer = setTimeout(() => setShowPointEffect(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [hasXP]);

  useEffect(() => {
    if (!showStreakAnimation || !pendingPath) return;

    const displayTimer = setTimeout(() => {
      setIsExiting(true);
    }, 3000);

    const navigateTimer = setTimeout(() => {
      onNavigate(pendingPath);
    }, 3850);

    return () => {
      clearTimeout(displayTimer);
      clearTimeout(navigateTimer);
    };
  }, [showStreakAnimation, pendingPath, onNavigate]);

  const handleNavigation = (targetPath: string, shouldUpdateStep = false) => {
    if (!isLogin) {
      onNavigate('/auth/check', { from: targetPath });
      return;
    }

    if (shouldUpdateStep) {
      const nextStepId = uiState.current_quiz_step_id + 1;
      const nextOrderIndex =
        typeof uiState.current_step_order_index === 'number'
          ? uiState.current_step_order_index + 1
          : undefined;

      updateUIState({
        current_quiz_step_id: nextStepId,
        ...(nextOrderIndex !== undefined
          ? { current_step_order_index: nextOrderIndex }
          : undefined),
      });
    }

    if (resultData.isFirstSolveToday) {
      setPendingPath(targetPath);
      setShowStreakAnimation(true);
    } else {
      onNavigate(targetPath);
    }
  };

  return (
    <section aria-label="퀴즈 결과" aria-live="polite">
      <AnimatePresence mode="wait">
        {showPointEffect && hasXP ? (
          <PointEffect key="point-effect" points={xpValue!} />
        ) : showStreakAnimation && !isExiting ? (
          <Streak key="streak-animation" currentStreak={resultData.currentStreak} />
        ) : !showStreakAnimation ? (
          <QuizResultContent
            key="result-content"
            resultData={resultData}
            onNextNavigation={() => handleNavigation('/quiz', true)}
            onMainNavigation={() => handleNavigation('/learn')}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
};
