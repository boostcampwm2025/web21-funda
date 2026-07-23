import { Inject, Injectable } from '@nestjs/common';

import { CACHE_STORE, type CacheStore } from './cache-store';
import {
  DISTRIBUTED_LOCK,
  type DistributedLock,
  type DistributedLockLease,
} from './distributed-lock';

const DEFAULT_LOCK_TTL_MILLISECONDS = 10_000;
const DEFAULT_WAIT_TIMEOUT_MILLISECONDS = 10_000;
const DEFAULT_POLL_INTERVAL_MILLISECONDS = 50;

export type CacheLoadSource =
  | 'cache'
  | 'local-follower'
  | 'distributed-follower'
  | 'computed'
  | 'fallback';

export interface CacheLoadResult<T> {
  value: T;
  source: CacheLoadSource;
}

export interface CacheLoadOptions<T> {
  cacheKey: string;
  ttlSeconds: number;
  isValid: (value: unknown) => value is T;
  load: () => Promise<T>;
}

/**
 * 캐시 미스 이후의 중복 재계산을 인스턴스 내부와 인스턴스 사이에서 차단한다.
 *
 * 같은 프로세스의 요청은 하나의 Promise를 공유하고, 프로세스 대표 요청만 분산 락을
 * 획득해 값을 계산한다. 락 획득에 실패한 요청은 캐시가 채워질 때까지 제한된 시간 동안
 * 기다린다.
 */
@Injectable()
export class CacheLoadCoordinator {
  private readonly inflightLoads = new Map<string, Promise<CacheLoadResult<unknown>>>();
  private readonly lockTtlMilliseconds = this.readPositiveInteger(
    process.env.RANKING_CACHE_LOCK_TTL_MS,
    DEFAULT_LOCK_TTL_MILLISECONDS,
  );
  private readonly waitTimeoutMilliseconds = this.readPositiveInteger(
    process.env.RANKING_CACHE_LOCK_WAIT_TIMEOUT_MS,
    DEFAULT_WAIT_TIMEOUT_MILLISECONDS,
  );
  private readonly pollIntervalMilliseconds = this.readPositiveInteger(
    process.env.RANKING_CACHE_LOCK_POLL_INTERVAL_MS,
    DEFAULT_POLL_INTERVAL_MILLISECONDS,
  );

  constructor(
    @Inject(CACHE_STORE)
    private readonly cacheStore: CacheStore,
    @Inject(DISTRIBUTED_LOCK)
    private readonly distributedLock: DistributedLock,
  ) {}

  /**
   * 캐시 값을 반환하거나, 중복 계산을 조정하면서 값을 한 번만 적재한다.
   *
   * @param options 캐시 키, TTL, 검증 함수와 원본 적재 함수
   * @returns 값과 값을 얻은 경로
   */
  async getOrLoad<T>(options: CacheLoadOptions<T>): Promise<CacheLoadResult<T>> {
    const cached = await this.readValidCachedValue(options);
    if (cached !== null) {
      return { value: cached, source: 'cache' };
    }

    const inflight = this.inflightLoads.get(options.cacheKey);
    if (inflight) {
      const result = (await inflight) as CacheLoadResult<T>;
      return { value: result.value, source: 'local-follower' };
    }

    const loadPromise = this.loadAcrossInstances(options);
    this.inflightLoads.set(options.cacheKey, loadPromise);

    try {
      return await loadPromise;
    } finally {
      if (this.inflightLoads.get(options.cacheKey) === loadPromise) {
        this.inflightLoads.delete(options.cacheKey);
      }
    }
  }

  private async loadAcrossInstances<T>(options: CacheLoadOptions<T>): Promise<CacheLoadResult<T>> {
    const lockKey = this.buildLockKey(options.cacheKey);
    let lease: DistributedLockLease | null;

    try {
      lease = await this.distributedLock.tryAcquire(lockKey, this.lockTtlMilliseconds);
    } catch {
      return this.computeWithoutDistributedLock(options);
    }

    if (lease) {
      return this.computeAsLockOwner(options, lease, 'computed');
    }

    return this.waitForLockOwner(options, lockKey);
  }

  private async waitForLockOwner<T>(
    options: CacheLoadOptions<T>,
    lockKey: string,
  ): Promise<CacheLoadResult<T>> {
    const deadline = Date.now() + this.waitTimeoutMilliseconds;

    while (Date.now() < deadline) {
      await this.delay(this.pollIntervalMilliseconds);

      const cached = await this.readValidCachedValue(options);
      if (cached !== null) {
        return { value: cached, source: 'distributed-follower' };
      }

      let lease: DistributedLockLease | null;
      try {
        lease = await this.distributedLock.tryAcquire(lockKey, this.lockTtlMilliseconds);
      } catch {
        return this.computeWithoutDistributedLock(options);
      }

      if (lease) {
        return this.computeAsLockOwner(options, lease, 'computed');
      }
    }

    return this.computeWithoutDistributedLock(options);
  }

  private async computeAsLockOwner<T>(
    options: CacheLoadOptions<T>,
    lease: DistributedLockLease,
    source: CacheLoadSource,
  ): Promise<CacheLoadResult<T>> {
    try {
      const cached = await this.readValidCachedValue(options);
      if (cached !== null) {
        return { value: cached, source: 'distributed-follower' };
      }

      const value = await options.load();
      await this.writeCacheWithoutBlockingResponse(options, value);
      return { value, source };
    } finally {
      try {
        await this.distributedLock.release(lease);
      } catch {
        // TTL이 락을 최종 해제하므로 Redis 장애 시 응답을 실패시키지 않는다.
      }
    }
  }

  private async computeWithoutDistributedLock<T>(
    options: CacheLoadOptions<T>,
  ): Promise<CacheLoadResult<T>> {
    const value = await options.load();
    await this.writeCacheWithoutBlockingResponse(options, value);
    return { value, source: 'fallback' };
  }

  private async readValidCachedValue<T>(options: CacheLoadOptions<T>): Promise<T | null> {
    try {
      const cached = await this.cacheStore.get<unknown>(options.cacheKey);
      return options.isValid(cached) ? cached : null;
    } catch {
      return null;
    }
  }

  private async writeCacheWithoutBlockingResponse<T>(
    options: CacheLoadOptions<T>,
    value: T,
  ): Promise<void> {
    try {
      await this.cacheStore.set(options.cacheKey, value, options.ttlSeconds);
    } catch {
      // 계산 결과를 반환할 수 있으므로 캐시 장애를 요청 오류로 전파하지 않는다.
    }
  }

  private buildLockKey(cacheKey: string): string {
    return `lock:${cacheKey}`;
  }

  private async delay(milliseconds: number): Promise<void> {
    await new Promise<void>(resolve => {
      setTimeout(resolve, milliseconds);
    });
  }

  private readPositiveInteger(rawValue: string | undefined, fallback: number): number {
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }
}
