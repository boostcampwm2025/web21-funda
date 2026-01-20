import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import correctSound from '@/assets/audio/correct.mp3';
import wrongSound from '@/assets/audio/wrong.mp3';
import { QuizContainer } from '@/feat/quiz/components/QuizContainer';
import { QuizLoadErrorView } from '@/feat/quiz/components/QuizLoadErrorView';
import { QuizLoadingView } from '@/feat/quiz/components/QuizLoadingView';
import type {
  AnswerType,
  CorrectAnswerType,
  MatchingPair,
  QuestionStatus,
  QuizQuestion,
} from '@/feat/quiz/types';
import { useSound } from '@/hooks/useSound';
import { useStorage } from '@/hooks/useStorage';
import { authService } from '@/services/authService';
import { quizService, type QuizSubmissionRequest } from '@/services/quizService';
import { useAuthStore, useIsAuthReady } from '@/store/authStore';
/**
 * 퀴즈 풀이 페이지 컴포넌트
 * 퀴즈 데이터 로딩, 답변 상태 관리, 정답 확인 및 페이지 이동 로직을 담당합니다.
 * * @returns {JSX.Element | null} 퀴즈 화면 레이아웃
 */
export const Quiz = () => {
  const {
    uiState,
    addStepHistory,
    updateLastSolvedUnit,
    startGuestStepAttempt,
    addGuestStepAnswer,
    finalizeGuestStepAttempt,
    getGuestStepAttempt,
  } = useStorage();
  const isLoggedIn = useAuthStore(state => state.isLoggedIn);
  const isAuthReady = useIsAuthReady();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [stepAttemptId, setStepAttemptId] = useState<number | null>(null);
  const navigate = useNavigate();

  /** 불러온 문제 배열 */
  const [quizzes, setQuizzes] = useState<QuizQuestion[]>([]);

  /** 각 문제별 정답 및 해설 저장 */
  const [quizSolutions, setQuizSolutions] = useState<
    Array<{ correctAnswer: CorrectAnswerType | null; explanation: string } | null>
  >([]);

  /** 사용자가 입력한 답변 배열 */
  const [selectedAnswers, setSelectedAnswers] = useState<AnswerType[]>([]);

  /** 각 문제별 풀이 완료 여부 상태 배열 */
  const [questionStatuses, setQuestionStatuses] = useState<QuestionStatus[]>([]);

  /** 문제 하나라도 풀었을 때 */
  const hasProgress = questionStatuses.some(status => status !== 'idle');

  /** 현재 풀이 중인 퀴즈의 인덱스 */
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);

  /** 현재 활성화된 퀴즈 객체 */
  const currentQuiz = quizzes[currentQuizIndex];

  /** 현재 화면에 표시된 퀴즈의 진행 상태 */
  const [currentQuestionStatus, setCurrentQuestionStatus] = useState<QuestionStatus>('idle');

  /** 현재 활성화된 퀴즈에 대해 사용자가 입력한 답변 */
  const currentAnswer = selectedAnswers[currentQuizIndex];

  /** 현재 진행할 스텝 ID */
  const step_id = uiState.current_quiz_step_id;

  const { playSound } = useSound();
  const baseScorePerQuiz = 3;

  type GuestStepResult = {
    score: number;
    experience: number;
    correctCount: number;
    totalQuizzes: number;
    answeredQuizzes: number;
    successRate: number;
    durationSeconds: number;
    firstSolve: boolean;
  };

  /**
   * 비로그인 사용자 결과 데이터를 계산한다.
   *
   * @param stepId 스텝 ID
   * @returns 결과 데이터(기록이 없으면 null)
   */
  const buildGuestResult = useCallback(
    (stepId: number): GuestStepResult | null => {
      const guestAttempt = getGuestStepAttempt(stepId);

      if (!guestAttempt) {
        return null;
      }

      const totalQuizzes = quizzes.length;
      const answeredQuizzes = guestAttempt.answers.length;
      const correctCount = guestAttempt.answers.filter(answer => answer.is_correct).length;
      const score = answeredQuizzes * baseScorePerQuiz;
      const successRate = totalQuizzes === 0 ? 0 : (correctCount / totalQuizzes) * 100;
      const finishedAt = guestAttempt.finished_at ?? Date.now();
      const durationSeconds = Math.max(
        0,
        Math.floor((finishedAt - guestAttempt.started_at) / 1000),
      );

      return {
        score,
        experience: score,
        correctCount,
        totalQuizzes,
        answeredQuizzes,
        successRate,
        durationSeconds,
        firstSolve: false,
      };
    },
    [baseScorePerQuiz, getGuestStepAttempt, quizzes.length],
  );

  /**
   * 퀴즈 데이터 가져오기
   */

  const fetchQuizzes = async () => {
    if (!step_id) {
      return;
    }

    if (!isAuthReady) {
      return;
    }
    setIsLoading(true);
    setLoadError(false);
    setStepAttemptId(null);

    /** 퀴즈 시작 정보 저장 */
    if (isLoggedIn) {
      try {
        const startResult = await quizService.startStep(step_id);
        setStepAttemptId(startResult.stepAttemptId);
      } catch {
        setLoadError(true);
        setIsLoading(false);
        return;
      }
    } else {
      startGuestStepAttempt(step_id);
    }

    try {
      // 완전히 준비된 캐시 확인
      const cachedProcessedData = sessionStorage.getItem(`processed_quizzes_${step_id}`);

      if (cachedProcessedData) {
        // 미리 가공된 데이터 직접 사용
        const { quizzes, selectedAnswers, questionStatuses, quizSolutions } =
          JSON.parse(cachedProcessedData);

        setQuizzes(quizzes);
        setSelectedAnswers(selectedAnswers);
        setQuestionStatuses(questionStatuses);
        setQuizSolutions(quizSolutions);

        sessionStorage.removeItem(`processed_quizzes_${step_id}`);
        setIsLoading(false);
        return;
      }

      // 캐시 없으면 서버에서 가져오기
      const quizzesData = await quizService.getQuizzesByStep(step_id);

      setQuizzes(quizzesData);
      setSelectedAnswers(new Array(quizzesData.length).fill(null));
      setQuestionStatuses(new Array(quizzesData.length).fill('idle'));
      setQuizSolutions(new Array(quizzesData.length).fill(null));
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  /** 페이지 진입 시 초기 세팅 */
  useEffect(() => {
    fetchQuizzes();
  }, [step_id, isLoggedIn, isAuthReady]);

  /** 새로고침 시, 한 문제라도 제출했다면 경고 */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasProgress) return;

      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasProgress]);

  // 정답 확인 버튼 활성화 여부 계산
  const isCheckDisabled = useMemo(() => {
    if (!currentQuiz || currentQuestionStatus !== 'idle' || currentAnswer === null) return true;

    // 매칭형: metadata의 left 개수와 현재 pairs의 개수가 정확히 일치해야 함
    if (currentQuiz.type === 'matching') {
      const matchingAnswer = currentAnswer as { pairs: MatchingPair[] };
      const totalRequired = currentQuiz.content.matching_metadata?.left?.length;
      return totalRequired !== (matchingAnswer.pairs?.length || 0);
    }

    // 일반형(MCQ, OX, CODE): 데이터가 존재하기만 하면 활성화
    return false;
  }, [currentQuiz, currentAnswer, currentQuestionStatus]);

  /**
   * 사용자의 답변 선택 시 실행되는 핸들러
   * * @param answer 선택한 답변
   */
  const handleAnswerChange = useCallback(
    (answer: AnswerType) => {
      if (currentQuestionStatus !== 'idle') return;
      setSelectedAnswers(prev => {
        const newAnswers = [...prev];
        newAnswers[currentQuizIndex] = answer;
        return newAnswers;
      });
    },
    [currentQuizIndex, currentQuestionStatus],
  );

  /**
   * 정답 확인 버튼 클릭 시 실행되는 핸들러
   * 서버 통신 후 상태를 'checked'로 변경합니다.
   */
  const handleCheckAnswer = useCallback(async () => {
    if (!currentQuiz || !currentAnswer) return;
    if (isLoggedIn && stepAttemptId === null) {
      setLoadError(true);
      return;
    }
    setCurrentQuestionStatus('checking');

    try {
      const payload: QuizSubmissionRequest =
        currentQuiz.type === 'matching'
          ? {
              quiz_id: currentQuiz.id,
              type: 'MATCHING' as const,
              selection: { pairs: (currentAnswer as { pairs: MatchingPair[] }).pairs },
            }
          : {
              quiz_id: currentQuiz.id,
              type: currentQuiz.type.toUpperCase() as 'MCQ' | 'OX' | 'CODE',
              selection: { option_id: currentAnswer as string },
            };

      if (isLoggedIn && stepAttemptId !== null) {
        payload.step_attempt_id = stepAttemptId;
      }

      const result = await quizService.submitQuiz(currentQuiz.id, payload);
      const correctAnswer: CorrectAnswerType | null = result.solution?.correct_pairs
        ? { pairs: result.solution.correct_pairs }
        : (result.solution?.correct_option_id ?? null);

      // 정답/오답 효과음 재생
      if (result.is_correct) playSound({ src: correctSound, currentTime: 0.05 });
      else playSound({ src: wrongSound, currentTime: 0.05 });

      setQuizSolutions(prev => {
        const newSolutions = [...prev];
        newSolutions[currentQuizIndex] = {
          correctAnswer,
          explanation: result.solution?.explanation ?? '',
        };
        return newSolutions;
      });
      setCurrentQuestionStatus('checked');
      setQuestionStatuses(prev => {
        const newStatuses = [...prev];
        newStatuses[currentQuizIndex] = 'checked';
        return newStatuses;
      });

      if (!isLoggedIn) {
        addGuestStepAnswer(step_id, {
          quiz_id: currentQuiz.id,
          is_correct: result.is_correct,
        });
      }
    } catch {
      // 에러 발생 시에도 다음 문제로 넘어갈 수 있도록 함
      setCurrentQuestionStatus('checked');
    }
  }, [
    addGuestStepAnswer,
    currentAnswer,
    currentQuiz,
    currentQuizIndex,
    isLoggedIn,
    playSound,
    step_id,
    stepAttemptId,
  ]);

  /** 마지막 문제 여부 */
  const isLastQuestion = currentQuizIndex === quizzes.length - 1;

  /**
   * 다음 문제로 이동하거나 결과 페이지로 이동하는 핸들러
   */
  const handleNextQuestion = useCallback(async () => {
    if (!currentQuiz) return;
    if (isLastQuestion) {
      try {
        if (isLoggedIn) {
          if (stepAttemptId === null) {
            navigate('/quiz/error');
            return;
          }

          const result = await quizService.completeStep(step_id, {
            stepAttemptId,
          });
          const updatedUser = await authService.getCurrentUser();
          if (updatedUser) {
            useAuthStore.getState().actions.setUser(updatedUser);
          }
          navigate('/quiz/result', {
            state: result,
          });
        } else {
          finalizeGuestStepAttempt(step_id);
          const result = buildGuestResult(step_id);

          if (!result) {
            navigate('/quiz/error');
            return;
          }

          navigate('/quiz/result', {
            state: {
              ...result,
              guestStepId: step_id,
            },
          });
        }

        addStepHistory(step_id);

        updateLastSolvedUnit(uiState.last_viewed.field_slug, uiState.last_viewed.unit_id);
      } catch {
        navigate('/quiz/error');
      }
    } else {
      const nextIndex = currentQuizIndex + 1;
      setCurrentQuizIndex(nextIndex);
      // 다음 문제가 이미 풀었던 문제라면 해당 상태를 유지, 아니면 'idle'
      setCurrentQuestionStatus(questionStatuses[nextIndex] || 'idle');
    }
  }, [
    isLastQuestion,
    navigate,
    questionStatuses,
    currentQuizIndex,
    addStepHistory,
    currentQuiz,
    step_id,
    updateLastSolvedUnit,
    isLoggedIn,
    finalizeGuestStepAttempt,
    buildGuestResult,
    stepAttemptId,
  ]);

  // 조건부 렌더링은 모든 hooks 호출 후에 배치
  if (isLoading) return <QuizLoadingView />;
  if (loadError) return <QuizLoadErrorView onRetry={fetchQuizzes} />;

  return (
    <QuizContainer
      quizzes={quizzes}
      currentQuizIndex={currentQuizIndex}
      currentQuestionStatus={currentQuestionStatus}
      selectedAnswers={selectedAnswers}
      quizSolutions={quizSolutions}
      questionStatuses={questionStatuses}
      isCheckDisabled={isCheckDisabled}
      isLastQuestion={isLastQuestion}
      handleAnswerChange={handleAnswerChange}
      handleCheckAnswer={handleCheckAnswer}
      handleNextQuestion={handleNextQuestion}
    />
  );
};
