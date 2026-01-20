import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import type { QuizResponse } from './dto/quiz-list.dto';
import { RoadmapService } from './roadmap.service';

@ApiTags('Steps')
@Controller('steps')
export class StepsController {
  constructor(private readonly roadmapService: RoadmapService) {}

  @Get(':stepId/quizzes')
  @ApiOperation({
    summary: '스텝별 퀴즈 목록 조회',
    description: '스텝 ID에 해당하는 퀴즈 목록을 랜덤으로 섞어서 반환한다.',
  })
  @ApiParam({ name: 'stepId', description: '스텝 ID', example: 10 })
  @ApiQuery({ name: 'limit', description: '반환할 퀴즈 개수', example: 10, required: false })
  async getQuizzesByStepId(
    @Param('stepId', ParseIntPipe) stepId: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<QuizResponse[]> {
    return this.roadmapService.getQuizzesByStepId(stepId, limit);
  }
}
