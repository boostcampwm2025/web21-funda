import type { Dispatch, SetStateAction } from 'react';
import { useMemo, useState } from 'react';

import type { CorrectAnswerType, MatchingPair, QuizQuestion, QuizType } from '@/feat/quiz/types';
import type { AdminQuizDetailResponse, AdminQuizOption } from '@/services/adminService';
import { reportService } from '@/services/reportService';
import type { ReportResponse } from '@/services/reportService';
import { useModal } from '@/store/modalStore';
import { useToast } from '@/store/toastStore';

import { extractCorrectAnswer, toQuizType } from '../utils/adminQuizUtils';

import { useQuizDraftState } from './useQuizDraftState';
import { useQuizSaveFlow } from './useQuizSaveFlow';
import { useReportQuizData } from './useReportQuizData';

type Params = {
  reportId: number | null;
};

export type AdminReportDetailModel = {
  data: {
    loading: boolean;
    error: string | null;
    report: ReportResponse | null;
    quiz: AdminQuizDetailResponse | null;
    quizType: QuizType | null;
    quizQuestion: QuizQuestion | null;
    correctAnswer: CorrectAnswerType | null;
    effectiveCorrectAnswer: CorrectAnswerType | null;
    previewQuestion: QuizQuestion | null;
  };
  ui: {
    isEditing: boolean;
    isQuizOpen: boolean;
    isEditOpen: boolean;
    isReportOpen: boolean;
    tab: 'edit' | 'preview';
    isSaving: boolean;
    isUpdatingReportStatus: boolean;
    hasChanges: boolean;
  };
  draft: {
    draftQuestion: string;
    draftExplanation: string;
    draftOptions: AdminQuizOption[];
    draftCode: string;
    draftLanguage: string;
    draftCorrectOptionId: string;
    draftMatchingPairs: MatchingPair[];
  };
  actions: {
    setIsQuizOpen: Dispatch<SetStateAction<boolean>>;
    setIsEditOpen: Dispatch<SetStateAction<boolean>>;
    setIsReportOpen: Dispatch<SetStateAction<boolean>>;
    setDraftQuestion: Dispatch<SetStateAction<string>>;
    setDraftExplanation: Dispatch<SetStateAction<string>>;
    setDraftOptions: Dispatch<SetStateAction<AdminQuizOption[]>>;
    setDraftCode: Dispatch<SetStateAction<string>>;
    setDraftLanguage: Dispatch<SetStateAction<string>>;
    setDraftCorrectOptionId: Dispatch<SetStateAction<string>>;
    setDraftMatchingPairs: Dispatch<SetStateAction<MatchingPair[]>>;
    handleChangeOptionText: (optionId: string, value: string) => void;
    startEdit: () => void;
    cancelEdit: () => Promise<void>;
    goEditTab: () => void;
    goPreviewTab: () => Promise<void>;
    save: () => Promise<void>;
    toggleReportStatus: () => Promise<void>;
  };
};

export const useAdminReportDetail = ({ reportId }: Params): AdminReportDetailModel => {
  const { confirm } = useModal();
  const { showToast } = useToast();

  const [isQuizOpen, setIsQuizOpen] = useState(true);
  const [isReportOpen, setIsReportOpen] = useState(true);
  const [isUpdatingReportStatus, setIsUpdatingReportStatus] = useState(false);

  const { loading, error, report, setReport, quiz, setQuiz } = useReportQuizData({ reportId });

  const quizType = useMemo(() => (quiz ? toQuizType(quiz.type) : null), [quiz]);

  const quizQuestion: QuizQuestion | null = useMemo(() => {
    if (!quiz) return null;
    const type = toQuizType(quiz.type);
    if (!type) return null;
    return {
      id: quiz.id,
      type,
      content: quiz.content as QuizQuestion['content'],
    } as QuizQuestion;
  }, [quiz]);

  const correctAnswer = useMemo(
    () => extractCorrectAnswer(quizType, quiz?.answer),
    [quiz?.answer, quizType],
  );

  const draft = useQuizDraftState(quiz);

  const saveFlow = useQuizSaveFlow({
    quiz,
    quizType,
    quizQuestion,
    confirm,
    showToast,
    correctAnswer,
    resetDraftFromQuiz: draft.resetDraftFromQuiz,
    setQuiz,
    draftQuestion: draft.draftQuestion,
    draftExplanation: draft.draftExplanation,
    draftOptions: draft.draftOptions,
    draftCode: draft.draftCode,
    draftLanguage: draft.draftLanguage,
    draftCorrectOptionId: draft.draftCorrectOptionId,
    draftMatchingPairs: draft.draftMatchingPairs,
  });

  const toggleReportStatus = async () => {
    if (!report) {
      return;
    }

    const nextStatus = report.status === 'resolved' ? 'pending' : 'resolved';

    setIsUpdatingReportStatus(true);
    try {
      const updatedReport = await reportService.updateReportStatus(report.id, nextStatus);
      setReport(updatedReport);
      showToast(
        nextStatus === 'resolved'
          ? '신고를 처리 완료로 변경했습니다.'
          : '신고를 처리 대기로 변경했습니다.',
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : '신고 상태를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.',
      );
    } finally {
      setIsUpdatingReportStatus(false);
    }
  };

  return {
    data: {
      loading,
      error,
      report,
      quiz,
      quizType,
      quizQuestion,
      correctAnswer,
      effectiveCorrectAnswer: saveFlow.effectiveCorrectAnswer,
      previewQuestion: saveFlow.previewQuestion,
    },
    ui: {
      isEditing: saveFlow.isEditing,
      isQuizOpen,
      isEditOpen: saveFlow.isEditOpen,
      isReportOpen,
      tab: saveFlow.tab,
      isSaving: saveFlow.isSaving,
      isUpdatingReportStatus,
      hasChanges: saveFlow.hasChanges,
    },
    draft: {
      draftQuestion: draft.draftQuestion,
      draftExplanation: draft.draftExplanation,
      draftOptions: draft.draftOptions,
      draftCode: draft.draftCode,
      draftLanguage: draft.draftLanguage,
      draftCorrectOptionId: draft.draftCorrectOptionId,
      draftMatchingPairs: draft.draftMatchingPairs,
    },
    actions: {
      setIsQuizOpen,
      setIsEditOpen: saveFlow.setIsEditOpen,
      setIsReportOpen,
      setDraftQuestion: draft.setDraftQuestion,
      setDraftExplanation: draft.setDraftExplanation,
      setDraftOptions: draft.setDraftOptions,
      setDraftCode: draft.setDraftCode,
      setDraftLanguage: draft.setDraftLanguage,
      setDraftCorrectOptionId: draft.setDraftCorrectOptionId,
      setDraftMatchingPairs: draft.setDraftMatchingPairs,
      handleChangeOptionText: draft.handleChangeOptionText,
      startEdit: saveFlow.startEdit,
      cancelEdit: saveFlow.cancelEdit,
      goEditTab: saveFlow.goEditTab,
      goPreviewTab: saveFlow.goPreviewTab,
      save: saveFlow.save,
      toggleReportStatus,
    },
  };
};
