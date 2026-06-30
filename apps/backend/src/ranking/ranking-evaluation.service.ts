import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, LessThanOrEqual } from 'typeorm';

import { getKstNow } from '../common/utils/kst-date';
import { User } from '../users/entities/user.entity';

import { RankingGroup } from './entities/ranking-group.entity';
import { RankingGroupMember } from './entities/ranking-group-member.entity';
import { RankingRewardHistory } from './entities/ranking-reward-history.entity';
import { RankingRewardType } from './entities/ranking-reward-type.enum';
import { RankingSnapshotStatus } from './entities/ranking-snapshot-status.enum';
import { RankingTier } from './entities/ranking-tier.entity';
import { RankingTierName } from './entities/ranking-tier.enum';
import { RankingTierChangeHistory } from './entities/ranking-tier-change-history.entity';
import { RankingTierChangeReason } from './entities/ranking-tier-change-reason.enum';
import { RankingTierRule } from './entities/ranking-tier-rule.entity';
import { RankingWeek } from './entities/ranking-week.entity';
import { RankingWeekStatus } from './entities/ranking-week-status.enum';
import { RankingWeeklySnapshot } from './entities/ranking-weekly-snapshot.entity';
import { RankingWeeklyXp } from './entities/ranking-weekly-xp.entity';
import { buildRankingSnapshots, resolveTierChange } from './ranking-evaluation.utils';

// 한 주차 평가 결과를 모아 두는 중간 타입
interface WeekEvaluationResult {
  snapshots: RankingWeeklySnapshot[];
  tierChanges: RankingTierChangeHistory[];
  rewardHistories: RankingRewardHistory[];
  tierUpdates: Array<{ userId: number; tierId: number }>;
  rewardAmountByUser: Map<number, number>;
}

@Injectable()
export class RankingEvaluationService {
  private readonly logger = new Logger(RankingEvaluationService.name);
  private readonly promotionRewardByTierOrder = new Map<number, number>([
    [1, 0],
    [2, 10],
    [3, 20],
    [4, 40],
    [5, 60],
    [6, 100],
  ]);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private getPromotionRewardAmount(tier: RankingTier): number {
    // 보상 수량이 확정되기 전까지는 임시 정책을 사용한다.
    return this.promotionRewardByTierOrder.get(tier.orderIndex) ?? 0;
  }

