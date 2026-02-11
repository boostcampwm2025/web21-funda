import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Quiz } from '../roadmap/entities/quiz.entity';
import { User } from '../users/entities/user.entity';

import { Report } from './entities/report.entity';

export interface ReportAdminRow {
  id: number;
  quizId: number;
  report_description: string;
  createdAt: Date;
  question: string | null;
  userId: number | null;
  userDisplayName: string | null;
  userEmail: string | null;
}

export interface PaginatedReportAdminResult {
  items: ReportAdminRow[];
  total: number;
}

@Injectable()
export class ReportService {
  constructor(@InjectRepository(Report) private repo: Repository<Report>) {}

  private buildAdminReportQueryBuilder() {
    return this.repo
      .createQueryBuilder('report')
      .leftJoin(Quiz, 'quiz', 'quiz.id = report.quizId')
      .leftJoin(User, 'user', 'user.id = report.userId')
      .select([
        'report.id AS id',
        'report.quizId AS quizId',
        'report.report_description AS report_description',
        'report.createdAt AS createdAt',
        'quiz.question AS question',
        'user.id AS userId',
        'user.displayName AS userDisplayName',
        'user.email AS userEmail',
      ]);
  }

  async create(quizId: number, userId: number | null, report_description: string) {
    const entity = this.repo.create({ quizId, userId, report_description });
    return await this.repo.save(entity);
  }

  async findAll(page: number, limit: number): Promise<PaginatedReportAdminResult> {
    const total = await this.repo.count();

    const items = await this.buildAdminReportQueryBuilder()
      .orderBy('report.createdAt', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    return { items, total };
  }

  async findOne(reportId: number): Promise<ReportAdminRow | null> {
    const row = await this.buildAdminReportQueryBuilder()
      .where('report.id = :reportId', { reportId })
      .getRawOne();

    return (row ?? null) as ReportAdminRow | null;
  }
}
