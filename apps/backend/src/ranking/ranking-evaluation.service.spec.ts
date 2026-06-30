import { DataSource, EntityManager, Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';

import { RankingGroup } from './entities/ranking-group.entity';
import { RankingGroupMember } from './entities/ranking-group-member.entity';
import { RankingRewardHistory } from './entities/ranking-reward-history.entity';
import { RankingTier } from './entities/ranking-tier.entity';
import { RankingTierName } from './entities/ranking-tier.enum';
import { RankingTierChangeHistory } from './entities/ranking-tier-change-history.entity';
import { RankingTierRule } from './entities/ranking-tier-rule.entity';
import { RankingWeek } from './entities/ranking-week.entity';
import { RankingWeekStatus } from './entities/ranking-week-status.enum';
import { RankingWeeklySnapshot } from './entities/ranking-weekly-snapshot.entity';
import { RankingWeeklyXp } from './entities/ranking-weekly-xp.entity';
import { RankingEvaluationService } from './ranking-evaluation.service';

describe('RankingEvaluationService', () => {
  let service: RankingEvaluationService;
  let dataSource: Partial<DataSource>;
  let weekRepository: Partial<Repository<RankingWeek>>;
  let tierRepository: Partial<Repository<RankingTier>>;
  let ruleRepository: Partial<Repository<RankingTierRule>>;
  let groupRepository: Partial<Repository<RankingGroup>>;
  let memberRepository: Partial<Repository<RankingGroupMember>>;
  let weeklyXpRepository: Partial<Repository<RankingWeeklyXp>>;
  let snapshotRepository: Partial<Repository<RankingWeeklySnapshot>>;
  let tierChangeRepository: Partial<Repository<RankingTierChangeHistory>>;
  let rewardRepository: Partial<Repository<RankingRewardHistory>>;
  let userRepository: Partial<Repository<User>>;

  // 브론즈 1명이 승급해 다이아 보상을 받는 최소 시나리오를 구성한다.
  const bronzeTier = { id: 10, name: RankingTierName.BRONZE, orderIndex: 1 } as RankingTier;
  const silverTier = { id: 11, name: RankingTierName.SILVER, orderIndex: 2 } as RankingTier;
  const bronzeRule = {
    tierId: 10,
    isMaster: false,
    promoteRatio: '1',
    demoteRatio: '0',
    promoteMinXp: 0,
    demoteMinXp: 0,
  } as RankingTierRule;
  const silverRule = {
    tierId: 11,
    isMaster: true,
    promoteRatio: '0',
    demoteRatio: '0',
    promoteMinXp: 0,
    demoteMinXp: 0,
  } as RankingTierRule;

  const setupHappyPath = (week: RankingWeek): void => {
    const group = {
      id: 100,
      weekId: week.id,
      tierId: bronzeTier.id,
      groupIndex: 1,
    } as RankingGroup;
    const solvedAt = new Date('2025-01-06T00:00:00Z');
    const member = { userId: 5, joinedAt: solvedAt } as RankingGroupMember;
    const weeklyXp = {
      userId: 5,
      xp: 100,
      lastSolvedAt: solvedAt,
      firstSolvedAt: solvedAt,
    } as RankingWeeklyXp;

    (weekRepository.findOne as jest.Mock).mockResolvedValue(week);
    (tierRepository.find as jest.Mock).mockResolvedValue([bronzeTier, silverTier]);
    (ruleRepository.find as jest.Mock).mockResolvedValue([bronzeRule, silverRule]);
    (groupRepository.find as jest.Mock).mockImplementation(
      (options: { where: { tierId: number } }) =>
        options.where.tierId === bronzeTier.id ? [group] : [],
    );
    (memberRepository.find as jest.Mock).mockResolvedValue([member]);
    (weeklyXpRepository.find as jest.Mock).mockResolvedValue([weeklyXp]);
  };

  beforeEach(() => {
    weekRepository = { findOne: jest.fn(), save: jest.fn() };
    tierRepository = { find: jest.fn().mockResolvedValue([]) };
    ruleRepository = { find: jest.fn().mockResolvedValue([]) };
    groupRepository = { find: jest.fn().mockResolvedValue([]) };
    memberRepository = { find: jest.fn().mockResolvedValue([]) };
    weeklyXpRepository = { find: jest.fn().mockResolvedValue([]) };
    snapshotRepository = {
      create: jest.fn(entity => entity),
      save: jest.fn(),
    } as unknown as Partial<Repository<RankingWeeklySnapshot>>;
    tierChangeRepository = {
      create: jest.fn(entity => entity),
      save: jest.fn(),
    } as unknown as Partial<Repository<RankingTierChangeHistory>>;
    rewardRepository = { create: jest.fn(entity => entity), save: jest.fn() } as unknown as Partial<
      Repository<RankingRewardHistory>
    >;
    userRepository = { increment: jest.fn(), update: jest.fn() };

    const getRepository = jest.fn(entity => {
      switch (entity) {
        case RankingWeek:
          return weekRepository;
        case RankingTier:
          return tierRepository;
        case RankingTierRule:
          return ruleRepository;
        case RankingGroup:
          return groupRepository;
        case RankingGroupMember:
          return memberRepository;
        case RankingWeeklyXp:
          return weeklyXpRepository;
        case RankingWeeklySnapshot:
          return snapshotRepository;
        case RankingTierChangeHistory:
          return tierChangeRepository;
        case RankingRewardHistory:
          return rewardRepository;
        case User:
          return userRepository;
        default:
          throw new Error('알 수 없는 Repository 요청');
      }
    });

    const manager = { getRepository } as unknown as EntityManager;

    dataSource = {
      transaction: jest.fn(async (...args: unknown[]) => {
        const callback = typeof args[0] === 'function' ? args[0] : args[1];
        if (typeof callback !== 'function') {
          throw new Error('transaction 콜백이 없습니다.');
        }
        return callback(manager);
      }),
    };

    service = new RankingEvaluationService(dataSource as DataSource);
  });

  it('비관적 쓰기 락으로 주차를 조회한다', async () => {
    const week = { id: 1, status: RankingWeekStatus.EVALUATED } as RankingWeek;
    (weekRepository.findOne as jest.Mock).mockResolvedValue(week);

    await service.evaluateWeek(1);

    expect(weekRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
  });

  it('존재하지 않는 주차는 아무 작업도 하지 않는다', async () => {
    (weekRepository.findOne as jest.Mock).mockResolvedValue(null);

    await service.evaluateWeek(999);

    expect(weekRepository.save).not.toHaveBeenCalled();
    expect(userRepository.increment).not.toHaveBeenCalled();
    expect(snapshotRepository.save).not.toHaveBeenCalled();
  });

  it('이미 평가된 주차는 다시 평가하지 않는다 (멱등 가드)', async () => {
    const week = { id: 1, status: RankingWeekStatus.EVALUATED } as RankingWeek;
    (weekRepository.findOne as jest.Mock).mockResolvedValue(week);

    await service.evaluateWeek(1);

    // 상태 전이도, 지급도 일어나지 않아야 한다.
    expect(weekRepository.save).not.toHaveBeenCalled();
    expect(userRepository.increment).not.toHaveBeenCalled();
    expect(snapshotRepository.save).not.toHaveBeenCalled();
  });

  it('정상 평가는 보상을 원자적으로 지급하고 평가 완료로 확정한다', async () => {
    const week = { id: 1, status: RankingWeekStatus.OPEN } as RankingWeek;
    setupHappyPath(week);

    await service.evaluateWeek(1);

    // 승급자에게 다이아를 increment로 적립한다.
    expect(userRepository.increment).toHaveBeenCalledTimes(1);
    expect(userRepository.increment).toHaveBeenCalledWith({ id: 5 }, 'diamondCount', 10);
    // 주차를 평가 완료로 확정한다.
    expect(week.status).toBe(RankingWeekStatus.EVALUATED);
    expect(week.evaluatedAt).toBeDefined();
  });

  it('같은 주차를 두 번 평가해도 보상은 한 번만 지급된다 (재실행 멱등성)', async () => {
    const week = { id: 1, status: RankingWeekStatus.OPEN } as RankingWeek;
    setupHappyPath(week);

    await service.evaluateWeek(1);
    // 첫 평가로 week.status가 EVALUATED가 됐으므로, 두 번째 호출은 멱등 가드에 걸린다.
    await service.evaluateWeek(1);

    expect(userRepository.increment).toHaveBeenCalledTimes(1);
  });
});
