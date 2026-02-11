import { useMemo, useState } from 'react';

import type { CorrectAnswerType, MatchingPair, QuizQuestion, QuizType } from '@/feat/quiz/types';
import { getMatchingPairs } from '@/features/quiz/utils/getMatchingPairs';
import type {
  AdminQuizDetailResponse,
  AdminQuizOption,
  AdminQuizUpdateRequest,
} from '@/services/adminService';
import { adminService } from '@/services/adminService';

type TabKey = 'edit' | 'preview';

const buildPairsKey = (pairs: MatchingPair[]): string =>
  [...pairs]
    .map(pair => ({ left: pair.left.trim(), right: pair.right.trim() }))
    .filter(pair => pair.left.length > 0 && pair.right.length > 0)
    .sort((a, b) =>
      a.left === b.left ? a.right.localeCompare(b.right) : a.left.localeCompare(b.left),
    )
    .map(pair => `${pair.left}|||${pair.right}`)
    .join('@@@');

const buildOptionsKey = (options: AdminQuizOption[]): string =>
  [...options]
    .map(option => ({ id: option.id.trim(), text: option.text.trim() }))
    .filter(option => option.id.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(option => `${option.id}|||${option.text}`)
    .join('@@@');

type Params = {
  quiz: AdminQuizDetailResponse | null;
  quizType: QuizType | null;
  quizQuestion: QuizQuestion | null;
  confirm: (args: { title: string; content: string; confirmText: string }) => Promise<boolean>;
  showToast: (message: string) => void;

  draftQuestion: string;
  draftExplanation: string;
  draftOptions: AdminQuizOption[];
  draftCode: string;
  draftLanguage: string;
  draftCorrectOptionId: string;
  draftMatchingPairs: MatchingPair[];

  correctAnswer: CorrectAnswerType | null;
  resetDraftFromQuiz: (quizDetail: AdminQuizDetailResponse) => void;
  setQuiz: (quiz: AdminQuizDetailResponse) => void;
};

export const useQuizSaveFlow = (params: Params) => {
  const {
    quiz,
    quizType,
    quizQuestion,
    confirm,
    showToast,
    draftQuestion,
    draftExplanation,
    draftOptions,
    draftCode,
    draftLanguage,
    draftCorrectOptionId,
    draftMatchingPairs,
    correctAnswer,
    resetDraftFromQuiz,
    setQuiz,
  } = params;

  const [isEditing, setIsEditing] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('edit');
  const [isSaving, setIsSaving] = useState(false);

  const effectiveCorrectAnswer: CorrectAnswerType | null = useMemo(() => {
    if (!quizType) return null;
    if (quizType === 'matching') {
      return isEditing && tab === 'preview' ? { pairs: draftMatchingPairs } : correctAnswer;
    }
    if (isEditing && tab === 'preview') return draftCorrectOptionId.trim();
    return correctAnswer;
  }, [correctAnswer, draftCorrectOptionId, draftMatchingPairs, isEditing, quizType, tab]);

  const previewQuestion: QuizQuestion | null = useMemo(() => {
    if (!quiz || !quizType) return null;

    const content: Record<string, unknown> = {
      ...(quiz.content as Record<string, unknown>),
      question: draftQuestion,
      options: draftOptions,
    };

    if (quizType === 'code') {
      content.code_metadata = { language: draftLanguage || 'javascript', snippet: draftCode };
    }

    return {
      id: quiz.id,
      type: quizType,
      content: content as unknown as QuizQuestion['content'],
    } as QuizQuestion;
  }, [draftCode, draftLanguage, draftOptions, draftQuestion, quiz, quizType]);

  const hasChanges = useMemo(() => {
    if (!quiz) return false;
    const baseQuestion = (quiz.content.question ?? '').trim();
    const nextQuestion = draftQuestion.trim();

    const baseExplanation = (quiz.explanation ?? '').trim();
    const nextExplanation = draftExplanation.trim();

    if (baseQuestion !== nextQuestion) return true;
    if (baseExplanation !== nextExplanation) return true;

    const baseOptionsKey = buildOptionsKey(quiz.content.options ?? []);
    const nextOptionsKey = buildOptionsKey(draftOptions);
    if (baseOptionsKey !== nextOptionsKey) return true;

    if (quizType !== 'matching') {
      const baseCorrectId = typeof correctAnswer === 'string' ? correctAnswer.trim() : '';
      const nextCorrectId = draftCorrectOptionId.trim();
      if (baseCorrectId !== nextCorrectId) return true;
    } else {
      const basePairsKey = buildPairsKey(getMatchingPairs(correctAnswer));
      const nextPairsKey = buildPairsKey(draftMatchingPairs);
      if (basePairsKey !== nextPairsKey) return true;
    }

    if (quizType === 'code') {
      const baseCode = (quiz.content.code_metadata?.snippet ?? '').trim();
      const nextCode = draftCode.trim();
      const baseLang = (quiz.content.code_metadata?.language ?? '').trim();
      const nextLang = draftLanguage.trim();
      if (baseCode !== nextCode) return true;
      if (baseLang !== nextLang) return true;
    }

    return false;
  }, [
    correctAnswer,
    draftCode,
    draftCorrectOptionId,
    draftExplanation,
    draftLanguage,
    draftMatchingPairs,
    draftOptions,
    draftQuestion,
    quiz,
    quizType,
  ]);

  const startEdit = () => {
    setIsEditing(true);
    setIsEditOpen(true);
  };

  const cancelEdit = async () => {
    if (!quiz) {
      setIsEditing(false);
      setIsEditOpen(false);
      setTab('edit');
      return;
    }

    if (hasChanges) {
      const shouldCancel = await confirm({
        title: '수정 취소',
        content: '변경사항이 있습니다. 취소하면 변경사항이 사라집니다. 계속할까요?',
        confirmText: '취소하기',
      });
      if (!shouldCancel) return;
    }

    resetDraftFromQuiz(quiz);
    setIsEditing(false);
    setIsEditOpen(false);
    setTab('edit');
  };

  const goEditTab = () => setTab('edit');

  const goPreviewTab = async () => {
    if (tab === 'preview') return;
    if (!hasChanges) {
      setTab('preview');
      return;
    }

    const shouldPreview = await confirm({
      title: '미리보기',
      content: '편집한 내용을 미리보기로 확인할까요?',
      confirmText: '확인',
    });

    if (shouldPreview) setTab('preview');
  };

  const save = async () => {
    if (!quiz) return;
    if (!quizType) {
      showToast('지원하지 않는 퀴즈 타입입니다.');
      return;
    }

    if (!hasChanges) {
      showToast('변경사항이 없습니다.');
      return;
    }

    if (tab !== 'preview') {
      const shouldMove = await confirm({
        title: '저장 전 확인',
        content: '저장 전에 미리보기 탭에서 변경사항을 확인할까요?',
        confirmText: '미리보기',
      });

      if (shouldMove) setTab('preview');
      return;
    }

    const isConfirmed = await confirm({
      title: '퀴즈 수정',
      content: '변경사항을 저장할까요?',
      confirmText: '저장',
    });

    if (!isConfirmed) return;

    const nextCorrectId = draftCorrectOptionId.trim();
    if (quizType !== 'matching' && !nextCorrectId) {
      showToast('정답을 선택해주세요.');
      return;
    }

    if (quizType === 'matching') {
      const leftCount =
        quizQuestion?.type === 'matching' ? quizQuestion.content.matching_metadata.left.length : 0;
      const rightCount =
        quizQuestion?.type === 'matching' ? quizQuestion.content.matching_metadata.right.length : 0;
      const pairs = draftMatchingPairs;
      const leftSet = new Set(pairs.map(pair => pair.left.trim()));
      const rightSet = new Set(pairs.map(pair => pair.right.trim()));

      if (leftCount === 0 || rightCount === 0) {
        showToast('매칭 선택지 정보를 찾을 수 없습니다.');
        return;
      }

      if (leftCount !== rightCount) {
        showToast('좌/우 선택지 개수가 동일하지 않습니다.');
        return;
      }

      if (
        pairs.length !== leftCount ||
        leftSet.size !== leftCount ||
        rightSet.size !== rightCount
      ) {
        showToast(`정답 쌍을 ${leftCount}개 모두 매칭해주세요.`);
        return;
      }
    }

    const payload: Partial<AdminQuizUpdateRequest> = {};

    const baseQuestion = (quiz.content.question ?? '').trim();
    const nextQuestion = draftQuestion.trim();
    if (baseQuestion !== nextQuestion) payload.question = nextQuestion;

    const baseExplanation = (quiz.explanation ?? '').trim();
    const nextExplanation = draftExplanation.trim();
    if (baseExplanation !== nextExplanation) {
      payload.explanation = nextExplanation.length > 0 ? nextExplanation : null;
    }

    const baseOptionsKey = buildOptionsKey(quiz.content.options ?? []);
    const nextOptionsKey = buildOptionsKey(draftOptions);
    if (baseOptionsKey !== nextOptionsKey) payload.options = draftOptions;

    if (quizType !== 'matching') {
      const baseCorrectId = typeof correctAnswer === 'string' ? correctAnswer.trim() : '';
      if (baseCorrectId !== nextCorrectId) payload.correctOptionId = nextCorrectId;
    } else {
      const basePairsKey = buildPairsKey(getMatchingPairs(correctAnswer));
      const nextPairsKey = buildPairsKey(draftMatchingPairs);
      if (basePairsKey !== nextPairsKey) {
        payload.correctPairs = draftMatchingPairs.map(pair => ({
          left: pair.left.trim(),
          right: pair.right.trim(),
        }));
      }
    }

    if (quizType === 'code') {
      const baseCode = (quiz.content.code_metadata?.snippet ?? '').trim();
      const nextCode = draftCode.trim();
      if (baseCode !== nextCode) payload.code = nextCode;

      const baseLang = (quiz.content.code_metadata?.language ?? '').trim();
      const nextLang = draftLanguage.trim();
      if (baseLang !== nextLang && nextLang.length > 0) payload.language = nextLang;
    }

    setIsSaving(true);
    try {
      const result = await adminService.updateQuiz(quiz.id, payload);
      if (!result.updated) {
        showToast('변경사항이 없어 저장하지 않았습니다.');
        return;
      }

      const refreshed = await adminService.getQuiz(quiz.id);
      setQuiz(refreshed);
      resetDraftFromQuiz(refreshed);
      setIsEditing(false);
      setIsEditOpen(false);
      setTab('edit');
      showToast('저장했습니다.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isEditing,
    isEditOpen,
    tab,
    isSaving,
    hasChanges,
    effectiveCorrectAnswer,
    previewQuestion,

    setIsEditOpen,
    startEdit,
    cancelEdit,
    goEditTab,
    goPreviewTab,
    save,
  };
};
