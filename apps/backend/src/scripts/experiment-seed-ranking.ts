import 'reflect-metadata';

import { AppDataSource } from '../config/typeorm.data-source';

/**
 * 랭킹 캐시 정합성·운영부하 실험용 시드 스크립트.
 *
 * 핸드오프 문서(실험_핸드오프_랭킹캐시정합성.md) Section 6 데이터 시딩 구현체.
 * - 규모(N)·그룹 정원(G)·주차 수를 환경변수로 파라미터화해 변인을 한 번에 하나만 바꾼다.
 * - XP를 상위 편중(헤비테일) 분포로 채워 정렬/percentile이 trivial하지 않게 한다.
 * - 동일 시드(EXP_SEED)면 동일 데이터를 재현한다(결정적 PRNG).
 * - 실제 운영 데이터와 격리하기 위해 미래 연도 weekKey(2999-NN)와 provider_user_id=exp-* 만 쓴다.
 *   (랭킹 컨트롤러가 weekKey를 /^\d{4}-\d{2}$/로 검증하므로 EXP- 같은 임의 문자열은 못 쓴다.)
 * - 대량 삽입은 raw SQL 멀티로우 bulk insert로 처리한다.
 *
 * 사용 예:
 *   EXP_USERS=10000 EXP_G=30 EXP_WEEKS=4 pnpm --filter backend exp:seed
 *
 * 정리:
 *   EXP_CLEAN_ONLY=1 pnpm --filter backend exp:seed   # 실험 데이터만 삭제하고 종료
 */

interface ExperimentConfig {
  users: number;
  groupSize: number;
  weeks: number;
  tierName: string;
  seed: number;
  batch: number;
  clean: boolean;
  cleanOnly: boolean;
  /** XP 헤비테일 강도. 클수록 상위 편중이 강해진다. */
  xpSkew: number;
  /** XP 스케일(분포 곱셈 계수). */
  xpScale: number;
}

// 미래 연도(2999)를 써서 실데이터(현재 ISO 주차)와 충돌하지 않으면서
// 컨트롤러의 weekKey 검증(/^\d{4}-\d{2}$/)을 통과시킨다. → 2999-01, 2999-02 …
const WEEK_KEY_PREFIX = '2999-';
const USER_KEY_PREFIX = 'exp-';

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toFloat = (value: string | undefined, fallback: number): number => {
  const parsed = value ? Number.parseFloat(value) : Number.NaN;
  return Number.isNaN(parsed) ? fallback : parsed;
};

const loadConfig = (): ExperimentConfig => ({
  users: toInt(process.env.EXP_USERS, 10_000),
  groupSize: toInt(process.env.EXP_G, 10),
  weeks: toInt(process.env.EXP_WEEKS, 4),
  tierName: process.env.EXP_TIER ?? 'BRONZE',
  seed: toInt(process.env.EXP_SEED, 42),
  batch: toInt(process.env.EXP_BATCH, 1_000),
  clean: process.env.EXP_CLEAN !== '0',
  cleanOnly: process.env.EXP_CLEAN_ONLY === '1',
  xpSkew: toFloat(process.env.EXP_XP_SKEW, 1.3),
  xpScale: toFloat(process.env.EXP_XP_SCALE, 2_000),
});

/** mulberry32: 결정적·경량 PRNG. 동일 시드면 동일 수열을 재현한다. */
const createPrng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

/**
 * 헤비테일(파레토 근사) XP를 생성한다.
 * u ~ U(0,1)에 대해 xp = scale * ((1/u)^(1/skew) - 1) 형태로 상위 소수가 큰 값을 갖게 한다.
 */
const sampleXp = (rand: () => number, config: ExperimentConfig): number => {
  const u = Math.max(rand(), 1e-9);
  const raw = config.xpScale * (Math.pow(1 / u, 1 / config.xpSkew) - 1);
  return Math.min(Math.round(raw), 1_000_000);
};

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

interface QueryExecutor {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
}

/** SELECT 결과의 첫 행 id를 안전하게 꺼낸다. 비어 있으면 명확히 실패시킨다. */
const firstId = (rows: Array<{ id: number }>, label: string): number => {
  const row = rows[0];
  if (!row) {
    throw new Error(`[exp-seed] ${label} 조회 결과가 비어 있습니다.`);
  }
  return row.id;
};

