import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { dbPoolGauge } from './experiment-metrics';

const DB_POOL_METRICS_INTERVAL_MS = 1_000;

/**
 * mysql2 커넥션 풀 상태를 주기적으로 읽어 Prometheus 게이지로 노출한다.
 *
 * TypeORM이 풀 대기열을 공개하지 않아 mysql2 내부 필드를 읽는다.
 * 라이브러리 내부 구조가 바뀌면 계측만 건너뛰고 요청 처리는 계속한다.
 */
@Injectable()
export class DbPoolMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbPoolMetricsService.name);
  private collectionTimer?: ReturnType<typeof setInterval>;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    // Prometheus 수집 주기 사이에 생기는 짧은 대기열 변화도 기록한다.
    this.collectionTimer = setInterval(() => {
      this.collectPoolMetrics();
    }, DB_POOL_METRICS_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
    }
  }

  /**
   * mysql2 풀의 현재 상태를 게이지에 반영한다.
   *
   * @returns 반환값 없음
   */
  private collectPoolMetrics(): void {
    try {
      const pool = (this.dataSource.driver as unknown as { pool?: MysqlPoolInternals }).pool;
      if (!pool) {
        return;
      }

      const all = pool._allConnections?.length ?? 0;
      const free = pool._freeConnections?.length ?? 0;
      const pending = pool._connectionQueue?.length ?? 0;

      dbPoolGauge.set({ state: 'total' }, all);
      dbPoolGauge.set({ state: 'idle' }, free);
      dbPoolGauge.set({ state: 'active' }, Math.max(all - free, 0));
      dbPoolGauge.set({ state: 'pending' }, pending);
    } catch (error) {
      // 계측 오류 때문에 사용자 요청까지 실패하지 않도록 예외를 전파하지 않는다.
      this.logger.debug(`풀 메트릭 수집 실패: ${String(error)}`);
    }
  }
}

/** 계측에 사용하는 mysql2 풀 내부 필드만 선언한다. */
interface MysqlPoolInternals {
  _allConnections?: { length: number };
  _freeConnections?: { length: number };
  _connectionQueue?: { length: number };
}
