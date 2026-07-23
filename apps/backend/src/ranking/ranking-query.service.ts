import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CACHE_TTL_SECONDS, CacheKeys } from '../common/cache/cache-keys';
import { CacheLoadCoordinator, type CacheLoadSource } from '../common/cache/cache-load-coordinator';
import { CACHE_STORE, type CacheStore } from '../common/cache/cache-store';
import { getKstNow, getKstWeekInfo } from '../common/utils/kst-date';
import { rankingCacheCounter } from '../metrics/experiment-metrics';
import { User } from '../users/entities/user.entity';

import type {
  MyTierResult,
  OverallRankingEntry,
  OverallRankingResult,
  RankingTierSummary,
  RankingZone,
  WeeklyRankingEntry,
  WeeklyRankingResult,
} from './dto/ranking.dto';
import { RankingGroup } from './entities/ranking-group.entity';
import { RankingGroupMember } from './entities/ranking-group-member.entity';
import { RankingSnapshotStatus } from './entities/ranking-snapshot-status.enum';
import { RankingTier } from './entities/ranking-tier.entity';
import { RankingTierName } from './entities/ranking-tier.enum';
import { RankingTierRule } from './entities/ranking-tier-rule.entity';
import { RankingWeek } from './entities/ranking-week.entity';
import { RankingWeeklyXp } from './entities/ranking-weekly-xp.entity';
import { buildRankingSnapshots } from './ranking-evaluation.utils';

/** 사용자별 필드를 제외한 그룹 공통 주간 랭킹. */
interface CachedWeeklyGroupRanking {
  weekKey: string;
  tier: RankingTierSummary | null;
  groupIndex: number;
  totalMembers: number;
  members: WeeklyRankingEntry[];
}

/** 주간 랭킹 조회에 필요한 사용자 소속 정보. */
type WeeklyMemberRef =
  | { kind: 'no-week' }
  | { kind: 'no-group' }
  | {
      kind: 'group';
      weekId: number;
      groupId: number;
      tierId: number | null;
      groupIndex: number;
      tier: RankingTierSummary | null;
    };

@Injectable()
export class RankingQueryService {
  constructor(
    @InjectRepository(RankingWeek)
    private readonly weekRepository: Repository<RankingWeek>,
    @InjectRepository(RankingGroup)
    private readonly groupRepository: Repository<RankingGroup>,
    @InjectRepository(RankingGroupMember)
    private readonly memberRepository: Repository<RankingGroupMember>,
    @InjectRepository(RankingWeeklyXp)
    private readonly weeklyXpRepository: Repository<RankingWeeklyXp>,
    @InjectRepository(RankingTier)
    private readonly tierRepository: Repository<RankingTier>,
    @InjectRepository(RankingTierRule)
    private readonly tierRuleRepository: Repository<RankingTierRule>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(CACHE_STORE)
    private readonly cacheStore: CacheStore,
    private readonly cacheLoadCoordinator: CacheLoadCoordinator,
  ) {}

  /**
   * 기존 캐시 경로를 유지하면서 그룹 캐시를 선택적으로 적용한다.
   * 환경변수가 없으면 기존 사용자 단위 캐시를 사용한다.
   */
  private readonly cacheGranularity: 'user' | 'group' =
    process.env.RANKING_CACHE_GRANULARITY === 'group' ? 'group' : 'user';