/** 실험 전용 데이터(prefix 격리)만 삭제한다. 운영 데이터는 건드리지 않는다. */
const cleanExperimentData = async (db: QueryExecutor): Promise<void> => {
  // FK(onDelete CASCADE) 순서를 명시적으로 따라 자식부터 지운다.
  await db.query(
    `DELETE FROM ranking_weekly_xp WHERE week_id IN (SELECT id FROM ranking_weeks WHERE week_key LIKE ?)`,
    [`${WEEK_KEY_PREFIX}%`],
  );
  await db.query(
    `DELETE FROM ranking_group_members WHERE week_id IN (SELECT id FROM ranking_weeks WHERE week_key LIKE ?)`,
    [`${WEEK_KEY_PREFIX}%`],
  );
  await db.query(
    `DELETE FROM ranking_groups WHERE week_id IN (SELECT id FROM ranking_weeks WHERE week_key LIKE ?)`,
    [`${WEEK_KEY_PREFIX}%`],
  );
  await db.query(`DELETE FROM ranking_weeks WHERE week_key LIKE ?`, [`${WEEK_KEY_PREFIX}%`]);
  await db.query(`DELETE FROM users WHERE provider_user_id LIKE ?`, [`${USER_KEY_PREFIX}%`]);
};

/** 실험 티어 + 룰을 보장하고 max_group_size를 G로 맞춘다. tierId를 반환한다. */
const ensureTier = async (db: QueryExecutor, config: ExperimentConfig): Promise<number> => {
  await db.query(
    `INSERT INTO ranking_tiers (name, order_index, max_group_size)
     VALUES (?, 1, ?)
     ON DUPLICATE KEY UPDATE max_group_size = VALUES(max_group_size)`,
    [config.tierName, config.groupSize],
  );
  const rows = (await db.query(`SELECT id FROM ranking_tiers WHERE name = ?`, [
    config.tierName,
  ])) as Array<{ id: number }>;
  const tierId = firstId(rows, 'ranking_tiers');

  await db.query(
    `INSERT INTO ranking_tier_rules (tier_id, promote_min_xp, demote_min_xp, promote_ratio, demote_ratio, is_master)
     VALUES (?, 100, 0, 0.3, 0.2, false)
     ON DUPLICATE KEY UPDATE promote_min_xp = VALUES(promote_min_xp)`,
    [tierId],
  );
  return tierId;
};

/** 프로필 캐릭터 1개를 보장하고 id를 반환한다(미스당 profileCharacter 조인 비용 재현용). */
const ensureProfileCharacter = async (db: QueryExecutor): Promise<number> => {
  const existing = (await db.query(
    `SELECT id FROM profile_characters ORDER BY id ASC LIMIT 1`,
  )) as Array<{ id: number }>;
  if (existing.length > 0) {
    return firstId(existing, 'profile_characters');
  }
  await db.query(
    `INSERT INTO profile_characters (name, image_url, price_diamonds, is_active)
     VALUES ('실험캐릭터', 'https://example.com/exp-character.png', 0, true)`,
  );
  const created = (await db.query(
    `SELECT id FROM profile_characters ORDER BY id DESC LIMIT 1`,
  )) as Array<{ id: number }>;
  return firstId(created, 'profile_characters');
};

/** N명의 실험 유저를 bulk insert하고, 정렬된 user id 배열을 반환한다. */
const seedUsers = async (
  db: QueryExecutor,
  config: ExperimentConfig,
  profileCharacterId: number,
): Promise<number[]> => {
  for (const batchIndex of chunk(range(config.users), config.batch)) {
    const placeholders = batchIndex.map(() => `('github', ?, ?, ?)`).join(', ');
    const params: unknown[] = [];
    for (const i of batchIndex) {
      params.push(`${USER_KEY_PREFIX}${i}`, `실험유저${i}`, profileCharacterId);
    }
    await db.query(
      `INSERT INTO users (provider, provider_user_id, display_name, profile_character_id) VALUES ${placeholders}`,
      params,
    );
  }
  const rows = (await db.query(
    `SELECT id FROM users WHERE provider_user_id LIKE ? ORDER BY id ASC`,
    [`${USER_KEY_PREFIX}%`],
  )) as Array<{ id: number }>;
  return rows.map(row => row.id);
};

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

const formatSqlDate = (date: Date): string => date.toISOString().slice(0, 19).replace('T', ' ');

