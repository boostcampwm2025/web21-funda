import type { CorrectAnswerType, QuizType } from '@/feat/quiz/types';
import type { AdminQuizOption } from '@/services/adminService';

const toCleanString = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value).trim();
  return null;
};

const toPlainObject = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const toQuizType = (value: string): QuizType | null => {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'mcq' ||
    normalized === 'ox' ||
    normalized === 'matching' ||
    normalized === 'code'
  ) {
    return normalized;
  }
  return null;
};

export const extractCorrectAnswer = (
  quizType: QuizType | null,
  answer: unknown,
): CorrectAnswerType | null => {
  if (!quizType) return null;

  const obj = toPlainObject(answer);
  if (!obj) return null;

  if (quizType === 'matching') {
    const rawPairs =
      obj.pairs ?? obj.correct_pairs ?? obj.matching ?? obj.value ?? obj.correctPairs ?? null;
    if (!Array.isArray(rawPairs)) return { pairs: null };
    const pairs = rawPairs
      .map(pair => {
        const pairObj = toPlainObject(pair);
        if (!pairObj) return null;
        const left = toCleanString(pairObj.left);
        const right = toCleanString(pairObj.right);
        if (left && right) return { left, right };
        return null;
      })
      .filter((p): p is { left: string; right: string } => p !== null);

    return { pairs: pairs.length > 0 ? pairs : null };
  }

  const optionId = toCleanString(obj.value ?? obj.correct_option_id ?? obj.option_id);
  return optionId;
};

export const normalizeAdminOptions = (
  options: AdminQuizOption[] | undefined,
): AdminQuizOption[] => {
  if (!options) return [];
  return options
    .map(option => ({
      id: option.id.trim(),
      text: option.text.trim(),
    }))
    .filter(option => option.id.length > 0);
};
