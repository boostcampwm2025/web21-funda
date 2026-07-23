import { LocalCacheStore } from './local-cache.store';

describe('LocalCacheStore', () => {
  const originalMaxEntries = process.env.RANKING_LOCAL_CACHE_MAX_ENTRIES;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalMaxEntries === undefined) {
      delete process.env.RANKING_LOCAL_CACHE_MAX_ENTRIES;
    } else {
      process.env.RANKING_LOCAL_CACHE_MAX_ENTRIES = originalMaxEntries;
    }
  });

  it('TTL이 지나면 저장된 값을 반환하지 않는다', async () => {
    const cacheStore = new LocalCacheStore();
    await cacheStore.set('ranking:1', { rank: 1 }, 2);

    expect(await cacheStore.get('ranking:1')).toEqual({ rank: 1 });

    jest.advanceTimersByTime(2_000);

    expect(await cacheStore.get('ranking:1')).toBeNull();
  });

  it('최대 항목 수를 넘으면 가장 오랫동안 사용하지 않은 값을 제거한다', async () => {
    process.env.RANKING_LOCAL_CACHE_MAX_ENTRIES = '2';
    const cacheStore = new LocalCacheStore();

    await cacheStore.set('first', 1, 60);
    await cacheStore.set('second', 2, 60);
    await cacheStore.get('first');
    await cacheStore.set('third', 3, 60);

    expect(await cacheStore.get('first')).toBe(1);
    expect(await cacheStore.get('second')).toBeNull();
    expect(await cacheStore.get('third')).toBe(3);
  });
});
