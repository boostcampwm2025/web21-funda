import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { ReportStatus } from '../entities/report-status.enum';

export class UpdateReportStatusDto {
  @ApiProperty({
    enum: ReportStatus,
    description: '신고 처리 상태',
    example: ReportStatus.RESOLVED,
  })
  @IsEnum(ReportStatus)
  status!: ReportStatus;
}
