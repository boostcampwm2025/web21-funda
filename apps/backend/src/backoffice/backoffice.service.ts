import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { CacheKeys } from '../common/cache/cache-keys';
import { RedisService } from '../common/redis/redis.service';
import { CodeFormatter } from '../common/utils/code-formatter';
import { ProfileCharacter } from '../profile/entities/profile-character.entity';
import { Field } from '../roadmap/entities/field.entity';
import { Quiz } from '../roadmap/entities/quiz.entity';
import { Step } from '../roadmap/entities/step.entity';
import { Unit } from '../roadmap/entities/unit.entity';

import type {
  AdminQuizContent,
  AdminQuizDetailResponse,
  AdminQuizMatchingPair,
  AdminQuizOption,
  AdminQuizUpdateRequest,
  AdminQuizUpdateResponse,
} from './dto/admin-quiz.dto';
import type {
  AdminProfileCharacterItem,
  AdminProfileCharacterUpdateRequest,
} from './dto/profile-character-admin.dto';
import type {
  ProfileCharacterJsonlRow,
  ProfileCharacterUploadSummary,
} from './dto/profile-characters-upload.dto';
import type { QuizJsonlRow, UploadSummary } from './dto/quizzes-upload.dto';
import type {
  UnitOverviewJsonlRow,
  UnitOverviewUploadSummary,
} from './dto/unit-overview-upload.dto';

interface UpsertResult<T> {
  entity: T;
  created: boolean;
  updated?: boolean;
}

