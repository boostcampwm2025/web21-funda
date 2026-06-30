import { RankingSnapshotStatus } from './entities/ranking-snapshot-status.enum';
import { RankingTier } from './entities/ranking-tier.entity';
import { RankingTierChangeReason } from './entities/ranking-tier-change-reason.enum';
import { RankingTierRule } from './entities/ranking-tier-rule.entity';
import { buildRankingSnapshots, resolveTierChange } from './ranking-evaluation.utils';

const createRule = (override: Partial<RankingTierRule>): RankingTierRule =>
  ({
    promoteMinXp: 100,
    demoteMinXp: 50,
    promoteRatio: '0.4',
    demoteRatio: '0.4',
    isMaster: false,
    ...override,
  }) as RankingTierRule;

describe('buildRankingSnapshots', () => {
  it('승급 후보 최소 XP가 기준보다 높으면 승급 컷을 상향한다', () => {
    const rule = createRule({ promoteMinXp: 80 });
    const snapshots = buildRankingSnapshots({
      members: [
        { userId: 1, xp: 120, lastSolvedAt: new Date('2025-01-01') },
        { userId: 2, xp: 110, lastSolvedAt: new Date('2025-01-02') },
        { userId: 3, xp: 30, lastSolvedAt: new Date('2025-01-03') },
      ],
      rule,
    });

    const promoted = snapshots.filter(
      snapshot => snapshot.status === RankingSnapshotStatus.PROMOTED,
    );
    expect(promoted.length).toBe(2);
    expect(promoted[0]?.promoteCutXp).toBe(110);
  });

  it('XP 컷 미달이면 상대평가와 상관없이 강등된다', () => {
    const rule = createRule({ demoteMinXp: 50, promoteRatio: '0.3', demoteRatio: '0.3' });
    const snapshots = buildRankingSnapshots({
      members: [
        { userId: 1, xp: 120, lastSolvedAt: new Date('2025-01-01') },
        { userId: 2, xp: 40, lastSolvedAt: new Date('2025-01-02') },
        { userId: 3, xp: 35, lastSolvedAt: new Date('2025-01-03') },
      ],
      rule,
    });

    const demotedIds = snapshots
      .filter(snapshot => snapshot.status === RankingSnapshotStatus.DEMOTED)
      .map(snapshot => snapshot.userId);

    expect(demotedIds).toEqual([2, 3]);
  });

  it('마스터 티어는 승급이 없고 하락만 반영한다', () => {
    const rule = createRule({
      promoteRatio: '0.5',
      demoteRatio: '0.5',
      promoteMinXp: 0,
      demoteMinXp: 200,
      isMaster: true,
    });
    const snapshots = buildRankingSnapshots({
      members: [
        { userId: 1, xp: 300, lastSolvedAt: new Date('2025-01-01') },
        { userId: 2, xp: 150, lastSolvedAt: new Date('2025-01-02') },
      ],
      rule,
    });

    expect(snapshots[0]?.status).toBe(RankingSnapshotStatus.MAINTAINED);
    expect(snapshots[1]?.status).toBe(RankingSnapshotStatus.DEMOTED);
  });

  it('상위 비율에 들어도 최소 XP에 못 미치면 승급하지 않는다', () => {
    const rule = createRule({
      promoteRatio: '1',
      promoteMinXp: 100,
      demoteRatio: '0',
      demoteMinXp: 0,
    });
    const snapshots = buildRankingSnapshots({
      members: [
        { userId: 1, xp: 120, lastSolvedAt: new Date('2025-01-01') },
        { userId: 2, xp: 80, lastSolvedAt: new Date('2025-01-02') },
      ],
      rule,
    });

    const statusByUser = new Map(snapshots.map(snapshot => [snapshot.userId, snapshot.status]));
    expect(statusByUser.get(1)).toBe(RankingSnapshotStatus.PROMOTED);
    expect(statusByUser.get(2)).not.toBe(RankingSnapshotStatus.PROMOTED);
  });

  it('승급 인원은 올림, 강등 인원은 내림으로 계산한다', () => {
    const rule = createRule({
      promoteRatio: '0.5',
      demoteRatio: '0.5',
      promoteMinXp: 0,
      demoteMinXp: 0,
    });
    const snapshots = buildRankingSnapshots({
      members: [
        { userId: 1, xp: 30, lastSolvedAt: new Date('2025-01-01') },
        { userId: 2, xp: 20, lastSolvedAt: new Date('2025-01-02') },
        { userId: 3, xp: 10, lastSolvedAt: new Date('2025-01-03') },
      ],
      rule,
    });

    const promoted = snapshots.filter(s => s.status === RankingSnapshotStatus.PROMOTED);
    const demoted = snapshots.filter(s => s.status === RankingSnapshotStatus.DEMOTED);
    // 3명 * 0.5 -> 승급 ceil(1.5)=2, 강등 floor(1.5)=1
    expect(promoted.length).toBe(2);
    expect(demoted.length).toBe(1);
  });

  it('XP가 같으면 풀이 시각이 빠른 순, 같으면 사용자 ID 순으로 정렬한다', () => {
    const rule = createRule({ promoteRatio: '0', demoteRatio: '0' });
    const snapshots = buildRankingSnapshots({
      members: [
        { userId: 5, xp: 100, lastSolvedAt: new Date('2025-01-02') },
        { userId: 7, xp: 100, lastSolvedAt: new Date('2025-01-01') },
        { userId: 3, xp: 100, lastSolvedAt: new Date('2025-01-01') },
      ],
      rule,
    });

    const rankByUser = new Map(snapshots.map(snapshot => [snapshot.userId, snapshot.rank]));
    expect(rankByUser.get(3)).toBe(1);
    expect(rankByUser.get(7)).toBe(2);
    expect(rankByUser.get(5)).toBe(3);
  });
});

describe('resolveTierChange', () => {
  const tiers = [
    { id: 1, orderIndex: 1 } as RankingTier,
    { id: 2, orderIndex: 2 } as RankingTier,
    { id: 3, orderIndex: 3 } as RankingTier,
  ];

  it('승급이면 다음 티어로 이동한다', () => {
    const result = resolveTierChange({
      tiers,
      tierId: 2,
      status: RankingSnapshotStatus.PROMOTED,
    });

    expect(result.toTierId).toBe(3);
    expect(result.reason).toBe(RankingTierChangeReason.PROMOTION);
  });

  it('강등이면 이전 티어로 이동한다', () => {
    const result = resolveTierChange({
      tiers,
      tierId: 2,
      status: RankingSnapshotStatus.DEMOTED,
    });

    expect(result.toTierId).toBe(1);
    expect(result.reason).toBe(RankingTierChangeReason.DEMOTION);
  });

  it('최상위/최하위에서 승급/강등을 유지 처리한다', () => {
    const topResult = resolveTierChange({
      tiers,
      tierId: 3,
      status: RankingSnapshotStatus.PROMOTED,
    });
    const bottomResult = resolveTierChange({
      tiers,
      tierId: 1,
      status: RankingSnapshotStatus.DEMOTED,
    });

    expect(topResult.toTierId).toBe(3);
    expect(bottomResult.toTierId).toBe(1);
    expect(topResult.reason).toBe(RankingTierChangeReason.MAINTAIN);
    expect(bottomResult.reason).toBe(RankingTierChangeReason.MAINTAIN);
  });
});