/** 한 주차 분량(week, groups, members, weekly_xp)을 시드한다. */
const seedWeek = async (
  db: QueryExecutor,
  config: ExperimentConfig,
  tierId: number,
  userIds: number[],
  weekOrdinal: number,
): Promise<void> => {
  const weekKey = `${WEEK_KEY_PREFIX}${String(weekOrdinal).padStart(2, '0')}`;
  const startsAt = new Date(Date.UTC(2025, 0, 6) - weekOrdinal * 7 * 86_400_000);
  const endsAt = new Date(startsAt.getTime() + 7 * 86_400_000);

  await db.query(
    `INSERT INTO ranking_weeks (week_key, starts_at, ends_at, status) VALUES (?, ?, ?, 'OPEN')`,
    [weekKey, formatSqlDate(startsAt), formatSqlDate(endsAt)],
  );
  const weekRows = (await db.query(`SELECT id FROM ranking_weeks WHERE week_key = ?`, [
    weekKey,
  ])) as Array<{ id: number }>;
  const weekId = firstId(weekRows, 'ranking_weeks');

  const groupCount = Math.ceil(userIds.length / config.groupSize);

  // groups: group_index 1..groupCount
  for (const groupBatch of chunk(range(groupCount), config.batch)) {
    const placeholders = groupBatch.map(() => `(?, ?, ?, ?)`).join(', ');
    const params: unknown[] = [];
    for (const g of groupBatch) {
      params.push(weekId, tierId, g + 1, config.groupSize);
    }
    await db.query(
      `INSERT INTO ranking_groups (week_id, tier_id, group_index, capacity) VALUES ${placeholders}`,
      params,
    );
  }
  const groupRows = (await db.query(
    `SELECT id, group_index FROM ranking_groups WHERE week_id = ? ORDER BY group_index ASC`,
    [weekId],
  )) as Array<{ id: number; group_index: number }>;
  const groupIdByIndex = new Map(groupRows.map(row => [row.group_index, row.id]));

  // members: 유저를 순서대로 G명씩 그룹에 채운다.
  const joinedAt = formatSqlDate(new Date(startsAt.getTime() + 3_600_000));
  for (const userBatch of chunk(range(userIds.length), config.batch)) {
    const placeholders = userBatch.map(() => `(?, ?, ?, ?, ?)`).join(', ');
    const params: unknown[] = [];
    for (const u of userBatch) {
      const groupIndex = Math.floor(u / config.groupSize) + 1;
      params.push(weekId, tierId, groupIdByIndex.get(groupIndex), userIds[u], joinedAt);
    }
    await db.query(
      `INSERT INTO ranking_group_members (week_id, tier_id, group_id, user_id, joined_at) VALUES ${placeholders}`,
      params,
    );
  }

  // weekly_xp: 헤비테일 분포. 주차별로 시드를 분기해 주차마다 다른 값을 갖되 재현 가능.
  const rand = createPrng(config.seed + weekOrdinal * 1_000_003);
  for (const userBatch of chunk(range(userIds.length), config.batch)) {
    const placeholders = userBatch.map(() => `(?, ?, ?, ?, ?, ?, ?)`).join(', ');
    const params: unknown[] = [];
    for (const u of userBatch) {
      const xp = sampleXp(rand, config);
      const solvedCount = Math.max(1, Math.round(xp / 50));
      const firstOffsetMs = Math.floor(rand() * 6 * 86_400_000);
      const firstSolvedAt = new Date(startsAt.getTime() + firstOffsetMs);
      const lastSolvedAt = new Date(
        Math.min(firstSolvedAt.getTime() + Math.floor(rand() * 86_400_000), endsAt.getTime()),
      );
      params.push(
        weekId,
        userIds[u],
        tierId,
        xp,
        solvedCount,
        formatSqlDate(firstSolvedAt),
        formatSqlDate(lastSolvedAt),
      );
    }
    await db.query(
      `INSERT INTO ranking_weekly_xp (week_id, user_id, tier_id, xp, solved_count, first_solved_at, last_solved_at) VALUES ${placeholders}`,
      params,
    );
  }
};

async function main(): Promise<void> {
  const config = loadConfig();
  const dataSource = await AppDataSource.initialize();
  const queryRunner = dataSource.createQueryRunner();
  const db: QueryExecutor = { query: (sql, params) => queryRunner.query(sql, params) };

  const startedAt = Date.now();
  try {
    if (config.clean || config.cleanOnly) {
      console.log('[exp-seed] 기존 실험 데이터 정리 중...');
      await cleanExperimentData(db);
    }
    if (config.cleanOnly) {
      console.log('[exp-seed] 정리만 수행하고 종료합니다.');
      return;
    }

    console.log(
      `[exp-seed] 시작: users=${config.users} G=${config.groupSize} weeks=${config.weeks} ` +
        `tier=${config.tierName} seed=${config.seed} (groups/week=${Math.ceil(config.users / config.groupSize)})`,
    );

    const tierId = await ensureTier(db, config);
    const profileCharacterId = await ensureProfileCharacter(db);
    const userIds = await seedUsers(db, config, profileCharacterId);
    console.log(`[exp-seed] 유저 ${userIds.length}명 삽입 완료`);

    for (let w = 1; w <= config.weeks; w += 1) {
      await seedWeek(db, config, tierId, userIds, w);
      console.log(`[exp-seed] 주차 ${WEEK_KEY_PREFIX}${String(w).padStart(2, '0')} 시드 완료`);
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(
      `[exp-seed] 완료 (${elapsed}s). weekKey 예: ${WEEK_KEY_PREFIX}01, 대상 user id 범위: ${userIds[0]}~${userIds[userIds.length - 1]}`,
    );
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

main().catch(error => {
  console.error('[exp-seed] 실패:', error);
  process.exit(1);
});
