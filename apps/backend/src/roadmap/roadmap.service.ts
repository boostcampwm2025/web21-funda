import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CodeFormatter } from '../common/utils/code-formatter';
import { SolveLog, StepAttemptStatus, UserStepAttempt, UserStepStatus } from '../progress/entities';

import type { FieldListResponse } from './dto/field-list.dto';
import type { FieldRoadmapResponse } from './dto/field-roadmap.dto';
import type { FieldUnitsResponse, StepSummary } from './dto/field-units.dto';
import type { FirstUnitResponse, UnitSummary } from './dto/first-unit.dto';
import type { QuizContent, QuizResponse } from './dto/quiz-list.dto';
import type {
  MatchingPair,
  QuizSubmissionRequest,
  QuizSubmissionResponse,
} from './dto/quiz-submission.dto';
import { Field, Quiz, Step } from './entities';

@Injectable()
export class RoadmapService {
  // TODO(임시): DB에 없는 체크포인트/플레이스홀더 스텝을 음수 ID로 생성한다.
  private checkpointIdSeed = -1;

  constructor(
    @InjectRepository(Field)
    private readonly fieldRepository: Repository<Field>,
    @InjectRepository(Quiz)
    private readonly quizRepository: Repository<Quiz>,
    @InjectRepository(Step)
    private readonly stepRepository: Repository<Step>,
    private readonly codeFormatter: CodeFormatter,
    @InjectRepository(SolveLog)
    private readonly solveLogRepository: Repository<SolveLog>,
    @InjectRepository(UserStepAttempt)
    private readonly stepAttemptRepository: Repository<UserStepAttempt>,
    @InjectRepository(UserStepStatus)
    private readonly stepStatusRepository: Repository<UserStepStatus>,
  ) {}

  /**
   * 분야 목록을 조회한다.
   * @returns 분야 리스트
   */
  async getFields(): Promise<FieldListResponse> {
    const fields = await this.fieldRepository.find({
      select: ['slug', 'name', 'description'],
      order: { id: 'ASC' },
    });

    return {
      fields: fields.map(field => ({
        slug: field.slug,
        name: field.name,
        description: field.description ?? null,
        icon: this.getFieldIconBySlug(field.slug),
      })),
    };
  }

  /**
   * 필드 슬러그 기준으로 유닛/스텝과 퀴즈 개수를 조회한다.
   * @param fieldSlug 필드 슬러그
   * @param userId 로그인 사용자 ID(없으면 null)
   * @returns 필드와 유닛/스텝 정보
   */
  async getUnitsByFieldSlug(fieldSlug: string, userId: number | null): Promise<FieldUnitsResponse> {
    const field = await this.fieldRepository.findOne({
      where: { slug: fieldSlug },
      relations: { units: { steps: true } }, // 유닛과 스텝까지 함께 로딩
    });

    if (!field) {
      throw new NotFoundException('Field not found.'); // 존재하지 않으면 404
    }

    const units = field.units ?? [];
    const steps = units.flatMap(unit => unit.steps ?? []);
    const stepIds = steps.map(step => step.id);
    const uniqueStepIds = Array.from(new Set(stepIds));
    const quizCountByStepId = await this.getQuizCountByStepId(uniqueStepIds);
    const completedStepIdSet = await this.getCompletedStepIdSet(uniqueStepIds, userId);

    return this.buildFieldUnitsResponse(field, units, quizCountByStepId, completedStepIdSet);
  }

