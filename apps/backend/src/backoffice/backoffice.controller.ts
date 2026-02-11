import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';

import type {
  AdminQuizDetailResponse,
  AdminQuizUpdateRequest,
  AdminQuizUpdateResponse,
} from './dto/admin-quiz.dto';
import type {
  AdminProfileCharacterItem,
  AdminProfileCharacterUpdateRequest,
} from './dto/profile-character-admin.dto';
import type { ProfileCharacterUploadSummary } from './dto/profile-characters-upload.dto';
import type { UploadedQuizFile } from './dto/quizzes-upload.dto';
import { BackofficeService } from './backoffice.service';

@ApiTags('Admin')
@ApiBearerAuth('accessToken')
@Controller('admin')
@UseGuards(JwtAccessGuard, AdminGuard)
export class BackofficeController {
  constructor(private readonly backofficeService: BackofficeService) {}

  @Get('quizzes/:quizId')
  @ApiOperation({
    summary: '퀴즈 단건 상세 조회 (관리자)',
    description: '관리자 페이지에서 퀴즈 내용을 확인/수정하기 위한 상세 정보를 반환합니다.',
  })
  @ApiOkResponse({
    description: '퀴즈 상세 조회 성공',
  })
  async getQuizForAdmin(
    @Param('quizId', ParseIntPipe) quizId: number,
  ): Promise<AdminQuizDetailResponse> {
    return this.backofficeService.getQuizForAdmin(quizId);
  }

  @Patch('quizzes/:quizId')
  @ApiOperation({
    summary: '퀴즈 부분 수정 (관리자)',
    description:
      'question/options/explanation/code/language 중 변경된 필드만 보내면 해당 값만 반영합니다.',
  })
  @ApiOkResponse({
    description: '퀴즈 수정 성공',
  })
  async updateQuizForAdmin(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Body() payload: AdminQuizUpdateRequest,
  ): Promise<AdminQuizUpdateResponse> {
    return this.backofficeService.updateQuizForAdmin(quizId, payload);
  }

