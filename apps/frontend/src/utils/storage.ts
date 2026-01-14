//각 필드 별 마지막으로 푼 유닛
export interface LastSolvedUnit {
  field_slug: string;
  unit_id: number;
}

// 학습 진행 데이터
export interface Progress {
  heart: number;
  last_solved_unit_id: LastSolvedUnit[];
}
export interface StepHistory {
  solved_step_history: number[];
}
// 메인 페이지 UI 상태 데이터
export interface UIState {
  last_viewed: {
    field_slug: string;
    unit_id: number;
  };
  current_quiz_step_id: number;
}

// 스토리지 전체 데이터
export interface QuizStorageData {
  progress: Progress;
  ui_state: UIState;
  solved_step_history: number[];
  // step_id별 퀴즈 시작 시간 (step_id: timestamp)
  quiz_started_at: Record<number, number>;
  has_session_hint: boolean;
}

const STORAGE_KEY = 'QUIZ_V1';

// 스토리지 기본 값 데이터 설정
const DEFAULT_STATE: QuizStorageData = {
  progress: { heart: 5, last_solved_unit_id: [] },
  solved_step_history: [],
  ui_state: {
    last_viewed: { field_slug: 'FE', unit_id: 1 },
    current_quiz_step_id: 0,
  },
  quiz_started_at: {},
  has_session_hint: false,
};

// 사용할 스토리지 함수
export const storageUtil = {
  get: (): QuizStorageData => {
    const item = localStorage.getItem(STORAGE_KEY);
    if (!item) return DEFAULT_STATE;

    try {
      const parsed = JSON.parse(item);
      if (!parsed.quiz_started_at) {
        parsed.quiz_started_at = {};
        storageUtil.set(parsed);
      }
      return parsed;
    } catch (error) {
      // 에러를 로깅
      console.error('파싱 중 오류 발생:', error);

      // 계속 에러가 나오지않게 초기화
      storageUtil.set(DEFAULT_STATE);

      // 서비스가 멈추지 않도록 기본값을 반환
      return DEFAULT_STATE;
    }
  },

  set: (data: QuizStorageData): void => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      // 용량 초과등 예외 상황 대비
      console.error('로컬 스토리지 저장 중 오류 발생:', error);
    }
  },

  // key는 progess 또는 ui_state 중 하나만 가능하고 value는 해당 객체의 부분 업데이트를 위한 값
  // partial만 넣어서 사용하도록 제네릭 타입 활용
  update: <K extends keyof QuizStorageData>(
    key: K,
    value: Partial<QuizStorageData[K]>,
  ): QuizStorageData => {
    const current = storageUtil.get();
    const updated = {
      ...current,
      [key]: { ...(current[key] as object), ...value },
    };
    storageUtil.set(updated);
    return updated;
  },
  addStepHistory: (stepId: number): QuizStorageData => {
    const current = storageUtil.get();

    // 기존 배열을 Set으로 변환 (중복 제거)
    const historySet = new Set(current.solved_step_history);

    // 새로운 stepId 추가
    historySet.add(stepId);

    // 다시 배열로 변환하여 업데이트
    const updated = {
      ...current,
      solved_step_history: Array.from(historySet),
    };
    storageUtil.set(updated);
    return updated;
  },
  /**
   * 특정 필드의 마지막 완료 유닛 업데이트
   * @example storageUtil.updateLastSolvedUnit('FE', 3)
   */
  updateLastSolvedUnit: (fieldSlug: string, unitId: number): QuizStorageData => {
    const current = storageUtil.get();
    const lastSolvedList = [...current.progress.last_solved_unit_id];

    // 1. 해당 필드가 이미 있는지 확인
    const index = lastSolvedList.findIndex(item => item.field_slug === fieldSlug);

    if (index > -1) {
      // 2. 이미 있다면 해당 필드의 unit_id 업데이트
      lastSolvedList[index] = { field_slug: fieldSlug, unit_id: unitId };
    } else {
      // 3. 없다면 새로 추가
      lastSolvedList.push({ field_slug: fieldSlug, unit_id: unitId });
    }

    return storageUtil.update('progress', {
      last_solved_unit_id: lastSolvedList,
    });
  },

  /**
   * 특정 step의 퀴즈 시작 시간 설정 (이미 있으면 업데이트하지 않음)
   * @param stepId step ID
   * @param timestamp 시작 시간 (기본값: 현재 시간)
   * @returns 업데이트된 스토리지 데이터
   */
  setQuizStartedAt: (stepId: number, timestamp?: number): QuizStorageData => {
    const current = storageUtil.get();
    const quizStartedAt = { ...current.quiz_started_at };

    // 이미 시작 시간이 있으면 업데이트하지 않음
    if (quizStartedAt[stepId]) {
      return current;
    }

    // 없으면 현재 시간으로 설정
    quizStartedAt[stepId] = timestamp ?? Date.now();

    return storageUtil.update('quiz_started_at', quizStartedAt);
  },

  /**
   * 특정 step의 퀴즈 시작 시간 가져오기
   * @param stepId step ID
   * @returns 시작 시간 또는 null
   */
  getQuizStartedAt: (stepId: number): number | null => {
    const current = storageUtil.get();
    return current.quiz_started_at[stepId] ?? null;
  },

  setSessionHint: (hasSession: boolean): QuizStorageData => {
    const current = storageUtil.get();
    const updated = { ...current, has_session_hint: hasSession };
    storageUtil.set(updated);
    return updated;
  },
};
