import type { CorrectAnswerType, MatchingPair } from '@/feat/quiz/types';

export const getMatchingPairs = (answer: CorrectAnswerType | null): MatchingPair[] => {
  if (!answer || typeof answer !== 'object' || !('pairs' in answer)) return [];
  const pairs = (answer as { pairs: MatchingPair[] | null }).pairs;
  return Array.isArray(pairs) ? pairs : [];
};
