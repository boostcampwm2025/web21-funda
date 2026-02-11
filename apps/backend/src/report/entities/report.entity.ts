import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Quiz } from '../../roadmap/entities/quiz.entity';
import { User } from '../../users/entities/user.entity';

import { ReportStatus } from './report-status.enum';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'quiz_id', type: 'int' })
  quizId!: number;

  @ManyToOne(() => Quiz, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz!: Quiz;

  @Column({ name: 'user_id', type: 'bigint', nullable: true })
  userId?: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column({ name: 'report_description', type: 'varchar', length: 1000 })
  report_description!: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status!: ReportStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
