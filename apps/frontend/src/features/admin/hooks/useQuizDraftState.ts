import { useCallback, useEffect, useState } from 'react';

import type { MatchingPair } from '@/feat/quiz/types';
import { getMatchingPairs } from '@/features/quiz/utils/getMatchingPairs';
import type { AdminQuizDetailResponse, AdminQuizOption } from '@/services/adminService';

import { extractCorrectAnswer, normalizeAdminOptions, toQuizType } from '../utils/adminQuizUtils';

export type QuizDraftState = {
  draftQuestion: string;
  draftExplanation: string;
  draftOptions: AdminQuizOption[];
  draftCode: string;
  draftLanguage: string;
  draftCorrectOptionId: string;
  draftMatchingPairs: MatchingPair[];
};

export const useQuizDraftState = (quiz: AdminQuizDetailResponse | null) => {
  const [draftQuestion, setDraftQuestion] = useState('');
  const [draftExplanation, setDraftExplanation] = useState('');
  const [draftOptions, setDraftOptions] = useState<AdminQuizOption[]>([]);
  const [draftCode, setDraftCode] = useState('');
  const [draftLanguage, setDraftLanguage] = useState('');
  const [draftCorrectOptionId, setDraftCorrectOptionId] = useState('');
  const [draftMatchingPairs, setDraftMatchingPairs] = useState<MatchingPair[]>([]);

  const resetDraftFromQuiz = useCallback((quizDetail: AdminQuizDetailResponse) => {
    setDraftQuestion(quizDetail.content.question ?? '');
    setDraftExplanation(quizDetail.explanation ?? '');
    setDraftOptions(normalizeAdminOptions(quizDetail.content.options));
    setDraftCode(quizDetail.content.code_metadata?.snippet ?? '');
    setDraftLanguage(quizDetail.content.code_metadata?.language ?? '');

    const extracted = extractCorrectAnswer(toQuizType(quizDetail.type), quizDetail.answer);
    setDraftCorrectOptionId(typeof extracted === 'string' ? extracted : '');
    setDraftMatchingPairs(getMatchingPairs(extracted));
  }, []);

  useEffect(() => {
    if (!quiz) return;
    resetDraftFromQuiz(quiz);
  }, [quiz, resetDraftFromQuiz]);

  const handleChangeOptionText = useCallback((optionId: string, value: string) => {
    setDraftOptions(prev =>
      prev.map(option => (option.id === optionId ? { ...option, text: value } : option)),
    );
  }, []);

  return {
    draftQuestion,
    draftExplanation,
    draftOptions,
    draftCode,
    draftLanguage,
    draftCorrectOptionId,
    draftMatchingPairs,

    setDraftQuestion,
    setDraftExplanation,
    setDraftOptions,
    setDraftCode,
    setDraftLanguage,
    setDraftCorrectOptionId,
    setDraftMatchingPairs,
    handleChangeOptionText,
    resetDraftFromQuiz,
  };
};