  /**
   * 현재 사용자 기준으로 티어 정보를 반환한다.
   *
   * @param userId 사용자 ID
   * @returns {Promise<MyTierResult>} 내 티어 정보
   */
  async getMyTier(userId: number): Promise<MyTierResult> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { currentTier: true },
    });
    if (!user) {
      throw new NotFoundException('사용자 정보를 찾을 수 없습니다.');
    }

    const fallbackTier = await this.findDefaultTier();
    const tier = user.currentTier ?? fallbackTier;

    return {
      tier: tier
        ? {
            id: tier.id,
            name: tier.name,
            orderIndex: tier.orderIndex,
          }
        : null,
      diamondCount: user.diamondCount,
    };
  }

  /**
   * 주간 랭킹을 그룹 기준으로 조회한다.
   *
   * @param userId 사용자 ID
   * @param weekKey 조회할 주차 키(없으면 현재 주차)
   * @returns {Promise<WeeklyRankingResult>} 주간 랭킹 정보
   */
  async getWeeklyRanking(userId: number, weekKey: string | null): Promise<WeeklyRankingResult> {
    const targetWeekKey = weekKey ?? getKstWeekInfo(getKstNow()).weekKey;
    if (this.cacheGranularity === 'group') {
      return this.getWeeklyRankingPerGroup(userId, targetWeekKey);
    }
    return this.getWeeklyRankingPerUser(userId, targetWeekKey);
  }

  /**
   * 기존 사용자 단위 캐시로 주간 랭킹을 조회한다.
   *
   * 그룹 캐시 적용 전 동작과의 호환을 위해 유지한다.
   *
   * @param userId 사용자 ID
   * @param targetWeekKey 조회할 주차 키
   * @returns 사용자 관점의 주간 랭킹
   */
  private async getWeeklyRankingPerUser(
    userId: number,
    targetWeekKey: string,
  ): Promise<WeeklyRankingResult> {
    const cached = await this.getCachedWeeklyRanking(userId, targetWeekKey);
    if (cached) {
      rankingCacheCounter.inc({ cache: 'weekly', result: 'hit' });
      return cached;
    }
    rankingCacheCounter.inc({ cache: 'weekly', result: 'miss' });

    const week = await this.weekRepository.findOne({ where: { weekKey: targetWeekKey } });

    if (!week) {
      return this.cacheWeeklyRanking(
        userId,
        targetWeekKey,
        this.buildEmptyWeeklyResult(targetWeekKey, null),
      );
    }

    const member = await this.memberRepository.findOne({
      where: { weekId: week.id, userId },
      relations: { tier: true, group: true },
    });

    if (!member || !member.group) {
      const fallbackTier = await this.findDefaultTier();
      return this.cacheWeeklyRanking(
        userId,
        targetWeekKey,
        this.buildEmptyWeeklyResult(targetWeekKey, this.toTierSummary(fallbackTier)),
      );
    }

    const result = await this.computeGroupRanking(
      targetWeekKey,
      week.id,
      member.groupId,
      member.tier?.id ?? null,
      member.group.groupIndex,
      this.toTierSummary(member.tier),
    );
    return this.cacheWeeklyRanking(
      userId,
      targetWeekKey,
      this.deriveUserWeeklyView(result, userId),
    );
  }

  /**
   * 그룹 공통 랭킹을 캐시하고 요청자별 필드를 덧붙인다.
   *
   * 그룹원마다 같은 랭킹을 따로 저장하지 않기 위해 공유 캐시를 사용한다.
   *
   * @param userId 사용자 ID
   * @param targetWeekKey 조회할 주차 키
   * @returns 사용자 관점의 주간 랭킹
   */
  private async getWeeklyRankingPerGroup(
    userId: number,
    targetWeekKey: string,
  ): Promise<WeeklyRankingResult> {
    const ref = await this.resolveWeeklyMemberRef(userId, targetWeekKey);

    if (ref.kind === 'no-week') {
      return this.buildEmptyWeeklyResult(targetWeekKey, null);
    }
    if (ref.kind === 'no-group') {
      const fallbackTier = await this.findDefaultTier();
      return this.buildEmptyWeeklyResult(targetWeekKey, this.toTierSummary(fallbackTier));
    }

    const cacheKey = CacheKeys.rankingWeeklyGroup(targetWeekKey, ref.groupId);

    const result = await this.cacheLoadCoordinator.getOrLoad<CachedWeeklyGroupRanking>({
      cacheKey,
      ttlSeconds: CACHE_TTL_SECONDS.ranking,
      isValid: (value): value is CachedWeeklyGroupRanking => this.isCachedGroupRanking(value),
      load: () =>
        this.computeGroupRanking(
          targetWeekKey,
          ref.weekId,
          ref.groupId,
          ref.tierId,
          ref.groupIndex,
          ref.tier,
        ),
    });
    this.recordCoordinatedCacheMetrics(result.source);
    return this.deriveUserWeeklyView(result.value, userId);
  }

  private recordCoordinatedCacheMetrics(source: CacheLoadSource): void {
    if (source === 'cache') {
      rankingCacheCounter.inc({ cache: 'weekly', result: 'hit' });
      return;
    }

    rankingCacheCounter.inc({ cache: 'weekly', result: 'miss' });

    if (source === 'local-follower') {
      rankingCacheCounter.inc({ cache: 'weekly_sf', result: 'follower' });
      return;
    }

    if (source === 'distributed-follower') {
      rankingCacheCounter.inc({ cache: 'weekly_lock', result: 'follower' });
      return;
    }

    if (source === 'fallback') {
      rankingCacheCounter.inc({ cache: 'weekly_lock', result: 'fallback' });
      return;
    }

    rankingCacheCounter.inc({ cache: 'weekly_sf', result: 'leader' });
    rankingCacheCounter.inc({ cache: 'weekly_lock', result: 'leader' });
  }

  /**
   * 사용자 소속 그룹을 캐시에서 찾고 없으면 DB에서 조회한다.
   *
   * @param userId 사용자 ID
   * @param targetWeekKey 조회할 주차 키
   * @returns 주간 랭킹 조회에 필요한 소속 정보
   */
  private async resolveWeeklyMemberRef(
    userId: number,
    targetWeekKey: string,
  ): Promise<WeeklyMemberRef> {
    const refKey = CacheKeys.rankingWeeklyMemberRef(targetWeekKey, userId);
    try {
      const cached = await this.cacheStore.get(refKey);
      if (this.isWeeklyMemberRef(cached)) {
        rankingCacheCounter.inc({ cache: 'weekly_member', result: 'hit' });
        return cached;
      }
    } catch {
      // Redis 장애가 랭킹 조회를 막지 않도록 DB 조회를 계속한다.
    }
    rankingCacheCounter.inc({ cache: 'weekly_member', result: 'miss' });

    let ref: WeeklyMemberRef;
    const week = await this.weekRepository.findOne({ where: { weekKey: targetWeekKey } });
    if (!week) {
      ref = { kind: 'no-week' };
    } else {
      const member = await this.memberRepository.findOne({
        where: { weekId: week.id, userId },
        relations: { tier: true, group: true },
      });
      if (!member || !member.group) {
        ref = { kind: 'no-group' };
      } else {
        ref = {
          kind: 'group',
          weekId: week.id,
          groupId: member.groupId,
          tierId: member.tier?.id ?? null,
          groupIndex: member.group.groupIndex,
          tier: this.toTierSummary(member.tier),
        };
      }
    }

    try {
      await this.cacheStore.set(refKey, ref, CACHE_TTL_SECONDS.ranking);
    } catch {
      // 소속 정보는 다시 조회할 수 있으므로 저장 실패를 요청 오류로 처리하지 않는다.
    }
    return ref;
  }

  /**
   * 사용자별 필드를 제외한 그룹 공통 랭킹을 계산한다.
   *
   * @param weekKey 조회할 주차 키
   * @param weekId 주차 ID
   * @param groupId 그룹 ID
   * @param tierId 티어 ID
   * @param groupIndex 그룹 번호
   * @param tier 티어 정보
   * @returns 그룹 공통 주간 랭킹
   */
  private async computeGroupRanking(
    weekKey: string,
    weekId: number,
    groupId: number,
    tierId: number | null,
    groupIndex: number,
    tier: RankingTierSummary | null,
  ): Promise<CachedWeeklyGroupRanking> {
    const groupMembers = await this.memberRepository.find({
      where: { groupId },
      relations: { user: { profileCharacter: true } },
    });
    const memberIds = groupMembers.map(groupMember => groupMember.userId);
    const weeklyXpList = await this.weeklyXpRepository.find({
      where: { weekId, userId: In(memberIds) },
    });
    const weeklyXpMap = new Map(weeklyXpList.map(item => [item.userId, item]));

    const rankingSeeds = groupMembers.map(groupMember => {
      const weeklyXp = weeklyXpMap.get(groupMember.userId);
      const lastSolvedAt =
        weeklyXp?.lastSolvedAt ?? weeklyXp?.firstSolvedAt ?? groupMember.joinedAt;

      return {
        userId: groupMember.userId,
        displayName: groupMember.user?.displayName ?? '알 수 없음',
        profileImageUrl:
          groupMember.user?.profileCharacter?.imageUrl ?? groupMember.user?.profileImageUrl ?? null,
        xp: weeklyXp?.xp ?? 0,
        lastSolvedAt,
      };
    });

    const rankZoneMap = await this.buildRankZoneMap(tierId, rankingSeeds);
    const sorted = [...rankingSeeds].sort((left, right) => {
      if (left.xp !== right.xp) {
        return right.xp - left.xp;
      }
      const leftTime = left.lastSolvedAt.getTime();
      const rightTime = right.lastSolvedAt.getTime();
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      return left.userId - right.userId;
    });

    const members: WeeklyRankingEntry[] = sorted.map((entry, index) => ({
      userId: entry.userId,
      displayName: entry.displayName,
      profileImageUrl: entry.profileImageUrl,
      xp: entry.xp,
      rank: index + 1,
      isMe: false,
      rankZone: rankZoneMap.get(entry.userId) ?? 'MAINTAIN',
    }));

    return { weekKey, tier, groupIndex, totalMembers: members.length, members };
  }

  /**
   * 그룹 공통 랭킹에 요청자별 순위와 경험치를 덧붙인다.
   *
   * @param group 그룹 공통 주간 랭킹
   * @param userId 사용자 ID
   * @returns 사용자 관점의 주간 랭킹
   */
  private deriveUserWeeklyView(
    group: CachedWeeklyGroupRanking,
    userId: number,
  ): WeeklyRankingResult {
    const members = group.members.map(entry => ({
      ...entry,
      isMe: entry.userId === userId,
    }));
    const mine = members.find(entry => entry.userId === userId);

    return {
      weekKey: group.weekKey,
      tier: group.tier,
      groupIndex: group.groupIndex,
      totalMembers: group.totalMembers,
      myRank: mine?.rank ?? null,
      myWeeklyXp: mine?.xp ?? 0,
      members,
    };
  }

  private buildEmptyWeeklyResult(
    weekKey: string,
    tier: RankingTierSummary | null,
  ): WeeklyRankingResult {
    return {
      weekKey,
      tier,
      groupIndex: null,
      totalMembers: 0,
      myRank: null,
      myWeeklyXp: 0,
      members: [],
    };
  }

  private toTierSummary(tier: RankingTier | null | undefined): RankingTierSummary | null {
    return tier ? { id: tier.id, name: tier.name, orderIndex: tier.orderIndex } : null;
  }

  private isCachedGroupRanking(value: unknown): value is CachedWeeklyGroupRanking {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const record = value as { members?: unknown; totalMembers?: unknown };
    return Array.isArray(record.members) && typeof record.totalMembers === 'number';
  }

  private isWeeklyMemberRef(value: unknown): value is WeeklyMemberRef {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const kind = (value as { kind?: unknown }).kind;
    return kind === 'no-week' || kind === 'no-group' || kind === 'group';
  }

  /**
   * 주간 전체 랭킹을 조회한다.
   * - 주간 XP 순으로 정렬한다.
   *
   * @param userId 사용자 ID
   * @param weekKey 조회할 주차 키(없으면 현재 주차)
   * @returns {Promise<OverallRankingResult>} 주간 전체 랭킹 정보
   */
  async getOverallWeeklyRanking(
    userId: number,
    weekKey: string | null,
  ): Promise<OverallRankingResult> {
    const targetWeekKey = weekKey ?? getKstWeekInfo(getKstNow()).weekKey;
    const cached = await this.getCachedOverallWeeklyRanking(userId, targetWeekKey);
    if (cached) {
      rankingCacheCounter.inc({ cache: 'overall', result: 'hit' });
      return cached;
    }
    rankingCacheCounter.inc({ cache: 'overall', result: 'miss' });

    const week = await this.weekRepository.findOne({ where: { weekKey: targetWeekKey } });

    if (!week) {
      const result: OverallRankingResult = {
        weekKey: targetWeekKey,
        totalMembers: 0,
        myRank: null,
        myWeeklyXp: 0,
        members: [],
      };
      return this.cacheOverallWeeklyRanking(userId, targetWeekKey, result);
    }

    const { raw: rawRows, entities: allMembers } = await this.memberRepository
      .createQueryBuilder('member')
      .leftJoinAndSelect('member.user', 'user')
      .leftJoinAndSelect('user.profileCharacter', 'profileCharacter')
      .leftJoinAndSelect('member.tier', 'tier')
      .leftJoin(
        RankingWeeklyXp,
        'weeklyXp',
        'weeklyXp.week_id = member.week_id AND weeklyXp.user_id = member.user_id',
      )
      .addSelect('weeklyXp.xp', 'weeklyXp_xp')
      .addSelect('weeklyXp.first_solved_at', 'weeklyXp_firstSolvedAt')
      .addSelect('weeklyXp.last_solved_at', 'weeklyXp_lastSolvedAt')
      .where('member.week_id = :weekId', { weekId: week.id })
      .getRawAndEntities();

    if (allMembers.length === 0) {
      const result: OverallRankingResult = {
        weekKey: targetWeekKey,
        totalMembers: 0,
        myRank: null,
        myWeeklyXp: 0,
        members: [],
      };
      return this.cacheOverallWeeklyRanking(userId, targetWeekKey, result);
    }

    const rankingSeeds = allMembers.map((member, index) => {
      const rawRow = rawRows[index];
      const weeklyXp = this.parseWeeklyXpRow(rawRow);
      const lastSolvedAt = weeklyXp.lastSolvedAt ?? weeklyXp.firstSolvedAt ?? member.joinedAt;

      return {
        userId: member.userId,
        displayName: member.user?.displayName ?? '알 수 없음',
        profileImageUrl:
          member.user?.profileCharacter?.imageUrl ?? member.user?.profileImageUrl ?? null,
        xp: weeklyXp.xp,
        lastSolvedAt,
        tierName: member.tier?.name ?? null,
        tierOrderIndex: member.tier?.orderIndex ?? null,
      };
    });

    const sorted = [...rankingSeeds].sort((left, right) => {
      if (left.xp !== right.xp) {
        return right.xp - left.xp;
      }

      const leftTime = left.lastSolvedAt.getTime();
      const rightTime = right.lastSolvedAt.getTime();
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return left.userId - right.userId;
    });

    const members: OverallRankingEntry[] = sorted.map((entry, index) => ({
      userId: entry.userId,
      displayName: entry.displayName,
      profileImageUrl: entry.profileImageUrl,
      xp: entry.xp,
      rank: index + 1,
      isMe: entry.userId === userId,
      rankZone: 'MAINTAIN',
      tierName: entry.tierName,
      tierOrderIndex: entry.tierOrderIndex,
    }));

    const myRank = members.find(entry => entry.userId === userId)?.rank ?? null;
    const myWeeklyXp = rankingSeeds.find(entry => entry.userId === userId)?.xp ?? 0;

    const result: OverallRankingResult = {
      weekKey: targetWeekKey,
      totalMembers: members.length,
      myRank,
      myWeeklyXp,
      members,
    };
    return this.cacheOverallWeeklyRanking(userId, targetWeekKey, result);
  }

  /**
   * 관리자용으로 특정 티어/그룹 기준 주간 랭킹을 조회한다.
   *
   * @param tierId 조회할 티어 ID
   * @param groupIndex 조회할 그룹 번호
   * @param weekKey 조회할 주차 키(없으면 현재 주차)
   * @returns {Promise<WeeklyRankingResult>} 주간 랭킹 정보
   */
  async getWeeklyRankingByGroup(
    tierId: number,
    groupIndex: number,
    weekKey: string | null,
  ): Promise<WeeklyRankingResult> {
    const targetWeekKey = weekKey ?? getKstWeekInfo(getKstNow()).weekKey;
    const tier = await this.tierRepository.findOne({ where: { id: tierId } });

    if (!tier) {
      throw new NotFoundException('티어 정보를 찾을 수 없습니다.');
    }

    const tierSummary = {
      id: tier.id,
      name: tier.name,
      orderIndex: tier.orderIndex,
    };

    const week = await this.weekRepository.findOne({ where: { weekKey: targetWeekKey } });
    if (!week) {
      return {
        weekKey: targetWeekKey,
        tier: tierSummary,
        groupIndex,
        totalMembers: 0,
        myRank: null,
        myWeeklyXp: 0,
        members: [],
      };
    }

    const group = await this.groupRepository.findOne({
      where: { weekId: week.id, tierId, groupIndex },
    });
    if (!group) {
      return {
        weekKey: targetWeekKey,
        tier: tierSummary,
        groupIndex,
        totalMembers: 0,
        myRank: null,
        myWeeklyXp: 0,
        members: [],
      };
    }

    const groupMembers = await this.memberRepository.find({
      where: { groupId: group.id },
      relations: { user: { profileCharacter: true } },
    });

    if (groupMembers.length === 0) {
      return {
        weekKey: targetWeekKey,
        tier: tierSummary,
        groupIndex,
        totalMembers: 0,
        myRank: null,
        myWeeklyXp: 0,
        members: [],
      };
    }

    const memberIds = groupMembers.map(groupMember => groupMember.userId);
    const weeklyXpList = await this.weeklyXpRepository.find({
      where: { weekId: week.id, userId: In(memberIds) },
    });
    const weeklyXpMap = new Map(weeklyXpList.map(item => [item.userId, item]));

    const rankingSeeds = groupMembers.map(groupMember => {
      const weeklyXp = weeklyXpMap.get(groupMember.userId);
      const lastSolvedAt =
        weeklyXp?.lastSolvedAt ?? weeklyXp?.firstSolvedAt ?? groupMember.joinedAt;

      return {
        userId: groupMember.userId,
        displayName: groupMember.user?.displayName ?? '알 수 없음',
        profileImageUrl:
          groupMember.user?.profileCharacter?.imageUrl ?? groupMember.user?.profileImageUrl ?? null,
        xp: weeklyXp?.xp ?? 0,
        lastSolvedAt,
      };
    });

    const rankZoneMap = await this.buildRankZoneMap(tierId, rankingSeeds);
    const sorted = [...rankingSeeds].sort((left, right) => {
      if (left.xp !== right.xp) {
        return right.xp - left.xp;
      }
      const leftTime = left.lastSolvedAt.getTime();
      const rightTime = right.lastSolvedAt.getTime();
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      return left.userId - right.userId;
    });

    const members: WeeklyRankingEntry[] = sorted.map((entry, index) => ({
      userId: entry.userId,
      displayName: entry.displayName,
      profileImageUrl: entry.profileImageUrl,
      xp: entry.xp,
      rank: index + 1,
      isMe: false,
      rankZone: rankZoneMap.get(entry.userId) ?? 'MAINTAIN',
    }));

    return {
      weekKey: targetWeekKey,
      tier: tierSummary,
      groupIndex,
      totalMembers: members.length,
      myRank: null,
      myWeeklyXp: 0,
      members,
    };
  }

  /**
   * 관리자용으로 특정 티어명/그룹 기준 주간 랭킹을 조회한다.
   *
   * @param tierName 조회할 티어명
   * @param groupIndex 조회할 그룹 번호
   * @param weekKey 조회할 주차 키(없으면 현재 주차)
   * @returns {Promise<WeeklyRankingResult>} 주간 랭킹 정보
   */
  async getWeeklyRankingByTierName(
    tierName: RankingTierName,
    groupIndex: number,
    weekKey: string | null,
  ): Promise<WeeklyRankingResult> {
    const tier = await this.tierRepository.findOne({ where: { name: tierName } });

    if (!tier) {
      throw new NotFoundException('티어 정보를 찾을 수 없습니다.');
    }

    return this.getWeeklyRankingByGroup(tier.id, groupIndex, weekKey);
  }

  private async findDefaultTier(): Promise<RankingTier | null> {
    return this.tierRepository.findOne({ where: { name: RankingTierName.BRONZE } });
  }

  /**
   * 랭킹 결과에 승급/유지/강등 구역을 매핑한다.
   *
   * @param tierId 티어 ID
   * @param members 랭킹 계산 대상 목록
   * @returns 사용자별 구역 매핑
   */
  private async buildRankZoneMap(
    tierId: number | null,
    members: Array<{ userId: number; xp: number; lastSolvedAt: Date }>,
  ): Promise<Map<number, RankingZone>> {
    if (!tierId || members.length === 0) {
      return new Map();
    }

    const rule = await this.tierRuleRepository.findOne({ where: { tierId } });
    if (!rule) {
      return new Map();
    }

    const snapshots = buildRankingSnapshots({ members, rule });
    const zoneMap = new Map<number, RankingZone>();

    snapshots.forEach(snapshot => {
      zoneMap.set(snapshot.userId, this.mapSnapshotStatusToZone(snapshot.status));
    });

    return zoneMap;
  }

  /**
   * 스냅샷 상태를 랭킹 구역으로 변환한다.
   *
   * @param status 스냅샷 상태
   * @returns 랭킹 구역
   */
  private mapSnapshotStatusToZone(status: RankingSnapshotStatus): RankingZone {
    if (status === RankingSnapshotStatus.PROMOTED) {
      return 'PROMOTION';
    }

    if (status === RankingSnapshotStatus.DEMOTED) {
      return 'DEMOTION';
    }

    return 'MAINTAIN';
  }

  private parseWeeklyXpRow(row: unknown): {
    xp: number;
    firstSolvedAt: Date | null;
    lastSolvedAt: Date | null;
  } {
    if (!row || typeof row !== 'object') {
      return { xp: 0, firstSolvedAt: null, lastSolvedAt: null };
    }

    const record = row as {
      weeklyXp_xp?: number | string | null;
      weeklyXp_firstSolvedAt?: Date | string | null;
      weeklyXp_lastSolvedAt?: Date | string | null;
    };

    const xp =
      record.weeklyXp_xp !== null && record.weeklyXp_xp !== undefined
        ? Number(record.weeklyXp_xp)
        : 0;
    const firstSolvedAt = this.toDateOrNull(record.weeklyXp_firstSolvedAt);
    const lastSolvedAt = this.toDateOrNull(record.weeklyXp_lastSolvedAt);

    return { xp, firstSolvedAt, lastSolvedAt };
  }

  private toDateOrNull(value: unknown): Date | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  private async cacheWeeklyRanking(
    userId: number,
    weekKey: string,
    result: WeeklyRankingResult,
  ): Promise<WeeklyRankingResult> {
    await this.setCachedWeeklyRanking(userId, weekKey, result);
    return result;
  }

  private async cacheOverallWeeklyRanking(
    userId: number,
    weekKey: string,
    result: OverallRankingResult,
  ): Promise<OverallRankingResult> {
    await this.setCachedOverallWeeklyRanking(userId, weekKey, result);
    return result;
  }

  private async getCachedWeeklyRanking(
    userId: number,
    weekKey: string,
  ): Promise<WeeklyRankingResult | null> {
    const cacheKey = CacheKeys.rankingWeekly(weekKey, userId);

    try {
      const cached = await this.cacheStore.get(cacheKey);
      if (!this.isWeeklyRankingResult(cached)) {
        return null;
      }
      return cached;
    } catch {
      return null;
    }
  }

  private async setCachedWeeklyRanking(
    userId: number,
    weekKey: string,
    result: WeeklyRankingResult,
  ): Promise<void> {
    const cacheKey = CacheKeys.rankingWeekly(weekKey, userId);

    try {
      await this.cacheStore.set(cacheKey, result, CACHE_TTL_SECONDS.ranking);
    } catch {
      return;
    }
  }

  private async getCachedOverallWeeklyRanking(
    userId: number,
    weekKey: string,
  ): Promise<OverallRankingResult | null> {
    const cacheKey = CacheKeys.rankingOverall(weekKey, userId);

    try {
      const cached = await this.cacheStore.get(cacheKey);
      if (!this.isOverallRankingResult(cached)) {
        return null;
      }
      return cached;
    } catch {
      return null;
    }
  }

  private async setCachedOverallWeeklyRanking(
    userId: number,
    weekKey: string,
    result: OverallRankingResult,
  ): Promise<void> {
    const cacheKey = CacheKeys.rankingOverall(weekKey, userId);

    try {
      await this.cacheStore.set(cacheKey, result, CACHE_TTL_SECONDS.ranking);
    } catch {
      return;
    }
  }

  private isWeeklyRankingResult(value: unknown): value is WeeklyRankingResult {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const record = value as { members?: unknown };
    return Array.isArray(record.members);
  }

  private isOverallRankingResult(value: unknown): value is OverallRankingResult {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const record = value as { members?: unknown };
    return Array.isArray(record.members);
  }
}
