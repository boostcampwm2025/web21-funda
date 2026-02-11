import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RedisService } from '../common/redis/redis.service';
import { CodeFormatter } from '../common/utils/code-formatter';
import { ProfileCharacter } from '../profile/entities/profile-character.entity';
import { Field } from '../roadmap/entities/field.entity';
import { Quiz } from '../roadmap/entities/quiz.entity';
import { Step } from '../roadmap/entities/step.entity';
import { Unit } from '../roadmap/entities/unit.entity';

import { BackofficeController } from './backoffice.controller';
import { BackofficeService } from './backoffice.service';

@Module({
  imports: [TypeOrmModule.forFeature([Field, Unit, Step, Quiz, ProfileCharacter])],
  controllers: [BackofficeController],
  providers: [BackofficeService, RedisService, CodeFormatter],
})
export class BackofficeModule {}