  @Post('quizzes/upload')
  @UseInterceptors(FilesInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: '퀴즈 대량 업로드 (JSONL)',
    description: 'JSONL 파일을 통해 Field, Unit, Step, Quiz를 한 번에 계층적으로 업로드합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({
    description: '업로드 결과 요약',
    schema: {
      example: {
        processed: 10,
        fieldsCreated: 1,
        fieldsUpdated: 0,
        unitsCreated: 2,
        unitsUpdated: 1,
        stepsCreated: 5,
        stepsUpdated: 0,
        quizzesCreated: 10,
        quizzesUpdated: 0,
      },
    },
  })
  async uploadQuizzes(@UploadedFiles() files: UploadedQuizFile[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('업로드된 파일이 없습니다.');
    }

    const summary = {
      processed: 0,
      fieldsCreated: 0,
      fieldsUpdated: 0,
      unitsCreated: 0,
      unitsUpdated: 0,
      stepsCreated: 0,
      stepsUpdated: 0,
      quizzesCreated: 0,
      quizzesUpdated: 0,
    };

    for (const file of files) {
      const fileSummary = await this.backofficeService.uploadQuizzesFromJsonl(file.buffer);
      summary.processed += fileSummary.processed;
      summary.fieldsCreated += fileSummary.fieldsCreated;
      summary.fieldsUpdated += fileSummary.fieldsUpdated;
      summary.unitsCreated += fileSummary.unitsCreated;
      summary.unitsUpdated += fileSummary.unitsUpdated;
      summary.stepsCreated += fileSummary.stepsCreated;
      summary.stepsUpdated += fileSummary.stepsUpdated;
      summary.quizzesCreated += fileSummary.quizzesCreated;
      summary.quizzesUpdated += fileSummary.quizzesUpdated;
    }

    return summary;
  }

  @Post('units/overview/upload')
  @UseInterceptors(FilesInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: '유닛 개요 대량 업로드 (JSONL)',
    description: 'JSONL 파일을 통해 유닛 개요(overview)를 일괄 업데이트합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({
    description: '업로드 결과 요약',
    schema: {
      example: {
        processed: 10,
        unitsUpdated: 9,
        unitsNotFound: 1,
      },
    },
  })
  async uploadUnitOverviews(@UploadedFiles() files: UploadedQuizFile[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('업로드된 파일이 없습니다.');
    }

    const summary = {
      processed: 0,
      unitsUpdated: 0,
      unitsNotFound: 0,
    };

    for (const file of files) {
      const fileSummary = await this.backofficeService.uploadUnitOverviewsFromJsonl(file.buffer);
      summary.processed += fileSummary.processed;
      summary.unitsUpdated += fileSummary.unitsUpdated;
      summary.unitsNotFound += fileSummary.unitsNotFound;
    }

    return summary;
  }

  @Post('profile-characters')
  @ApiOperation({
    summary: '프로필 캐릭터 단일 등록',
    description: '이미지 URL과 가격 정보를 받아 프로필 캐릭터를 등록합니다.',
  })
  @ApiCreatedResponse({
    description: '단일 등록 결과',
    schema: {
      example: {
        id: 10,
        created: true,
        updated: false,
      },
    },
  })
  async createProfileCharacter(
    @Body()
    payload: {
      imageUrl: string;
      priceDiamonds: number;
      description?: string | null;
      isActive?: boolean;
    },
  ) {
    return this.backofficeService.createProfileCharacter(payload);
  }

  @Get('profile-characters')
  @ApiOperation({
    summary: '프로필 캐릭터 목록 조회',
    description: '관리자용 프로필 캐릭터 목록을 반환합니다.',
  })
  @ApiOkResponse({
    description: '프로필 캐릭터 목록 조회 성공',
  })
  async getProfileCharacters(): Promise<AdminProfileCharacterItem[]> {
    return this.backofficeService.getProfileCharactersForAdmin();
  }

  @Patch('profile-characters/:characterId')
  @ApiOperation({
    summary: '프로필 캐릭터 정보 수정',
    description: '가격과 노출 여부를 수정합니다.',
  })
  @ApiOkResponse({
    description: '프로필 캐릭터 수정 성공',
    schema: {
      example: {
        id: 10,
        updated: true,
      },
    },
  })
  async updateProfileCharacter(
    @Param('characterId') characterIdParam: string,
    @Body() payload: AdminProfileCharacterUpdateRequest,
  ) {
    const characterId = Number(characterIdParam);
    if (!Number.isInteger(characterId) || characterId <= 0) {
      throw new BadRequestException('유효한 캐릭터 ID가 필요합니다.');
    }

    return this.backofficeService.updateProfileCharacterForAdmin(characterId, payload);
  }

  @Post('profile-characters/upload')
  @UseInterceptors(FilesInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: '프로필 캐릭터 대량 업로드 (JSONL)',
    description: 'JSONL 파일을 통해 프로필 캐릭터를 일괄 업서트합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({
    description: '업로드 결과 요약',
    schema: {
      example: {
        processed: 10,
        charactersCreated: 8,
        charactersUpdated: 2,
      },
    },
  })
  async uploadProfileCharacters(
    @UploadedFiles() files: UploadedQuizFile[],
  ): Promise<ProfileCharacterUploadSummary> {
    if (!files || files.length === 0) {
      throw new BadRequestException('업로드된 파일이 없습니다.');
    }

    const summary: ProfileCharacterUploadSummary = {
      processed: 0,
      charactersCreated: 0,
      charactersUpdated: 0,
    };

    for (const file of files) {
      const fileSummary = await this.backofficeService.uploadProfileCharactersFromJsonl(
        file.buffer,
      );
      summary.processed += fileSummary.processed;
      summary.charactersCreated += fileSummary.charactersCreated;
      summary.charactersUpdated += fileSummary.charactersUpdated;
    }

    return summary;
  }
}
