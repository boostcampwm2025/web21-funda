import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { CacheLoadCoordinator } from '../common/cache/cache-load-coordinator';
import type { CacheStore } from '../common/cache/cache-store';
import { rankingCacheCounter } from '../metrics/experiment-metrics';
import { User } from '../users/entities/user.entity';

import { RankingGroup } from './entities/ranking-group.entity';
import { RankingGroupMember } from './entities/ranking-group-member.entity';
import { RankingTier } from './entities/ranking-tier.entity';
import { RankingTierName } from './entities/ranking-tier.enum';
import { RankingTierRule } from './entities/ranking-tier-rule.entity';
import { RankingWeek } from './entities/ranking-week.entity';
import { RankingWeeklyXp } from './entities/ranking-weekly-xp.entity';
import { RankingQueryService } from './ranking-query.service';

jest.mock('../metrics/experiment-metrics', () => ({
  rankingCacheCounter: {
    inc: jest.fn(),
  },
}));

describe('RankingQueryService', () => {
  let service: RankingQueryService;
  let weekRepository: Partial<Repository<RankingWeek>>;
  let groupRepository: Partial<Repository<RankingGroup>>;
  let memberRepository: Partial<Repository<RankingGroupMember>>;
  let weeklyXpRepository: Partial<Repository<RankingWeeklyXp>>;
  let tierRepository: Partial<Repository<RankingTier>>;
  let tierRuleRepository: Partial<Repository<RankingTierRule>>;
  let userRepository: Partial<Repository<User>>;
  let cacheStore: Partial<CacheStore>;
  let cacheLoadCoordinator: Partial<CacheLoadCoordinator>;
  const incrementCacheCounter = rankingCacheCounter.inc as jest.Mock;

  beforeEach(() => {
    incrementCacheCounter.mockClear();
    weekRepository = { findOne: jest.fn() };
    groupRepository = { findOne: jest.fn() };
    memberRepository = { findOne: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn() };
    weeklyXpRepository = { find: jest.fn() };
    tierRepository = { findOne: jest.fn() };
    tierRuleRepository = { findOne: jest.fn() };
    userRepository = { findOne: jest.fn() };
    cacheStore = { get: jest.fn(), set: jest.fn() };
    cacheLoadCoordinator = { getOrLoad: jest.fn() };

    service = new RankingQueryService(
      weekRepository as Repository<RankingWeek>,
      groupRepository as Repository<RankingGroup>,
      memberRepository as Repository<RankingGroupMember>,
      weeklyXpRepository as Repository<RankingWeeklyXp>,
      tierRepository as Repository<RankingTier>,
      tierRuleRepository as Repository<RankingTierRule>,
      userRepository as Repository<User>,
      cacheStore as CacheStore,
      cacheLoadCoordinator as CacheLoadCoordinator,
    );
  });

  it('내 티어를 반환한다', async () => {
    const tier = { id: 10, name: RankingTierName.SILVER, orderIndex: 2 } as RankingTier;
    const user = { id: 1, currentTier: tier, diamondCount: 15 } as User;

    (userRepository.findOne as jest.Mock).mockResolvedValue(user);

    const result = await service.getMyTier(1);

    expect(result.tier?.id).toBe(10);
    expect(result.diamondCount).toBe(15);
  });

  it('사용자가 없으면 예외를 발생시킨다', async () => {
    (userRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.getMyTier(999)).rejects.toThrow(NotFoundException);
  });

  it('주간 랭킹을 그룹 기준으로 정렬해서 반환한다', async () => {
    const week = { id: 1, weekKey: '2025-01' } as RankingWeek;
    const tier = { id: 3, name: RankingTierName.GOLD, orderIndex: 3 } as RankingTier;
    const tierRule = {
      tierId: 3,
      promoteMinXp: 0,
      demoteMinXp: 0,
      promoteRatio: '0.5',
      demoteRatio: '0.5',
      isMaster: false,
    } as RankingTierRule;
    const group = { id: 7, groupIndex: 1 } as RankingGroup;
    const member = { weekId: 1, userId: 1, tier, group, groupId: 7 } as RankingGroupMember;
    const members = [
      { userId: 1, joinedAt: new Date('2025-01-02'), user: { displayName: 'A' } },
      { userId: 2, joinedAt: new Date('2025-01-01'), user: { displayName: 'B' } },
    ] as RankingGroupMember[];
    const weeklyXpList = [
      { userId: 1, xp: 9, lastSolvedAt: new Date('2025-01-02') },
      { userId: 2, xp: 6, lastSolvedAt: new Date('2025-01-01') },
    ] as RankingWeeklyXp[];

    (weekRepository.findOne as jest.Mock).mockResolvedValue(week);
    (memberRepository.findOne as jest.Mock).mockResolvedValue(member);
    (memberRepository.find as jest.Mock).mockResolvedValue(members);
    (weeklyXpRepository.find as jest.Mock).mockResolvedValue(weeklyXpList);
    (tierRuleRepository.findOne as jest.Mock).mockResolvedValue(tierRule);

    const result = await service.getWeeklyRanking(1, '2025-01');

    expect(result.members[0]?.userId).toBe(1);
    expect(result.members[0]?.rank).toBe(1);
    expect(result.members[0]?.rankZone).toBe('PROMOTION');
    expect(result.myRank).toBe(1);
    expect(result.tier?.id).toBe(3);
    expect(incrementCacheCounter).toHaveBeenCalledWith({ cache: 'weekly', result: 'miss' });
  });

  it('주간 랭킹 캐시가 있으면 조회 결과를 반환하고 히트를 기록한다', async () => {
    const cachedResult = {
      weekKey: '2025-01',
      tier: null,
      groupIndex: null,
      totalMembers: 0,
      myRank: null,
      myWeeklyXp: 0,
      members: [],
    };
    (cacheStore.get as jest.Mock).mockResolvedValue(cachedResult);

    const result = await service.getWeeklyRanking(1, '2025-01');

    expect(result).toBe(cachedResult);
    expect(incrementCacheCounter).toHaveBeenCalledWith({ cache: 'weekly', result: 'hit' });
    expect(weekRepository.findOne).not.toHaveBeenCalled();
  });

  it('주간 전체 랭킹을 XP 기준으로 정렬해 반환한다', async () => {
    const week = { id: 1, weekKey: '2025-01' } as RankingWeek;
    const goldTier = { id: 3, name: RankingTierName.GOLD, orderIndex: 3 } as RankingTier;
    const silverTier = { id: 2, name: RankingTierName.SILVER, orderIndex: 2 } as RankingTier;
    const members = [
      {
        userId: 1,
        joinedAt: new Date('2025-01-02'),
        tier: silverTier,
        user: { displayName: 'SilverHigh' },
      },
      {
        userId: 2,
        joinedAt: new Date('2025-01-01'),
        tier: goldTier,
        user: { displayName: 'GoldLow' },
      },
      {
        userId: 3,
        joinedAt: new Date('2025-01-03'),
        tier: goldTier,
        user: { displayName: 'GoldHigh' },
      },
    ] as RankingGroupMember[];
    const weeklyXpList = [
      { userId: 1, xp: 900, lastSolvedAt: new Date('2025-01-02') },
      { userId: 2, xp: 500, lastSolvedAt: new Date('2025-01-01') },
      { userId: 3, xp: 800, lastSolvedAt: new Date('2025-01-03') },
    ] as RankingWeeklyXp[];

    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawAndEntities: jest.fn().mockResolvedValue({
        raw: [
          {
            weeklyXp_xp: weeklyXpList[0]?.xp,
            weeklyXp_firstSolvedAt: weeklyXpList[0]?.lastSolvedAt,
            weeklyXp_lastSolvedAt: weeklyXpList[0]?.lastSolvedAt,
          },
          {
            weeklyXp_xp: weeklyXpList[1]?.xp,
            weeklyXp_firstSolvedAt: weeklyXpList[1]?.lastSolvedAt,
            weeklyXp_lastSolvedAt: weeklyXpList[1]?.lastSolvedAt,
          },
          {
            weeklyXp_xp: weeklyXpList[2]?.xp,
            weeklyXp_firstSolvedAt: weeklyXpList[2]?.lastSolvedAt,
            weeklyXp_lastSolvedAt: weeklyXpList[2]?.lastSolvedAt,
          },
        ],
        entities: members,
      }),
    };

    (weekRepository.findOne as jest.Mock).mockResolvedValue(week);
    (memberRepository.createQueryBuilder as jest.Mock).mockReturnValue(queryBuilder);

    const result = await service.getOverallWeeklyRanking(3, '2025-01');

    expect(result.members[0]?.displayName).toBe('SilverHigh');
    expect(result.members[1]?.displayName).toBe('GoldHigh');
    expect(result.members[2]?.displayName).toBe('GoldLow');
    expect(result.members[0]?.tierName).toBe(RankingTierName.SILVER);
    expect(result.members[2]?.tierName).toBe(RankingTierName.GOLD);
    expect(result.myRank).toBe(2);
    expect(incrementCacheCounter).toHaveBeenCalledWith({ cache: 'overall', result: 'miss' });
  });

  it('주간 전체 랭킹 캐시가 있으면 조회 결과를 반환하고 히트를 기록한다', async () => {
    const cachedResult = {
      weekKey: '2025-01',
      totalMembers: 0,
      myRank: null,
      myWeeklyXp: 0,
      members: [],
    };
    (cacheStore.get as jest.Mock).mockResolvedValue(cachedResult);

    const result = await service.getOverallWeeklyRanking(1, '2025-01');

    expect(result).toBe(cachedResult);
    expect(incrementCacheCounter).toHaveBeenCalledWith({ cache: 'overall', result: 'hit' });
    expect(weekRepository.findOne).not.toHaveBeenCalled();
  });

  it('관리자 조회에서 티어가 없으면 예외를 발생시킨다', async () => {
    (tierRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.getWeeklyRankingByGroup(99, 1, '2025-01')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('관리자 조회에서 그룹이 없으면 빈 결과를 반환한다', async () => {
    const tier = { id: 3, name: RankingTierName.GOLD, orderIndex: 3 } as RankingTier;
    const week = { id: 1, weekKey: '2025-01' } as RankingWeek;

    (tierRepository.findOne as jest.Mock).mockResolvedValue(tier);
    (weekRepository.findOne as jest.Mock).mockResolvedValue(week);
    (groupRepository.findOne as jest.Mock).mockResolvedValue(null);

    const result = await service.getWeeklyRankingByGroup(3, 2, '2025-01');

    expect(result.tier?.id).toBe(3);
    expect(result.groupIndex).toBe(2);
    expect(result.members).toHaveLength(0);
  });
});