  // 매주 월요일 00:05(KST), 종료됐지만 아직 평가 안 된 주차를 처리한다.
  // 한 주차가 실패해도 나머지는 계속 평가한다.
  @Cron('5 0 * * 1', { timeZone: 'Asia/Seoul' })
  async handleWeeklyEvaluation(): Promise<void> {
    const now = getKstNow();
    const weekRepository = this.dataSource.getRepository(RankingWeek);

    const targetWeeks = await weekRepository.find({
      where: {
        status: In([RankingWeekStatus.OPEN, RankingWeekStatus.LOCKED]),
        endsAt: LessThanOrEqual(now),
      },
      order: { endsAt: 'ASC' },
    });

    for (const week of targetWeeks) {
      try {
        await this.evaluateWeek(week.id);
      } catch (error: unknown) {
        this.logger.error(
          `주간 평가 실패: weekId=${week.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  // 한 주차를 평가하고 보상을 지급한다.
  // 락과 평가 완료 상태 검사로 같은 주차가 중복 처리되지 않게 한 트랜잭션으로 묶는다.
  async evaluateWeek(weekId: number): Promise<void> {
    await this.dataSource.transaction(async manager => {
      const week = await this.lockAndMarkInProgress(manager, weekId);
      if (!week) {
        return;
      }

      const result = await this.computeEvaluation(manager, week);
      await this.persistEvaluation(manager, result);
      await this.finalizeWeek(manager, week);
    });
  }

  // 주차를 락으로 잠그고 진행 상태로 바꾼다. 없거나 이미 평가됐으면 null을 반환한다.
  private async lockAndMarkInProgress(
    manager: EntityManager,
    weekId: number,
  ): Promise<RankingWeek | null> {
    const weekRepository = manager.getRepository(RankingWeek);

    const week = await weekRepository.findOne({
      where: { id: weekId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!week) {
      return null;
    }

    if (week.status === RankingWeekStatus.EVALUATED) {
      return null;
    }

    week.status = RankingWeekStatus.LOCKED;
    await weekRepository.save(week);
    return week;
  }

  // 티어와 그룹을 돌며 스냅샷, 티어 변동, 보상 내역을 계산한다. 읽기만 하고 저장은 하지 않는다.
  private async computeEvaluation(
    manager: EntityManager,
    week: RankingWeek,
  ): Promise<WeekEvaluationResult> {
    const tierRepository = manager.getRepository(RankingTier);
    const ruleRepository = manager.getRepository(RankingTierRule);
    const groupRepository = manager.getRepository(RankingGroup);
    const memberRepository = manager.getRepository(RankingGroupMember);
    const weeklyXpRepository = manager.getRepository(RankingWeeklyXp);
    const snapshotRepository = manager.getRepository(RankingWeeklySnapshot);
    const tierChangeRepository = manager.getRepository(RankingTierChangeHistory);
    const rewardRepository = manager.getRepository(RankingRewardHistory);

    const tiers = await tierRepository.find({ order: { orderIndex: 'ASC' } });
    const rules = await ruleRepository.find();
    const ruleByTierId = new Map<number, RankingTierRule>(rules.map(rule => [rule.tierId, rule]));
    const tierById = new Map<number, RankingTier>(tiers.map(tier => [tier.id, tier]));

    const result: WeekEvaluationResult = {
      snapshots: [],
      tierChanges: [],
      rewardHistories: [],
      tierUpdates: [],
      rewardAmountByUser: new Map<number, number>(),
    };

    for (const tier of tiers) {
      const rule = ruleByTierId.get(tier.id);
      if (!rule) {
        this.logger.warn(`티어 룰셋이 없습니다: tierId=${tier.id}`);
        continue;
      }

      const groups = await groupRepository.find({
        where: { weekId: week.id, tierId: tier.id },
        order: { groupIndex: 'ASC' },
      });

      for (const group of groups) {
        const members = await memberRepository.find({
          where: { groupId: group.id },
          order: { joinedAt: 'ASC' },
        });
        if (members.length === 0) {
          continue;
        }

        const memberIds = members.map(member => member.userId);
        const weeklyXpList = await weeklyXpRepository.find({
          where: { weekId: week.id, userId: In(memberIds) },
        });
        const weeklyXpMap = new Map(weeklyXpList.map(item => [item.userId, item]));

        const scores = members.map(member => {
          const weeklyXp = weeklyXpMap.get(member.userId);
          const lastSolvedAt = weeklyXp?.lastSolvedAt ?? weeklyXp?.firstSolvedAt ?? member.joinedAt;

          return {
            userId: member.userId,
            xp: weeklyXp?.xp ?? 0,
            lastSolvedAt,
          };
        });

        const snapshotDrafts = buildRankingSnapshots({ members: scores, rule });

        for (const draft of snapshotDrafts) {
          result.snapshots.push(
            snapshotRepository.create({
              weekId: week.id,
              tierId: tier.id,
              groupId: group.id,
              userId: draft.userId,
              rank: draft.rank,
              xp: draft.xp,
              status: draft.status ?? RankingSnapshotStatus.MAINTAINED,
              promoteCutXp: draft.promoteCutXp,
              demoteCutXp: draft.demoteCutXp,
            }),
          );

          const tierChange = resolveTierChange({
            tiers,
            tierId: tier.id,
            status: draft.status,
          });

          result.tierChanges.push(
            tierChangeRepository.create({
              weekId: week.id,
              userId: draft.userId,
              fromTierId: tierChange.fromTierId,
              toTierId: tierChange.toTierId,
              reason: tierChange.reason,
            }),
          );

          if (tierChange.toTierId !== tierChange.fromTierId) {
            result.tierUpdates.push({
              userId: draft.userId,
              tierId: tierChange.toTierId,
            });
          }

          const isMasterMaintain =
            tier.name === RankingTierName.MASTER &&
            tierChange.reason === RankingTierChangeReason.MAINTAIN;
          if (tierChange.reason === RankingTierChangeReason.PROMOTION || isMasterMaintain) {
            const rewardTier = isMasterMaintain ? tier : tierById.get(tierChange.toTierId);
            const rewardAmount = rewardTier ? this.getPromotionRewardAmount(rewardTier) : 0;

            result.rewardHistories.push(
              rewardRepository.create({
                weekId: week.id,
                userId: draft.userId,
                tierId: rewardTier?.id ?? tier.id,
                rewardType: RankingRewardType.DIAMOND,
                amount: rewardAmount,
              }),
            );

            if (rewardAmount > 0) {
              const currentAmount = result.rewardAmountByUser.get(draft.userId) ?? 0;
              result.rewardAmountByUser.set(draft.userId, currentAmount + rewardAmount);
            }
          }
        }
      }
    }

    return result;
  }

  // 계산 결과를 저장하고 보상을 지급한다. 다이아는 increment로 적립해 동시 적립에도 값이 유지된다.
  private async persistEvaluation(
    manager: EntityManager,
    result: WeekEvaluationResult,
  ): Promise<void> {
    const snapshotRepository = manager.getRepository(RankingWeeklySnapshot);
    const tierChangeRepository = manager.getRepository(RankingTierChangeHistory);
    const rewardRepository = manager.getRepository(RankingRewardHistory);
    const userRepository = manager.getRepository(User);

    if (result.snapshots.length > 0) {
      await snapshotRepository.save(result.snapshots);
    }

    if (result.tierChanges.length > 0) {
      await tierChangeRepository.save(result.tierChanges);
    }

    if (result.rewardHistories.length > 0) {
      await rewardRepository.save(result.rewardHistories);
    }

    for (const [userId, amount] of result.rewardAmountByUser.entries()) {
      await userRepository.increment({ id: userId }, 'diamondCount', amount);
    }

    for (const update of result.tierUpdates) {
      await userRepository.update(update.userId, { currentTierId: update.tierId });
    }
  }

  // 주차를 평가 완료로 표시한다. 커밋 이후에는 멱등 가드에 걸려 다시 처리되지 않는다.
  private async finalizeWeek(manager: EntityManager, week: RankingWeek): Promise<void> {
    const weekRepository = manager.getRepository(RankingWeek);
    week.status = RankingWeekStatus.EVALUATED;
    week.evaluatedAt = getKstNow();
    await weekRepository.save(week);
  }
}
