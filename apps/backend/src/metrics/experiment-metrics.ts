import { Counter, Gauge, register } from 'prom-client';

/**
 * PrometheusModule과 같은 레지스트리에 등록해 기존 메트릭 경로로 함께 노출한다.
 */
export const rankingCacheCounter = new Counter({
  name: 'ranking_cache_requests_total',
  help: 'Ranking cache lookups labeled by cache type and result (hit/miss).',
  labelNames: ['cache', 'result'],
  registers: [register],
});

export const dbPoolGauge = new Gauge({
  name: 'db_pool_connections',
  help: 'MySQL(mysql2) connection pool connections by state.',
  labelNames: ['state'],
  registers: [register],
});
