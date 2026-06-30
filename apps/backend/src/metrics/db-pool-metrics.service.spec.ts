import { DataSource } from 'typeorm';

import { DbPoolMetricsService } from './db-pool-metrics.service';
import { dbPoolGauge } from './experiment-metrics';

jest.mock('./experiment-metrics', () => ({
  dbPoolGauge: {
    set: jest.fn(),
  },
}));

const COLLECTION_INTERVAL_MS = 1_000;

describe('DbPoolMetricsService', () => {
  const setGauge = dbPoolGauge.set as jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    setGauge.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('mysql2 풀의 전체·유휴·사용·대기 커넥션 수를 기록한다', () => {
    const dataSource = {
      driver: {
        pool: {
          _allConnections: { length: 10 },
          _freeConnections: { length: 3 },
          _connectionQueue: { length: 4 },
        },
      },
    } as unknown as DataSource;
    const service = new DbPoolMetricsService(dataSource);

    service.onModuleInit();
    jest.advanceTimersByTime(COLLECTION_INTERVAL_MS);

    expect(setGauge).toHaveBeenNthCalledWith(1, { state: 'total' }, 10);
    expect(setGauge).toHaveBeenNthCalledWith(2, { state: 'idle' }, 3);
    expect(setGauge).toHaveBeenNthCalledWith(3, { state: 'active' }, 7);
    expect(setGauge).toHaveBeenNthCalledWith(4, { state: 'pending' }, 4);

    service.onModuleDestroy();
  });

  it('풀이 아직 생성되지 않았으면 게이지를 변경하지 않는다', () => {
    const dataSource = {
      driver: {},
    } as unknown as DataSource;
    const service = new DbPoolMetricsService(dataSource);

    service.onModuleInit();
    jest.advanceTimersByTime(COLLECTION_INTERVAL_MS);

    expect(setGauge).not.toHaveBeenCalled();

    service.onModuleDestroy();
  });

  it('모듈 종료 후에는 수집을 중단한다', () => {
    const dataSource = {
      driver: {
        pool: {
          _allConnections: { length: 10 },
          _freeConnections: { length: 10 },
          _connectionQueue: { length: 0 },
        },
      },
    } as unknown as DataSource;
    const service = new DbPoolMetricsService(dataSource);

    service.onModuleInit();
    service.onModuleDestroy();
    jest.advanceTimersByTime(COLLECTION_INTERVAL_MS);

    expect(setGauge).not.toHaveBeenCalled();
  });
});