@Injectable()
export class BackofficeService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly codeFormatter: CodeFormatter,
  ) {}

  async getQuizForAdmin(quizId: number): Promise<AdminQuizDetailResponse> {
    const repository = this.dataSource.getRepository(Quiz);
    const quiz = await repository.findOne({ where: { id: quizId } });

    if (!quiz) {
      throw new NotFoundException('퀴즈를 찾을 수 없습니다.');
    }

    const content = await this.buildAdminQuizContent(quiz.question, quiz.content);

    return {
      id: quiz.id,
      type: quiz.type,
      content,
      answer: quiz.answer,
      explanation: quiz.explanation ?? null,
      difficulty: quiz.difficulty,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
    };
  }

  async updateQuizForAdmin(
    quizId: number,
    payload: AdminQuizUpdateRequest,
  ): Promise<AdminQuizUpdateResponse> {
    try {
      const result = await this.dataSource.transaction(async manager => {
        const repository = manager.getRepository(Quiz);

        // Prevent lost updates by taking a row-level write lock for the duration of the transaction.
        const quiz = await repository.findOne({
          where: { id: quizId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!quiz) {
          throw new NotFoundException('퀴즈를 찾을 수 없습니다.');
        }

        const updatedFields: AdminQuizUpdateResponse['updatedFields'] = [];

        const contentObject = this.toContentObject(quiz.content) ?? {};

        if (payload.question !== undefined) {
          const nextQuestion = payload.question.trim();
          const prevQuestion = (typeof quiz.question === 'string' ? quiz.question : '').trim();

          // Keep both quiz.question and content.question in sync (renderer prefers content.question).
          const prevContentQuestion =
            typeof contentObject.question === 'string'
              ? contentObject.question.trim()
              : prevQuestion;

          if (nextQuestion.length === 0) {
            throw new BadRequestException('question은 비어 있을 수 없습니다.');
          }

          if (nextQuestion !== prevQuestion || nextQuestion !== prevContentQuestion) {
            quiz.question = nextQuestion;
            contentObject.question = nextQuestion;
            updatedFields.push('question');
          }
        }

        if (payload.explanation !== undefined) {
          const nextExplanation =
            payload.explanation === null ? null : payload.explanation.trim() || null;
          const prevExplanation = quiz.explanation?.trim() || null;

          if (nextExplanation !== prevExplanation) {
            quiz.explanation = nextExplanation;
            updatedFields.push('explanation');
          }
        }

        if (payload.options !== undefined) {
          const normalized = this.normalizeAdminOptions(payload.options);
          const prevNormalized = this.normalizeOptions(contentObject.options, false) ?? [];

          const normalizeKey = (options: AdminQuizOption[]) =>
            options.map(option => `${option.id.trim()}|||${option.text.trim()}`).join('@@@');

          if (normalizeKey(normalized) !== normalizeKey(prevNormalized)) {
            contentObject.options = normalized;
            updatedFields.push('options');
          }
        }

        if (payload.code !== undefined) {
          const nextCode = payload.code.trim();
          const prevCode = typeof contentObject.code === 'string' ? contentObject.code.trim() : '';

          if (nextCode.length === 0) {
            throw new BadRequestException('code는 비어 있을 수 없습니다.');
          }

          if (nextCode !== prevCode) {
            contentObject.code = nextCode;
            updatedFields.push('code');
          }
        }

        if (payload.language !== undefined) {
          const nextLanguage = payload.language.trim();
          const prevLanguage =
            typeof contentObject.language === 'string' ? contentObject.language.trim() : '';

          if (nextLanguage.length === 0) {
            throw new BadRequestException('language는 비어 있을 수 없습니다.');
          }

          if (nextLanguage !== prevLanguage) {
            contentObject.language = nextLanguage;
            updatedFields.push('language');
          }
        }

        if (payload.correctOptionId !== undefined) {
          const nextCorrectOptionId = payload.correctOptionId.trim();
          if (!nextCorrectOptionId) {
            throw new BadRequestException('correctOptionId는 비어 있을 수 없습니다.');
          }

          if (quiz.type.trim().toUpperCase() === 'MATCHING') {
            throw new BadRequestException('매칭 타입에서는 correctOptionId를 수정할 수 없습니다.');
          }

          const prevCorrectOptionId = this.getOptionAnswerId(quiz.answer);
          if (prevCorrectOptionId !== nextCorrectOptionId) {
            const answerObject = this.toAnswerObject(quiz.answer) ?? {};
            answerObject.correct_option_id = nextCorrectOptionId;
            answerObject.value = nextCorrectOptionId;
            quiz.answer = answerObject;
            updatedFields.push('answer');
          }
        }

        if (payload.correctPairs !== undefined) {
          if (quiz.type.trim().toUpperCase() !== 'MATCHING') {
            throw new BadRequestException('correctPairs는 매칭 타입에서만 수정할 수 있습니다.');
          }

          const normalizedPairs = this.normalizeMatchingPairs(payload.correctPairs);

          const allowed = this.getMatchingAllowedIds(contentObject);
          if (allowed.left.length === 0 || allowed.right.length === 0) {
            throw new BadRequestException('매칭 선택지 정보를 찾을 수 없습니다.');
          }

          if (allowed.left.length !== allowed.right.length) {
            throw new BadRequestException('좌/우 선택지 개수가 동일하지 않습니다.');
          }

          if (normalizedPairs.length !== allowed.left.length) {
            throw new BadRequestException(
              `정답 쌍은 ${allowed.left.length}개를 모두 매칭해야 합니다.`,
            );
          }

          const allowedLeftSet = new Set(allowed.left);
          const allowedRightSet = new Set(allowed.right);
          for (const pair of normalizedPairs) {
            if (!allowedLeftSet.has(pair.left)) {
              throw new BadRequestException(
                '정답 쌍에 존재하지 않는 좌측 항목이 포함되어 있습니다.',
              );
            }
            if (!allowedRightSet.has(pair.right)) {
              throw new BadRequestException(
                '정답 쌍에 존재하지 않는 우측 항목이 포함되어 있습니다.',
              );
            }
          }

          const prevPairs = this.getMatchingAnswerPairs(quiz.answer);
          if (this.buildPairsKey(prevPairs) !== this.buildPairsKey(normalizedPairs)) {
            const answerObject = this.toAnswerObject(quiz.answer) ?? {};
            answerObject.correct_pairs = normalizedPairs;
            answerObject.pairs = normalizedPairs;
            answerObject.value = normalizedPairs;
            quiz.answer = answerObject;
            updatedFields.push('answer');
          }
        }

        if (updatedFields.length === 0) {
          return { id: quiz.id, updated: false, updatedFields: [] };
        }

        quiz.content = contentObject;
        await repository.save(quiz);

        return { id: quiz.id, updated: true, updatedFields };
      });

      if (result.updated) {
        await this.invalidateQuizContentCache(new Set([result.id]));
      }

      return result;
    } catch (err) {
      // Lock wait timeouts/deadlocks/serialization failures typically surface as QueryFailedError.
      // Return a clear conflict error to the caller so they can retry.
      if (this.isConcurrencyFailure(err)) {
        throw new ConflictException(
          '다른 요청이 같은 퀴즈를 수정 중입니다. 잠시 후 다시 시도해주세요.',
        );
      }
      throw err;
    }
  }

  private isConcurrencyFailure(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const message = (err as { message?: unknown }).message;
    const text = typeof message === 'string' ? message.toLowerCase() : '';
    return (
      text.includes('deadlock') ||
      text.includes('could not serialize') ||
      text.includes('serialization failure') ||
      text.includes('lock wait timeout') ||
      text.includes('timeout') ||
      text.includes('canceling statement due to lock timeout')
    );
  }

  async uploadQuizzesFromJsonl(fileBuffer: Buffer): Promise<UploadSummary> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('파일을 업로드해주세요.');
    }

    // JSONL을 먼저 파싱해서 잘못된 라인을 빠르게 확인
    const rows = this.parseJsonl(fileBuffer.toString('utf8'));
    if (rows.length === 0) {
      throw new BadRequestException('유효한 JSONL 데이터가 없습니다.');
    }

    const summary: UploadSummary = {
      processed: rows.length,
      fieldsCreated: 0,
      fieldsUpdated: 0,
      unitsCreated: 0,
      unitsUpdated: 0,
      stepsCreated: 0,
      stepsUpdated: 0,
      quizzesCreated: 0,
      quizzesUpdated: 0,
    };

    const changedFieldSlugs = new Set<string>();
    const changedQuizIds = new Set<number>();

    // 트랜잭션 처리
    await this.dataSource.transaction(async manager => {
      for (const [index, row] of rows.entries()) {
        const lineNumber = index + 1;
        this.validateRow(row, lineNumber);

        // Field -> Unit -> Step -> Quiz 순서로 계층 업서트
        const fieldResult = await this.upsertField(row, manager);
        summary.fieldsCreated += fieldResult.created ? 1 : 0;
        summary.fieldsUpdated += fieldResult.updated ? 1 : 0;
        changedFieldSlugs.add(fieldResult.entity.slug);

        const unitResult = await this.upsertUnit(row, fieldResult.entity, manager);
        summary.unitsCreated += unitResult.created ? 1 : 0;
        summary.unitsUpdated += unitResult.updated ? 1 : 0;

        const stepResult = await this.upsertStep(row, unitResult.entity, manager);
        summary.stepsCreated += stepResult.created ? 1 : 0;
        summary.stepsUpdated += stepResult.updated ? 1 : 0;

        const quizResult = await this.upsertQuiz(row, stepResult.entity, manager, lineNumber);
        summary.quizzesCreated += quizResult.created ? 1 : 0;
        summary.quizzesUpdated += quizResult.updated ? 1 : 0;
        changedQuizIds.add(quizResult.entity.id);
      }
    });

    await this.invalidateRoadmapCache(changedFieldSlugs);
    await this.invalidateQuizContentCache(changedQuizIds);

    return summary;
  }

  /**
   * JSONL 파일로 유닛 개요를 업로드한다.
   * @param fileBuffer 업로드된 JSONL 파일 버퍼
   * @returns 유닛 개요 업로드 요약
   */
  async uploadUnitOverviewsFromJsonl(fileBuffer: Buffer): Promise<UnitOverviewUploadSummary> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('파일을 업로드해주세요.');
    }

    const rows = this.parseUnitOverviewJsonl(fileBuffer.toString('utf8'));
    if (rows.length === 0) {
      throw new BadRequestException('유효한 JSONL 데이터가 없습니다.');
    }

    const summary: UnitOverviewUploadSummary = {
      processed: rows.length,
      unitsUpdated: 0,
      unitsNotFound: 0,
    };

    const updatedUnitIds = new Set<number>();

    await this.dataSource.transaction(async manager => {
      const repository = manager.getRepository(Unit);

      for (const [index, row] of rows.entries()) {
        const lineNumber = index + 1;
        this.validateUnitOverviewRow(row, lineNumber);

        const title = row.unit_title.trim();
        const overview = row.overview.trim();
        const units = await repository.find({ where: { title } });

        if (units.length === 0) {
          summary.unitsNotFound += 1;
          continue;
        }

        for (const unit of units) {
          if (unit.overview === overview) {
            continue;
          }

          unit.overview = overview;
          await repository.save(unit);
          summary.unitsUpdated += 1;
          updatedUnitIds.add(unit.id);
        }
      }
    });

    await this.invalidateUnitOverviewCache(updatedUnitIds);

    return summary;
  }

  /**
   * 프로필 캐릭터 JSONL 파일로 캐릭터를 일괄 등록/수정한다.
   *
   * @param fileBuffer 업로드된 JSONL 파일 버퍼
   * @returns 업로드 결과 요약
   */
  async uploadProfileCharactersFromJsonl(
    fileBuffer: Buffer,
  ): Promise<ProfileCharacterUploadSummary> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('파일을 업로드해주세요.');
    }

    const rows = this.parseProfileCharacterJsonl(fileBuffer.toString('utf8'));
    if (rows.length === 0) {
      throw new BadRequestException('유효한 JSONL 데이터가 없습니다.');
    }

    const summary: ProfileCharacterUploadSummary = {
      processed: rows.length,
      charactersCreated: 0,
      charactersUpdated: 0,
    };

    await this.dataSource.transaction(async manager => {
      for (const [index, row] of rows.entries()) {
        const lineNumber = index + 1;
        this.validateProfileCharacterRow(row, lineNumber);

        const result = await this.upsertProfileCharacter(row, manager, lineNumber);
        summary.charactersCreated += result.created ? 1 : 0;
        summary.charactersUpdated += result.updated ? 1 : 0;
      }
    });

    return summary;
  }

  /**
   * 단일 프로필 캐릭터를 등록한다.
   *
   * @param payload 단일 등록 요청
   * @returns 등록 결과
   */
  async createProfileCharacter(payload: {
    imageUrl: string;
    priceDiamonds: number;
    description?: string | null;
    isActive?: boolean;
  }): Promise<{ id: number; created: boolean; updated: boolean }> {
    const normalized = this.normalizeProfileCharacterPayload(payload);

    const result = await this.dataSource.transaction(async manager => {
      const row: ProfileCharacterJsonlRow = {
        image_url: normalized.imageUrl,
        price_diamonds: normalized.priceDiamonds,
        description: normalized.description ?? undefined,
        is_active: normalized.isActive,
      };

      return this.upsertProfileCharacter(row, manager);
    });

    return {
      id: result.entity.id,
      created: result.created,
      updated: !!result.updated,
    };
  }

  /**
   * 관리자용 프로필 캐릭터 목록을 조회한다.
   *
   * @returns 관리자용 프로필 캐릭터 목록
   */
  async getProfileCharactersForAdmin(): Promise<AdminProfileCharacterItem[]> {
    const repository = this.dataSource.getRepository(ProfileCharacter);
    const characters = await repository.find({ order: { id: 'ASC' } });

    return characters.map(character => ({
      id: character.id,
      name: character.name,
      imageUrl: character.imageUrl,
      priceDiamonds: character.priceDiamonds,
      description: character.description ?? null,
      isActive: character.isActive,
      createdAt: character.createdAt,
      updatedAt: character.updatedAt,
    }));
  }

  /**
   * 관리자용 프로필 캐릭터 정보를 수정한다.
   *
   * @param characterId 수정할 캐릭터 ID
   * @param payload 수정할 값
   * @returns 수정 결과
   */
  async updateProfileCharacterForAdmin(
    characterId: number,
    payload: AdminProfileCharacterUpdateRequest,
  ): Promise<{ id: number; updated: boolean }> {
    if (!Number.isInteger(characterId) || characterId <= 0) {
      throw new BadRequestException('유효한 캐릭터 ID가 필요합니다.');
    }

    if (!Number.isFinite(payload.priceDiamonds) || payload.priceDiamonds < 0) {
      throw new BadRequestException('가격은 0 이상의 숫자여야 합니다.');
    }

    if (typeof payload.isActive !== 'boolean') {
      throw new BadRequestException('노출 여부 값이 올바르지 않습니다.');
    }

    const repository = this.dataSource.getRepository(ProfileCharacter);
    const character = await repository.findOne({ where: { id: characterId } });

    if (!character) {
      throw new NotFoundException('프로필 캐릭터를 찾을 수 없습니다.');
    }

    character.priceDiamonds = payload.priceDiamonds;
    character.isActive = payload.isActive;

    const saved = await repository.save(character);

    return { id: saved.id, updated: true };
  }

  /**
   * 업로드로 변경된 로드맵 캐시를 무효화한다.
   */
  private async invalidateRoadmapCache(fieldSlugs: Set<string>): Promise<void> {
    if (fieldSlugs.size === 0) {
      return;
    }

    await this.safeDeleteCacheKey(CacheKeys.fieldList());

    for (const slug of fieldSlugs) {
      const unitsKey = CacheKeys.fieldUnits(slug);
      const firstUnitKey = CacheKeys.firstUnit(slug);
      await this.safeDeleteCacheKey(unitsKey);
      await this.safeDeleteCacheKey(firstUnitKey);
    }
  }

  /**
   * 퀴즈 콘텐츠 캐시를 무효화한다.
   */
  private async invalidateQuizContentCache(quizIds: Set<number>): Promise<void> {
    if (quizIds.size === 0) {
      return;
    }

    for (const quizId of quizIds) {
      const cacheKey = CacheKeys.quizContent(quizId);
      await this.safeDeleteCacheKey(cacheKey);
    }
  }

  /**
   * 유닛 개요 캐시를 무효화한다.
   */
  private async invalidateUnitOverviewCache(unitIds: Set<number>): Promise<void> {
    if (unitIds.size === 0) {
      return;
    }

    for (const unitId of unitIds) {
      const cacheKey = CacheKeys.unitOverview(unitId);
      await this.safeDeleteCacheKey(cacheKey);
    }
  }

  private async safeDeleteCacheKey(cacheKey: string): Promise<void> {
    try {
      await this.redisService.del(cacheKey);
    } catch {
      // 캐시 삭제 실패는 업로드 흐름을 막지 않는다.
    }
  }

  /**
   * JSONL 문자열을 파싱해 각 라인을 객체로 변환한다.
   * 파싱 실패 시 라인 번호와 함께 예외를 던진다.
   */
  private parseJsonl(fileText: string): QuizJsonlRow[] {
    const lines = fileText.split(/\r?\n/);
    const rows: QuizJsonlRow[] = [];
    const errors: string[] = [];

    lines.forEach((line, index) => {
      const trimmed = this.normalizeLine(line);
      if (!trimmed) {
        return;
      }

      try {
        const parsed = JSON.parse(trimmed) as QuizJsonlRow;
        rows.push(parsed);
      } catch (error) {
        errors.push(`Line ${index + 1}: ${(error as Error).message}`);
      }
    });

    if (errors.length > 0) {
      throw new BadRequestException(['JSONL 파싱 오류가 있습니다.', ...errors].join('\n'));
    }

    return rows;
  }

  /**
   * 유닛 개요 JSONL을 파싱해 각 라인을 객체로 변환한다.
   * 파싱 실패 시 라인 번호와 함께 예외를 던진다.
   */
  private parseUnitOverviewJsonl(fileText: string): UnitOverviewJsonlRow[] {
    const lines = fileText.split(/\r?\n/);
    const rows: UnitOverviewJsonlRow[] = [];
    const errors: string[] = [];

    lines.forEach((line, index) => {
      const trimmed = this.normalizeLine(line);
      if (!trimmed) {
        return;
      }

      try {
        const parsed = JSON.parse(trimmed) as UnitOverviewJsonlRow;
        rows.push(parsed);
      } catch (error) {
        errors.push(`Line ${index + 1}: ${(error as Error).message}`);
      }
    });

    if (errors.length > 0) {
      throw new BadRequestException(['JSONL 파싱 오류가 있습니다.', ...errors].join('\n'));
    }

    return rows;
  }

  /**
   * 프로필 캐릭터 JSONL을 파싱해 각 라인을 객체로 변환한다.
   * 파싱 실패 시 라인 번호와 함께 예외를 던진다.
   */
  private parseProfileCharacterJsonl(fileText: string): ProfileCharacterJsonlRow[] {
    const lines = fileText.split(/\r?\n/);
    const rows: ProfileCharacterJsonlRow[] = [];
    const errors: string[] = [];

    lines.forEach((line, index) => {
      const trimmed = this.normalizeLine(line);
      if (!trimmed) {
        return;
      }

      try {
        const parsed = JSON.parse(trimmed) as ProfileCharacterJsonlRow;
        rows.push(parsed);
      } catch (error) {
        errors.push(`Line ${index + 1}: ${(error as Error).message}`);
      }
    });

    if (errors.length > 0) {
      throw new BadRequestException(['JSONL 파싱 오류가 있습니다.', ...errors].join('\n'));
    }

    return rows;
  }

  /**
   * 프로필 캐릭터 JSONL 필수 필드를 검증한다.
   인정하지 않는 입력이 DB에 저장되는 것을 방지하기 위함이다.
   */
  private validateProfileCharacterRow(row: ProfileCharacterJsonlRow, lineNumber: number): void {
    const imageUrl = row.image_url?.trim();
    const priceDiamonds = Number(row.price_diamonds);

    if (!imageUrl) {
      throw new BadRequestException(`Line ${lineNumber}: image_url은 필수입니다.`);
    }

    if (!Number.isFinite(priceDiamonds) || priceDiamonds < 0) {
      throw new BadRequestException(`Line ${lineNumber}: price_diamonds는 0 이상 숫자여야 합니다.`);
    }
  }

  /**
   * 단일 등록 요청에서 사용할 값을 정규화한다.
   */
  private normalizeProfileCharacterPayload(payload: {
    imageUrl: string;
    priceDiamonds: number;
    description?: string | null;
    isActive?: boolean;
  }): { imageUrl: string; priceDiamonds: number; description: string | null; isActive: boolean } {
    const imageUrl = payload.imageUrl?.trim();
    if (!imageUrl) {
      throw new BadRequestException('imageUrl은 필수입니다.');
    }

    const priceDiamonds = Number(payload.priceDiamonds);
    if (!Number.isFinite(priceDiamonds) || priceDiamonds < 0) {
      throw new BadRequestException('priceDiamonds는 0 이상 숫자여야 합니다.');
    }

    const description = payload.description?.trim() ?? null;
    const isActive = payload.isActive ?? true;

    return { imageUrl, priceDiamonds, description, isActive };
  }

  /** BOM/스마트 따옴표 등을 정리해 JSON 파싱 안정성을 높인다. */
  private normalizeLine(line: string): string {
    return line
      .replace(/\uFEFF/g, '') // BOM 제거
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .trim();
  }

  /**
   * 필수 필드를 검증한다.
   */
  private validateRow(row: QuizJsonlRow, lineNumber: number): void {
    const required = [
      ['field_slug', row.field_slug],
      ['field_name', row.field_name],
      ['unit_title', row.unit_title],
      ['step_title', row.step_title],
      ['type', row.type],
      ['question', row.question],
      ['content', row.content],
      ['answer', row.answer],
    ] as const;

    const missing = required.filter(([, value]) => !value || `${value}`.trim().length === 0);
    const missingKeys: string[] = missing.map(([key]) => key);

    if (missingKeys.length > 0) {
      throw new BadRequestException(
        `Line ${lineNumber}: 필수 필드 누락 - ${missingKeys.join(', ')}`,
      );
    }
  }

  /**
   * 유닛 개요 업로드 필수 필드를 검증한다.
   */
  private validateUnitOverviewRow(row: UnitOverviewJsonlRow, lineNumber: number): void {
    const required = [
      ['unit_title', row.unit_title],
      ['overview', row.overview],
    ] as const;

    const missing = required.filter(([, value]) => !value || `${value}`.trim().length === 0);
    const missingKeys: string[] = missing.map(([key]) => key);

    if (missingKeys.length > 0) {
      throw new BadRequestException(
        `Line ${lineNumber}: 필수 필드 누락 - ${missingKeys.join(', ')}`,
      );
    }
  }

  /** Field를 slug 기준으로 upsert한다. */
  private async upsertField(
    row: QuizJsonlRow,
    manager: EntityManager,
  ): Promise<UpsertResult<Field>> {
    const repository = manager.getRepository(Field);
    const slug = row.field_slug.trim();
    const name = row.field_name.trim();

    let field = await repository.findOne({ where: { slug } });
    if (!field) {
      field = repository.create({
        slug,
        name,
        description: row.field_description?.trim() ?? null,
      });
      await repository.save(field);
      return { entity: field, created: true };
    }

    let updated = false;
    if (field.name !== name) {
      field.name = name;
      updated = true;
    }
    const incomingDescription = row.field_description?.trim() ?? null;
    if (incomingDescription !== null && field.description !== incomingDescription) {
      field.description = incomingDescription;
      updated = true;
    }

    if (updated) {
      await repository.save(field);
    }

    return { entity: field, created: false, updated };
  }

  /**
   * 프로필 캐릭터를 image_url 기준으로 업서트한다.
   */
  private async upsertProfileCharacter(
    row: ProfileCharacterJsonlRow,
    manager: EntityManager,
    lineNumber?: number,
  ): Promise<UpsertResult<ProfileCharacter>> {
    const repository = manager.getRepository(ProfileCharacter);
    const imageUrl = row.image_url.trim();
    const priceDiamonds = Number(row.price_diamonds);
    const description = row.description?.trim() ?? null;
    const isActive = row.is_active ?? true;

    let character = await repository.findOne({ where: { imageUrl } });
    if (!character) {
      const name = this.buildProfileCharacterName(imageUrl, lineNumber);
      character = repository.create({
        name,
        imageUrl,
        priceDiamonds,
        description,
        isActive,
      });
      await repository.save(character);
      return { entity: character, created: true };
    }

    let updated = false;
    if (character.priceDiamonds !== priceDiamonds) {
      character.priceDiamonds = priceDiamonds;
      updated = true;
    }

    if ((character.description ?? null) !== description) {
      character.description = description;
      updated = true;
    }

    if (character.isActive !== isActive) {
      character.isActive = isActive;
      updated = true;
    }

    if (updated) {
      await repository.save(character);
    }

    return { entity: character, created: false, updated };
  }

  /**
   * 이름 입력을 받지 않는 운영 흐름을 위해 서버에서 관리용 이름을 생성한다.
   */
  private buildProfileCharacterName(imageUrl: string, lineNumber?: number): string {
    const fileName = imageUrl.split('/').pop();
    const splitFileName = (fileName ?? 'character').split('?');
    const safeFileName = (splitFileName.at(0) ?? 'character').trim();
    const baseName = safeFileName || 'character';

    if (lineNumber !== undefined) {
      return `character-${lineNumber}-${baseName}`.slice(0, 100);
    }

    return `character-${Date.now()}-${baseName}`.slice(0, 100);
  }

  /** Unit을 field + title 기준으로 upsert한다. */
  private async upsertUnit(
    row: QuizJsonlRow,
    field: Field,
    manager: EntityManager,
  ): Promise<UpsertResult<Unit>> {
    const repository = manager.getRepository(Unit);
    const title = row.unit_title.trim();
    let unit = await repository.findOne({
      where: { field: { id: field.id }, title },
    });

    if (!unit) {
      // order_index가 없으면 부모 개수 + 1로 자동 추가
      const orderIndex =
        this.toNumberOrNull(row.unit_order_index) ??
        (await repository.count({ where: { field: { id: field.id } } })) + 1;

      unit = repository.create({
        field,
        title,
        description: row.unit_description?.trim() ?? null,
        orderIndex,
      });

      await repository.save(unit);
      return { entity: unit, created: true };
    }

    let updated = false;
    const incomingDescription = row.unit_description?.trim() ?? null;
    if (incomingDescription !== null && unit.description !== incomingDescription) {
      unit.description = incomingDescription;
      updated = true;
    }

    const incomingOrderIndex = this.toNumberOrNull(row.unit_order_index);
    if (incomingOrderIndex !== null && incomingOrderIndex !== unit.orderIndex) {
      unit.orderIndex = incomingOrderIndex;
      updated = true;
    }

    if (updated) {
      await repository.save(unit);
    }

    return { entity: unit, created: false, updated };
  }

  /** Step을 unit + title 기준으로 upsert한다. */
  private async upsertStep(
    row: QuizJsonlRow,
    unit: Unit,
    manager: EntityManager,
  ): Promise<UpsertResult<Step>> {
    const repository = manager.getRepository(Step);
    const title = row.step_title.trim();
    let step = await repository.findOne({
      where: { unit: { id: unit.id }, title },
    });

    if (!step) {
      // order_index가 없으면 부모 개수 + 1로 자동 추가
      const orderIndex =
        this.toNumberOrNull(row.step_order_index) ??
        (await repository.count({ where: { unit: { id: unit.id } } })) + 1;

      const isCheckpoint = this.toBoolean(row.is_checkpoint ?? row.step_is_checkpoint);
      step = repository.create({
        unit,
        title,
        orderIndex,
        isCheckpoint,
      });
      await repository.save(step);
      return { entity: step, created: true };
    }

    let updated = false;
    const incomingOrderIndex = this.toNumberOrNull(row.step_order_index);
    if (incomingOrderIndex !== null && incomingOrderIndex !== step.orderIndex) {
      step.orderIndex = incomingOrderIndex;
      updated = true;
    }

    if (row.is_checkpoint !== undefined || row.step_is_checkpoint !== undefined) {
      const isCheckpoint = this.toBoolean(row.is_checkpoint ?? row.step_is_checkpoint);
      if (isCheckpoint !== step.isCheckpoint) {
        step.isCheckpoint = isCheckpoint;
        updated = true;
      }
    }

    if (updated) {
      await repository.save(step);
    }

    return { entity: step, created: false, updated };
  }

  /** Quiz를 step + question 기준으로 upsert한다. */
  private async upsertQuiz(
    row: QuizJsonlRow,
    step: Step,
    manager: EntityManager,
    lineNumber: number,
  ): Promise<UpsertResult<Quiz>> {
    const repository = manager.getRepository(Quiz);
    const normalizedContent = this.normalizeContent(row, lineNumber);
    const normalizedAnswer = this.normalizeJsonValue(row.answer, 'answer', lineNumber);
    const difficulty = this.toDifficulty(row.difficulty);

    let quiz = await repository.findOne({
      where: {
        step: { id: step.id },
        question: row.question.trim(),
      },
    });

    if (!quiz) {
      quiz = repository.create({
        step,
        type: row.type.trim(),
        question: row.question.trim(),
        content: normalizedContent,
        answer: normalizedAnswer,
        explanation: row.explanation?.trim() ?? null,
        difficulty,
      });
      await repository.save(quiz);
      return { entity: quiz, created: true };
    }

    quiz.type = row.type.trim();
    quiz.content = normalizedContent;
    quiz.answer = normalizedAnswer;
    quiz.explanation = row.explanation?.trim() ?? null;
    quiz.difficulty = difficulty;
    await repository.save(quiz);

    return { entity: quiz, created: false, updated: true };
  }

  /**
   * 문자열/객체 값을 JSON 형태로 정규화한다.
   * 문자열은 JSON.parse를 시도하고 실패 시 { value }로 감싼다.
   */
  private normalizeJsonValue(value: unknown, fieldName: string, lineNumber: number): unknown {
    if (value === undefined || value === null) {
      throw new BadRequestException(`Line ${lineNumber}: ${fieldName} 값이 비어 있습니다.`);
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed !== null && typeof parsed === 'object') {
          return parsed;
        }
        return { value: parsed };
      } catch {
        return { value };
      }
    }

    if (typeof value === 'object') {
      return value;
    }

    throw new BadRequestException(
      `Line ${lineNumber}: ${fieldName} 값이 JSON으로 변환되지 않습니다.`,
    );
  }

  /** content를 JSON 형태로 정규화한다. */
  private normalizeContent(row: QuizJsonlRow, lineNumber: number): unknown {
    const rawContent = row.content;
    return this.normalizeJsonValue(rawContent, 'content', lineNumber);
  }

  private normalizeAdminOptions(value: AdminQuizOption[]): AdminQuizOption[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException('options 형식이 올바르지 않습니다.');
    }

    const options: AdminQuizOption[] = [];

    for (const option of value) {
      if (!option || typeof option !== 'object') {
        continue;
      }

      const id = typeof (option as AdminQuizOption).id === 'string' ? option.id.trim() : '';
      const text = typeof (option as AdminQuizOption).text === 'string' ? option.text.trim() : '';

      if (!id || !text) {
        continue;
      }

      options.push({ id, text });
    }

    if (options.length === 0) {
      throw new BadRequestException('options가 비어 있습니다.');
    }

    return options;
  }

  private async buildAdminQuizContent(
    fallbackQuestion: string,
    raw: unknown,
  ): Promise<AdminQuizContent> {
    const rawObject = this.toContentObject(raw);

    const content: AdminQuizContent = {
      question: fallbackQuestion.trim(),
    };

    if (!rawObject) {
      return content;
    }

    if (typeof rawObject.question === 'string' && rawObject.question.trim().length > 0) {
      content.question = rawObject.question.trim();
    }

    // Preserve raw code/language for admin edit screens (renderer uses code_metadata).
    if (typeof rawObject.code === 'string') {
      content.code = rawObject.code;
    }
    if (typeof rawObject.language === 'string') {
      content.language = rawObject.language;
    }

    const options = this.normalizeOptions(rawObject.options, false);
    if (options) {
      content.options = options;
    }

    const codeMetadata = await this.normalizeCodeMetadata(rawObject);
    if (codeMetadata) {
      content.code_metadata = codeMetadata;
    }

    const matchingMetadata = this.normalizeMatchingMetadata(rawObject, false);
    if (matchingMetadata) {
      content.matching_metadata = matchingMetadata;
    }

    return content;
  }

  private normalizeOptions(
    value: unknown,
    shouldShuffle: boolean,
  ): Array<{ id: string; text: string }> | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    const options: Array<{ id: string; text: string }> = [];

    for (const option of value) {
      if (!this.isPlainObject(option)) {
        continue;
      }

      const record = option as Record<string, unknown>;
      const id = record.id;
      const text = record.text;

      if (
        (typeof id === 'string' || typeof id === 'number') &&
        typeof text === 'string' &&
        text.trim().length > 0
      ) {
        options.push({ id: String(id).trim(), text: text.trim() });
      }
    }

    if (options.length === 0) {
      return undefined;
    }

    if (shouldShuffle) {
      return this.shuffleArray(options);
    }

    return options;
  }

  private async normalizeCodeMetadata(
    value: Record<string, unknown>,
  ): Promise<{ language?: string; snippet: string } | undefined> {
    const code = value.code;
    const language = value.language;

    if (typeof code !== 'string') {
      return undefined;
    }

    const resolvedLanguage = typeof language === 'string' ? language.trim() : 'javascript';
    const formattedCode = await this.codeFormatter.format(code, resolvedLanguage);

    if (typeof language === 'string') {
      return { language: resolvedLanguage, snippet: formattedCode };
    }
    return { snippet: formattedCode };
  }

  private normalizeMatchingMetadata(
    value: unknown,
    shouldShuffle: boolean,
  ):
    | { left: Array<{ id: string; text: string }>; right: Array<{ id: string; text: string }> }
    | undefined {
    if (!this.isPlainObject(value)) {
      return undefined;
    }

    const record = value as Record<string, unknown>;
    const leftItems = this.normalizeMatchingItems(record.left);
    const rightItems = this.normalizeMatchingItems(record.right);

    if (leftItems.length === 0 || rightItems.length === 0) {
      return undefined;
    }

    if (shouldShuffle) {
      return {
        left: this.shuffleArray(leftItems),
        right: this.shuffleArray(rightItems),
      };
    }

    return { left: leftItems, right: rightItems };
  }

  private normalizeMatchingItems(value: unknown): Array<{ id: string; text: string }> {
    if (!Array.isArray(value)) {
      return [];
    }

    const items: Array<{ id: string; text: string }> = [];

    for (const item of value) {
      if (typeof item === 'string' || typeof item === 'number') {
        const text = String(item).trim();
        if (text.length > 0) {
          items.push({ id: text, text });
        }
        continue;
      }

      if (!this.isPlainObject(item)) {
        continue;
      }

      const record = item as Record<string, unknown>;
      const text = this.toCleanString(record.text);
      let rawId = this.toCleanString(record.id);

      if (!rawId) {
        rawId = text;
      }

      if (rawId !== null && text !== null) {
        items.push({ id: rawId, text });
      }
    }

    return items;
  }

  private toCleanString(value: unknown): string | null {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value).trim();
    return null;
  }

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

  private getOptionAnswerId(answer: unknown): string | null {
    const obj = this.toAnswerObject(answer);
    if (!obj) return null;
    return this.toCleanString(obj.value ?? obj.correct_option_id ?? obj.option_id);
  }

  private normalizeMatchingPairs(
    value: AdminQuizMatchingPair[],
  ): Array<{ left: string; right: string }> {
    if (!Array.isArray(value)) {
      throw new BadRequestException('correctPairs 형식이 올바르지 않습니다.');
    }

    const pairs: Array<{ left: string; right: string }> = [];
    const usedLeft = new Set<string>();
    const usedRight = new Set<string>();

    for (const item of value) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const left = this.toCleanString((item as AdminQuizMatchingPair).left);
      const right = this.toCleanString((item as AdminQuizMatchingPair).right);
      if (!left || !right) {
        continue;
      }

      if (usedLeft.has(left) || usedRight.has(right)) {
        throw new BadRequestException('정답 쌍에 중복된 항목이 포함되어 있습니다.');
      }

      usedLeft.add(left);
      usedRight.add(right);
      pairs.push({ left, right });
    }

    if (pairs.length === 0) {
      throw new BadRequestException('correctPairs가 비어 있습니다.');
    }

    return pairs;
  }

  private getMatchingAnswerPairs(answer: unknown): Array<{ left: string; right: string }> {
    const obj = this.toAnswerObject(answer);
    if (!obj) return [];

    const rawPairs = obj.pairs ?? obj.correct_pairs ?? obj.matching ?? obj.value ?? null;
    if (!Array.isArray(rawPairs)) return [];

    const pairs: Array<{ left: string; right: string }> = [];
    for (const raw of rawPairs) {
      if (!this.isPlainObject(raw)) continue;
      const left = this.toCleanString(raw.left);
      const right = this.toCleanString(raw.right);
      if (left && right) {
        pairs.push({ left, right });
      }
    }
    return pairs;
  }

  private buildPairsKey(pairs: Array<{ left: string; right: string }>): string {
    return [...pairs]
      .map(pair => ({ left: pair.left.trim(), right: pair.right.trim() }))
      .sort((a, b) =>
        a.left === b.left ? a.right.localeCompare(b.right) : a.left.localeCompare(b.left),
      )
      .map(pair => `${pair.left}|||${pair.right}`)
      .join('@@@');
  }

  private getMatchingAllowedIds(contentObject: Record<string, unknown>): {
    left: string[];
    right: string[];
  } {
    const leftItems = this.normalizeMatchingItems(contentObject.left);
    const rightItems = this.normalizeMatchingItems(contentObject.right);

    return {
      left: leftItems.map(item => item.id),
      right: rightItems.map(item => item.id),
    };
  }

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

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = result[i]!;
      result[i] = result[j]!;
      result[j] = temp;
    }
    return result;
  }

  /** 숫자 변환 실패 시 null을 반환한다. */
  private toNumberOrNull(value?: number | string | null): number | null {
    if (value === undefined || value === null) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  /** 문자열/숫자 형태의 boolean을 안전하게 변환한다. */
  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return ['true', '1', 'yes'].includes(value.toLowerCase().trim());
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    return false;
  }

  /** 난이도를 1~5 범위로 정규화한다. */
  private toDifficulty(rawDifficulty?: number): number {
    const parsed = this.toNumberOrNull(rawDifficulty) ?? 1;
    if (!Number.isFinite(parsed)) {
      return 1;
    }
    const clamped = Math.max(1, Math.min(5, parsed));
    return Math.trunc(clamped);
  }
}
