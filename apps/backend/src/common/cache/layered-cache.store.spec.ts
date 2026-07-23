import { RedisService } from '../redis/redis.service';

import { LayeredCacheStore } from './layered-cache.store';
import { LocalCacheStore } from './local-cache.store';

describe('LayeredCacheStore', () => {
  const originalLocalTtl = process.env.RANKING_LOCAL_CACHE_TTL_SECONDS;
  let localCacheStore: LocalCacheStore;
  let redisService: Pick<RedisService, 'get' | 'set' | 'del'>;
  let cacheStore: LayeredCacheStore;

  beforeEach(() => {
    process.env.RANKING_LOCAL_CACHE_TTL_SECONDS = '2';
    localCacheStore = new LocalCacheStore();
    redisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
    cacheStore = new LayeredCacheStore(localCacheStore, redisService as RedisService);
  });

  afterAll(() => {
    if (originalLocalTtl === undefined) {
      delete process.env.RANKING_LOCAL_CACHE_TTL_SECONDS;
    } else {
      process.env.RANKING_LOCAL_CACHE_TTL_SECONDS = originalLocalTtl;
    }
  });

  it('L1에 값이 있으면 Redis를 조회하지 않는다', async () => {
    await cacheStore.set('ranking:1', { rank: 1 }, 60);

    const result = await cacheStore.get('ranking:1');

    expect(result).toEqual({ rank: 1 });
    expect(redisService.get).not.toHaveBeenCalled();
    expect(redisService.set).toHaveBeenCalledWith('ranking:1', { rank: 1 }, 60);
  });

  it('L2에서 조회한 값을 L1에 채워 다음 요청에서 재사용한다', async () => {
    (redisService.get as jest.Mock).mockResolvedValue({ rank: 2 });

    const firstResult = await cacheStore.get('ranking:2');
    const secondResult = await cacheStore.get('ranking:2');

    expect(firstResult).toEqual({ rank: 2 });
    expect(secondResult).toEqual({ rank: 2 });
    expect(redisService.get).toHaveBeenCalledTimes(1);
  });

  it('삭제 요청을 두 캐시 계층에 모두 반영한다', async () => {
    await cacheStore.set('ranking:3', { rank: 3 }, 60);

    await cacheStore.del('ranking:3');

    expect(await localCacheStore.get('ranking:3')).toBeNull();
    expect(redisService.del).toHaveBeenCalledWith('ranking:3');
  });
});
