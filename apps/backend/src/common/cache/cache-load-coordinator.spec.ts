import { CacheLoadCoordinator } from './cache-load-coordinator';
import type { CacheStore } from './cache-store';
import type { DistributedLock } from './distributed-lock';

interface RankingValue {
  members: number[];
}

describe('CacheLoadCoordinator', () => {
  const originalPollInterval = process.env.RANKING_CACHE_LOCK_POLL_INTERVAL_MS;
  const originalWaitTimeout = process.env.RANKING_CACHE_LOCK_WAIT_TIMEOUT_MS;
  let cacheStore: jest.Mocked<CacheStore>;
  let distributedLock: jest.Mocked<DistributedLock>;

  beforeEach(() => {
    process.env.RANKING_CACHE_LOCK_POLL_INTERVAL_MS = '1';
    process.env.RANKING_CACHE_LOCK_WAIT_TIMEOUT_MS = '100';
    cacheStore = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
    distributedLock = {
      tryAcquire: jest.fn(),
      release: jest.fn(),
    };
  });

  afterAll(() => {
    if (originalPollInterval === undefined) {
      delete process.env.RANKING_CACHE_LOCK_POLL_INTERVAL_MS;
    } else {
      process.env.RANKING_CACHE_LOCK_POLL_INTERVAL_MS = originalPollInterval;
    }

    if (originalWaitTimeout === undefined) {
      delete process.env.RANKING_CACHE_LOCK_WAIT_TIMEOUT_MS;
    } else {
      process.env.RANKING_CACHE_LOCK_WAIT_TIMEOUT_MS = originalWaitTimeout;
    }
  });

  it('유효한 캐시가 있으면 락을 획득하거나 값을 계산하지 않는다', async () => {
    const cachedValue = { members: [1] };
    cacheStore.get.mockResolvedValue(cachedValue);
    const coordinator = new CacheLoadCoordinator(cacheStore, distributedLock);
    const load = jest.fn();

    const result = await coordinator.getOrLoad(createOptions(load));

    expect(result).toEqual({ value: cachedValue, source: 'cache' });
    expect(distributedLock.tryAcquire).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  it('동일 인스턴스의 동시 요청은 하나의 계산 Promise를 공유한다', async () => {
    const lease = { key: 'lock:ranking:1', ownerToken: 'owner-1' };
    cacheStore.get.mockResolvedValue(null);
    distributedLock.tryAcquire.mockResolvedValue(lease);
    const coordinator = new CacheLoadCoordinator(cacheStore, distributedLock);
    let completeLoad: (value: RankingValue) => void = () => undefined;
    const pendingLoad = new Promise<RankingValue>(resolve => {
      completeLoad = resolve;
    });
    const load = jest.fn().mockReturnValue(pendingLoad);
    const options = createOptions(load);

    const leaderResultPromise = coordinator.getOrLoad(options);
    const followerResultPromise = coordinator.getOrLoad(options);
    completeLoad({ members: [1, 2] });

    await expect(leaderResultPromise).resolves.toEqual({
      value: { members: [1, 2] },
      source: 'computed',
    });
    await expect(followerResultPromise).resolves.toEqual({
      value: { members: [1, 2] },
      source: 'local-follower',
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(distributedLock.release).toHaveBeenCalledWith(lease);
  });

  it('분산 락을 얻지 못한 요청은 락 소유자가 채운 캐시를 사용한다', async () => {
    const cachedValue = { members: [3] };
    cacheStore.get.mockResolvedValueOnce(null).mockResolvedValueOnce(cachedValue);
    distributedLock.tryAcquire.mockResolvedValue(null);
    const coordinator = new CacheLoadCoordinator(cacheStore, distributedLock);
    const load = jest.fn();

    const result = await coordinator.getOrLoad(createOptions(load));

    expect(result).toEqual({ value: cachedValue, source: 'distributed-follower' });
    expect(load).not.toHaveBeenCalled();
    expect(distributedLock.release).not.toHaveBeenCalled();
  });

  it('원본 계산이 실패해도 획득한 분산 락을 해제한다', async () => {
    const lease = { key: 'lock:ranking:1', ownerToken: 'owner-1' };
    cacheStore.get.mockResolvedValue(null);
    distributedLock.tryAcquire.mockResolvedValue(lease);
    const coordinator = new CacheLoadCoordinator(cacheStore, distributedLock);
    const load = jest.fn().mockRejectedValue(new Error('계산 실패'));

    await expect(coordinator.getOrLoad(createOptions(load))).rejects.toThrow('계산 실패');
    expect(distributedLock.release).toHaveBeenCalledWith(lease);
  });

  function createOptions(load: () => Promise<RankingValue>) {
    return {
      cacheKey: 'ranking:1',
      ttlSeconds: 60,
      isValid: (value: unknown): value is RankingValue => {
        if (!value || typeof value !== 'object') {
          return false;
        }
        return Array.isArray((value as { members?: unknown }).members);
      },
      load,
    };
  }
});
