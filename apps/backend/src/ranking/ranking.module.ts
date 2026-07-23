import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CACHE_STORE } from '../common/cache/cache-store';
import { RedisService } from '../common/redis/redis.service';
import { User } from '../users/entities/user.entity';

import { RankingGroup } from './entities/ranking-group.entity';
import { RankingGroupMember } from './entities/ranking-group-member.entity';
import { RankingRewardHistory } from './entities/ranking-reward-history.entity';
import { RankingTier } from './entities/ranking-tier.entity';
import { RankingTierChangeHistory } from './entities/ranking-tier-change-history.entity';
import { RankingTierRule } from './entities/ranking-tier-rule.entity';
import { RankingWeek } from './entities/ranking-week.entity';
import { RankingWeeklySnapshot } from './entities/ranking-weekly-snapshot.entity';
import { RankingWeeklyXp } from './entities/ranking-weekly-xp.entity';
import { AdminRankingController } from './admin-ranking.controller';
import { RankingController } from './ranking.controller';
import { RankingService } from './ranking.service';
import { RankingEvaluationService } from './ranking-evaluation.service';
import { RankingQueryService } from './ranking-query.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RankingWeek,
      RankingTier,
      RankingTierRule,
      RankingGroup,
      RankingGroupMember,
      RankingRewardHistory,
      RankingTierChangeHistory,
      RankingWeeklyXp,
      RankingWeeklySnapshot,
      User,
    ]),
  ],
  controllers: [RankingController, AdminRankingController],
  providers: [
    RankingService,
    RankingEvaluationService,
    RankingQueryService,
    RedisService,
    {
      provide: CACHE_STORE,
      useExisting: RedisService,
    },
  ],
  exports: [RankingService],
})
export class RankingModule {}