  /**
   * 필드 슬러그 기준으로 로드맵(유닛 리스트)을 조회한다.
   * @param fieldSlug 필드 슬러그
   * @returns 필드와 유닛 목록
   */
  async getRoadmapByFieldSlug(
    fieldSlug: string,
    userId: number | null,
  ): Promise<FieldRoadmapResponse> {
    const field = await this.fieldRepository
      .createQueryBuilder('field')
      .leftJoinAndSelect('field.units', 'unit')
      .leftJoinAndSelect('unit.steps', 'step')
      .where('field.slug = :slug', { slug: fieldSlug })
      .orderBy('unit.orderIndex', 'ASC')
      .getOne();

    if (!field) {
      throw new NotFoundException('Field not found.');
    }

    const units = field.units ?? [];

    const calculatedUnits = await Promise.all(
      units.map(async unit => {
        const totalSteps = unit.steps?.length || 0;
        const userSteps = await this.getUserStepsByUnit(unit.id, userId);
        const completedSteps = userSteps.filter(step => step.isCompleted);
        const progress = Math.round((completedSteps.length / (totalSteps + 2)) * 100) || 0; // +2는 체크포인트 고려 (DB에 없어서 +2를 추가)
        const successRateArray = userSteps.map(step => step.successRate || 0);
        const successRate =
          Math.round(
            successRateArray.reduce((acc, cur) => acc + cur, 0) / successRateArray.length,
          ) || 0;

        return {
          id: unit.id,
          title: unit.title,
          orderIndex: unit.orderIndex,
          progress,
          successRate,
        };
      }),
    );

    return {
      field: {
        name: field.name,
        slug: field.slug,
      },
      units: calculatedUnits,
    };
  }

  private async getUserStepsByUnit(
    unitId: number,
    userId: number | null,
  ): Promise<UserStepStatus[]> {
    if (userId === null || userId === undefined) {
      return [];
    }

    const userSteps = await this.stepStatusRepository.find({
      where: { userId, step: { unit: { id: unitId } } },
      relations: { step: true },
    });

    return userSteps;
  }

  /**
   * 필드의 첫 번째 유닛을 조회한다.
   * @param fieldSlug 필드 슬러그
   * @returns 필드 정보와 첫 유닛
   */
  async getFirstUnitByFieldSlug(fieldSlug: string): Promise<FirstUnitResponse> {
    const field = await this.fieldRepository
      .createQueryBuilder('field')
      .leftJoinAndSelect('field.units', 'unit')
      .leftJoinAndSelect('unit.steps', 'step')
      .where('field.slug = :slug', { slug: fieldSlug })
      .orderBy('unit.orderIndex', 'ASC')
      .getOne();

    if (!field) {
      throw new NotFoundException('Field not found.');
    }

    const firstUnit = this.sortByOrderIndex(field.units ?? [])[0] ?? null;
    const steps = firstUnit?.steps ?? [];
    const quizCountByStepId = await this.getQuizCountByStepId(steps.map(step => step.id));

    let unitSummary: UnitSummary | null = null;
    if (firstUnit) {
      unitSummary = {
        id: firstUnit.id,
        title: firstUnit.title,
        orderIndex: firstUnit.orderIndex,
        steps: this.buildUnitStepsWithCheckpoints(steps, quizCountByStepId),
      };
    }

    return {
      field: {
        name: field.name,
        slug: field.slug,
      },
      unit: unitSummary,
    };
  }

  /**
   * 스텝 ID 기준으로 퀴즈 목록을 조회한다 (랜덤 셔플 후 limit개 반환).
   * @param stepId 스텝 ID
   * @param limit 반환할 퀴즈 개수 (기본값: 10)
   * @returns 퀴즈 목록
   */
  async getQuizzesByStepId(stepId: number, limit: number = 10): Promise<QuizResponse[]> {
    const step = await this.stepRepository.findOne({
      where: { id: stepId },
      select: { id: true },
    });

    if (!step) {
      throw new NotFoundException('Step not found.'); // 스텝이 없으면 404
    }

    const quizzes = await this.quizRepository.find({
      where: { step: { id: stepId } },
      order: { id: 'ASC' },
    });

    // 모든 퀴즈를 셔플
    const shuffledQuizzes = this.shuffleArray(quizzes);

    // limit개만 선택
    const limitedQuizzes = shuffledQuizzes.slice(0, limit);

    return Promise.all(limitedQuizzes.map(quiz => this.toQuizResponse(quiz)));
  }

  /**
   * 퀴즈 정답 제출을 검증한다.
   * @param quizId 퀴즈 ID
   * @param payload 사용자가 제출한 답안
   * @returns 채점 결과와 정답 정보
   */
  async submitQuiz(
    quizId: number,
    payload: QuizSubmissionRequest,
    userId: number | null,
  ): Promise<QuizSubmissionResponse> {
    const quiz = await this.quizRepository.findOne({
      where: { id: quizId },
      select: { id: true, type: true, answer: true, explanation: true },
      relations: { step: true },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found.');
    }

    const quizType = quiz.type?.toUpperCase();

    if (quizType === 'MATCHING') {
      const correctPairs = this.getMatchingAnswer(quiz.answer);
      const isCorrect = this.isCorrectMatching(payload.selection?.pairs, correctPairs);

      const result: QuizSubmissionResponse = {
        quiz_id: quiz.id,
        is_correct: isCorrect,
        solution: {
          ...(correctPairs.length > 0 ? { correct_pairs: correctPairs } : {}),
          explanation: quiz.explanation ?? null,
        },
      };

      await this.saveSolveLog({
        userId,
        quiz,
        stepAttemptId: payload.step_attempt_id,
        isCorrect,
      });

      return result;
    }

    const correctOptionId = this.getOptionAnswer(quiz.answer);
    const isCorrect = this.isCorrectOption(payload.selection?.option_id, correctOptionId);

    const result: QuizSubmissionResponse = {
      quiz_id: quiz.id,
      is_correct: isCorrect,
      solution: {
        ...(correctOptionId ? { correct_option_id: correctOptionId } : {}),
        explanation: quiz.explanation ?? null,
      },
    };

    await this.saveSolveLog({
      userId,
      quiz,
      stepAttemptId: payload.step_attempt_id,
      isCorrect,
    });

    return result;
  }

  /**
   * stepId별 퀴즈 개수를 조회해 Map으로 반환한다.
   * @param stepIds 스텝 ID 목록
   * @returns stepId -> quizCount 매핑
   */
  private async getQuizCountByStepId(stepIds: number[]): Promise<Map<number, number>> {
    if (stepIds.length === 0) {
      return new Map();
    }

    const quizCounts = await this.quizRepository
      .createQueryBuilder('quiz')
      .select('quiz.step_id', 'stepId')
      .addSelect('COUNT(quiz.id)', 'quizCount') // step별 퀴즈 개수
      .where('quiz.step_id IN (:...stepIds)', { stepIds })
      .groupBy('quiz.step_id') // step_id 기준 그룹화
      .getRawMany<{ stepId: number; quizCount: string }>(); // 엔티티가 아닌 raw row 반환

    return new Map(quizCounts.map(row => [Number(row.stepId), Number(row.quizCount)]));
  }

  /**
   * 필드 슬러그에 따른 아이콘 식별자를 반환한다.
   * @param slug 필드 슬러그
   * @returns 아이콘 식별자
   */
  private getFieldIconBySlug(slug: string): string {
    if (slug === 'fe') {
      return 'Frontend';
    }
    if (slug === 'be') {
      return 'Backend';
    }
    if (slug === 'mo') {
      return 'Mobile';
    }
    if (slug === 'cs') {
      return 'ComputerScience';
    }
    if (slug === 'algo') {
      return 'Algorithm';
    }
    if (slug === 'game') {
      return 'Game';
    }
    if (slug === 'da') {
      return 'Data';
    }
    if (slug === 'devops') {
      return 'Cloud';
    }

    return 'Unknown';
  }

  /**
   * 사용자 완료 스텝 ID를 Set으로 반환한다.
   * @param stepIds 스텝 ID 목록
   * @param userId 사용자 ID
   * @returns 완료 스텝 ID 집합
   */
  private async getCompletedStepIdSet(
    stepIds: number[],
    userId: number | null,
  ): Promise<Set<number>> {
    if (userId === null || userId === undefined || stepIds.length === 0) {
      return new Set();
    }

    const stepStatuses = await this.stepStatusRepository.find({
      where: { userId, isCompleted: true, step: { id: In(stepIds) } },
      relations: { step: true },
    });

    const completedStepIds = stepStatuses.map(status => status.step.id);
    return new Set(completedStepIds);
  }

  /**
   * 퀴즈 엔티티를 응답 DTO로 변환한다.
   * @param quiz 퀴즈 엔티티
   * @returns 퀴즈 응답 DTO
   */
  private async toQuizResponse(quiz: Quiz): Promise<QuizResponse> {
    return {
      id: quiz.id,
      type: quiz.type,
      content: await this.normalizeQuizContent(quiz),
    };
  }

  /**
   * 퀴즈 content를 안전하게 정규화한다.
   * @param quiz 퀴즈 엔티티
   * @returns 정규화된 content
   */
  private async normalizeQuizContent(quiz: Quiz): Promise<QuizContent> {
    const rawObject = this.toContentObject(quiz.content);
    if (!rawObject) {
      return { question: quiz.question };
    }

    const question =
      typeof rawObject.question === 'string' && rawObject.question.trim().length > 0
        ? rawObject.question
        : quiz.question;

    const options = this.normalizeOptions(rawObject.options);
    const codeMetadata = await this.normalizeCodeMetadata(rawObject);
    const matchingMetadata = this.normalizeMatchingMetadata(rawObject);

    return {
      question,
      ...(options ? { options } : {}),
      ...(codeMetadata ? { code_metadata: codeMetadata } : {}),
      ...(matchingMetadata ? { matching_metadata: matchingMetadata } : {}),
    };
  }

  /**
   * options 값을 QuizOption[] 형태로 정규화한다.
   * @param value 원본 options 값
   * @returns 정규화된 options (없으면 undefined)
   */
  private normalizeOptions(value: unknown) {
    if (!Array.isArray(value)) return undefined;

    const options = value
      .map(option => {
        if (!this.isPlainObject(option)) return null;
        const item = option as Record<string, unknown>;
        const id = item.id;
        const text = item.text;
        if ((typeof id === 'string' || typeof id === 'number') && typeof text === 'string') {
          return { id: String(id), text };
        }
        return null;
      })
      .filter((opt): opt is { id: string; text: string } => opt !== null);

    return options.length > 0 ? options : undefined;
  }

  /**
   * content raw 값을 객체로 변환한다(문자열 JSON도 허용).
   * @param raw content 원본 값
   * @returns content 객체 (없으면 null)
   */
  private toContentObject(raw: unknown): Record<string, unknown> | null {
    if (this.isPlainObject(raw)) {
      return raw;
    }

    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (this.isPlainObject(parsed)) {
          return parsed;
        }
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * answer raw 값을 객체로 변환한다(문자열 JSON도 허용).
   * @param raw answer 원본 값
   * @returns answer 객체 (없으면 null)
   */
  private toAnswerObject(raw: unknown): Record<string, unknown> | null {
    if (this.isPlainObject(raw)) {
      return raw;
    }

    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (this.isPlainObject(parsed)) {
          return parsed;
        }
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * CODE 타입 메타데이터를 content의 최상위 code/language로부터 정규화한다.
   * @param value content 객체
   * @returns 정규화된 code_metadata (없으면 undefined)
   */
  private async normalizeCodeMetadata(value: Record<string, unknown>) {
    const code = value.code;
    const language = value.language;
    if (typeof code === 'string') {
      const formattedCode = await this.codeFormatter.format(
        code,
        typeof language === 'string' ? language : 'javascript',
      );
      return {
        ...(typeof language === 'string' ? { language } : {}),
        snippet: formattedCode,
      };
    }
    return undefined;
  }

  /**
   * MATCHING 타입 메타데이터를 정규화한다.
   * @param value matching_metadata 원본 값
   * @returns 정규화된 matching_metadata (없으면 undefined)
   */
  private normalizeMatchingMetadata(value: unknown) {
    if (!this.isPlainObject(value)) return undefined;

    const item = value as Record<string, unknown>;
    const left = this.normalizeMatchingItems(item.left);
    const right = this.normalizeMatchingItems(item.right);

    if (left.length > 0 && right.length > 0) {
      return { left, right };
    }
    return undefined;
  }

  /**
   * 매칭 항목을 id/text 형태로 정규화한다.
   * - 문자열 배열은 id/text를 동일하게 채운다.
   * - 객체 배열은 id/text를 추출한다.
   */
  private normalizeMatchingItems(value: unknown): Array<{ id: string; text: string }> {
    if (!Array.isArray(value)) return [];

    return value
      .map(item => {
        if (typeof item === 'string' || typeof item === 'number') {
          const text = String(item).trim();
          if (!text) return null;
          return { id: text, text };
        }

        if (this.isPlainObject(item)) {
          const record = item as Record<string, unknown>;
          const text = this.toCleanString(record.text);
          const rawId = this.toCleanString(record.id ?? record.value ?? record.key);
          const id = rawId ?? text;
          if (!id || !text) return null;
          return { id, text };
        }

        return null;
      })
      .filter((entry): entry is { id: string; text: string } => entry !== null);
  }

  /**
   * 객관식 정답을 추출한다.
   * @param answer 정답 원본 값
   * @returns 정답 옵션 ID 또는 null
   */
  private getOptionAnswer(answer: unknown): string | null {
    const answerObject = this.toAnswerObject(answer);
    if (!answerObject) return null;
    return this.toCleanString(
      answerObject.value ?? answerObject.correct_option_id ?? answerObject.option_id,
    );
  }

  /**
   * 매칭형 정답을 추출한다.
   * @param answer 정답 원본 값
   * @returns 정규화된 정답 쌍 배열
   */
  private getMatchingAnswer(answer: unknown): MatchingPair[] {
    const answerObject = this.toAnswerObject(answer);
    if (!answerObject) return [];
    return (
      this.normalizePairs(
        answerObject.pairs ??
          answerObject.correct_pairs ??
          answerObject.matching ??
          answerObject.value,
      ) ?? []
    );
  }

  /**
   * 객관식 정답을 비교한다.
   * @param submitted 제출된 옵션 ID
   * @param correct 정답 옵션 ID
   * @returns 정답 여부
   */
  private isCorrectOption(submitted: unknown, correct: string | null): boolean {
    if (!correct) return false;
    const submittedId = this.toCleanString(submitted);
    return submittedId !== null && submittedId === correct;
  }

  /**
   * 매칭형 정답을 비교한다.
   * @param submittedPairs 제출된 쌍 목록
   * @param correctPairs 정답 쌍 목록
   * @returns 정답 여부
   */
  private isCorrectMatching(
    submittedPairs: MatchingPair[] | undefined,
    correctPairs: MatchingPair[],
  ): boolean {
    const normalizedSubmitted = this.normalizePairs(submittedPairs);
    if (!normalizedSubmitted || normalizedSubmitted.length === 0) {
      return false;
    }

    const normalizeKey = (pair: MatchingPair) => `${pair.left}|||${pair.right}`;
    const expectedSet = new Set(correctPairs.map(normalizeKey));
    return normalizedSubmitted.every(pair => expectedSet.has(normalizeKey(pair)));
  }

  /**
   * 문자열 배열값을 정규화한다(트림 포함).
   * @param value 변환할 값
   * @returns 문자열 배열(유효하지 않으면 빈 배열)
   */
  private normalizePairs(value: unknown): MatchingPair[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const pairs = value
      .map(pair => {
        if (!this.isPlainObject(pair)) return null;
        const item = pair as Record<string, unknown>;
        const left = this.toCleanString(item.left);
        const right = this.toCleanString(item.right);
        if (left !== null && right !== null) {
          return { left, right };
        }
        return null;
      })
      .filter((p): p is MatchingPair => p !== null);

    return pairs.length > 0 ? pairs : undefined;
  }

  /**
   * 엔티티를 응답 DTO 형태로 변환한다.
   * @param field 필드 엔티티
   * @param units 유닛 엔티티 목록
   * @param quizCountByStepId stepId -> quizCount 매핑
   * @param completedStepIdSet 완료된 스텝 ID 집합
   * @returns 응답 DTO
   */
  private buildFieldUnitsResponse(
    field: Field,
    units: NonNullable<Field['units']> = [],
    quizCountByStepId: Map<number, number>,
    completedStepIdSet: Set<number>,
  ): FieldUnitsResponse {
    return {
      field: {
        name: field.name,
        slug: field.slug,
      },
      units: this.sortByOrderIndex(units).map(unit => ({
        id: unit.id,
        title: unit.title,
        orderIndex: unit.orderIndex,
        steps: this.buildUnitStepsWithCheckpoints(
          unit.steps ?? [],
          quizCountByStepId,
          completedStepIdSet,
        ),
      })),
    };
  }

  /**
   * TODO(임시): 유닛 스텝을 최소 5개로 채우고 중간/최종 점검 스텝을 삽입한다.
   * - 실제 스텝: 실제 스텝 정보 + 퀴즈 개수
   * - 플레이스홀더: 부족분을 "제작 중"으로 채운다.
   * - 체크포인트: 중간/최종 점검 스텝은 퀴즈 수 없이 표시만 한다.
   */
  private buildUnitStepsWithCheckpoints(
    steps: Step[],
    quizCountByStepId: Map<number, number>,
    completedStepIdSet: Set<number> = new Set(),
  ): StepSummary[] {
    const sortedSteps = this.sortByOrderIndex(steps);
    const baseStepSummaries: Array<StepSummary & { isPlaceholder?: boolean }> = sortedSteps.map(
      step => ({
        id: step.id,
        title: step.title,
        orderIndex: step.orderIndex,
        quizCount: quizCountByStepId.get(step.id) ?? 0,
        isCheckpoint: step.isCheckpoint,
        isCompleted: completedStepIdSet.has(step.id),
        isLocked: false,
      }),
    );

    // 부족분을 플레이스홀더로 채워 기본 5개를 맞춘다.
    while (baseStepSummaries.length < 5) {
      baseStepSummaries.push({
        id: this.nextVirtualId(),
        title: '제작 중',
        orderIndex: baseStepSummaries.length + 1,
        quizCount: 0,
        isCheckpoint: false,
        isCompleted: false,
        isLocked: false,
        isPlaceholder: true,
      });
    }

    const newSteps: StepSummary[] = [];
    let orderIndex = 1;

    baseStepSummaries.forEach((step, idx) => {
      newSteps.push({
        ...step,
        orderIndex: orderIndex++,
      });

      // 4번째 위치에 중간 점검 삽입 (3번째 스텝 뒤)
      if (idx === 2) {
        newSteps.push(this.createCheckpointStep('중간 점검', orderIndex++));
      }
    });

    // 마지막 위치에 최종 점검 삽입
    newSteps.push(this.createCheckpointStep('최종 점검', orderIndex++));

    return newSteps;
  }

  private createCheckpointStep(title: string, orderIndex: number): StepSummary {
    return {
      id: this.nextVirtualId(),
      title,
      orderIndex,
      quizCount: 0,
      isCheckpoint: true,
      isCompleted: false,
      isLocked: true,
    };
  }

  private nextVirtualId(): number {
    return this.checkpointIdSeed--;
  }

  /**
   * 객체가 일반 객체인지 확인한다.
   * @param value 검사할 값
   * @returns plain object 여부
   */
  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * 안전하게 문자열로 변환하고 공백을 제거한다.
   * @param value 변환할 값
   * @returns 문자열 또는 null
   */
  private toCleanString(value: unknown): string | null {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value).trim();
    return null;
  }

  /**
   * 배열을 문자열 배열로 정규화한다(트림 포함).
   * @param value 변환할 값
   * @returns 문자열 배열(유효하지 않으면 빈 배열)
   */
  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map(item => this.toCleanString(item)).filter((v): v is string => v !== null);
  }

  /**
   * orderIndex 기준으로 오름차순 정렬한다.
   * @param items 정렬할 항목 목록
   * @returns 정렬된 항목 목록
   */
  private sortByOrderIndex<T extends { orderIndex: number }>(items: T[]): T[] {
    return [...items].sort((a, b) => a.orderIndex - b.orderIndex);
  }

  /**
   * Fisher-Yates 알고리즘을 사용하여 배열을 랜덤하게 섞는다.
   * @param array 섞을 배열
   * @returns 섞인 배열 (원본 보존)
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled: T[] = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = temp;
    }
    return shuffled;
  }

  private async saveSolveLog(params: {
    userId: number | null;
    quiz: Quiz;
    stepAttemptId?: number;
    isCorrect: boolean;
  }): Promise<void> {
    const { userId, quiz, stepAttemptId, isCorrect } = params;

    if (userId === null || userId === undefined) {
      return;
    }

    let stepAttempt: UserStepAttempt | null = null;
    if (stepAttemptId) {
      stepAttempt = await this.stepAttemptRepository.findOne({
        where: { id: stepAttemptId, userId },
      });
    } else if (quiz.step?.id) {
      stepAttempt = await this.stepAttemptRepository.findOne({
        where: { userId, step: { id: quiz.step.id }, status: StepAttemptStatus.IN_PROGRESS },
        order: { startedAt: 'DESC' },
      });
    }

    const log = this.solveLogRepository.create({
      userId,
      quiz,
      stepAttempt: stepAttempt ?? null,
      isCorrect,
      solvedAt: new Date(),
      duration: null,
    });

    await this.solveLogRepository.save(log);
  }
}
