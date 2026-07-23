import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';

import type { CacheStore } from './cache-store';
import { LocalCacheStore } from './local-cache.store';

const DEFAULT_LOCAL_TTL_SECONDS = 5;

/**
 * 로컬 캐시를 L1, Redis를 L2로 사용하는 2계층 캐시다.
 *
 * L1의 TTL을 짧게 제한해 인스턴스 간 데이터 차이가 유지되는 시간을 통제한다.
 */
@Injectable()
export class LayeredCacheStore implements CacheStore {
  private readonly localTtlSeconds = this.readPositiveInteger(
    process.env.RANKING_LOCAL_CACHE_TTL_SECONDS,
    DEFAULT_LOCAL_TTL_SECONDS,
  );

  constructor(
    private readonly localCacheStore: LocalCacheStore,
    private readonly redisService: RedisService,
  ) {}

  /**
   * L1을 먼저 조회하고, 없으면 L2에서 가져와 L1을 채운다.
   *
   * @param key 캐시 키
   * @returns 저장된 값 또는 두 계층 모두 캐시 미스일 때 null
   */
  async get<T>(key: string): Promise<T | null> {
    const localValue = await this.localCacheStore.get<T>(key);
    if (localValue !== null) {
      return localValue;
    }

    const remoteValue = await this.redisService.get<T>(key);
    if (remoteValue === null) {
      return null;
    }

    await this.localCacheStore.set(key, remoteValue, this.localTtlSeconds);
    return remoteValue;
  }

  /**
   * L1에는 짧은 TTL로, L2에는 원래 TTL로 값을 기록한다.
   *
   * Redis 장애가 발생해도 현재 인스턴스는 계산 결과를 재사용할 수 있도록 L1을 먼저 갱신한다.
   *
   * @param key 캐시 키
   * @param value 저장할 값
   * @param ttlSeconds L2 만료 시간(초)
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const effectiveLocalTtl = Math.min(ttlSeconds, this.localTtlSeconds);
    await this.localCacheStore.set(key, value, effectiveLocalTtl);
    await this.redisService.set(key, value, ttlSeconds);
  }

  /**
   * 두 캐시 계층에서 키를 제거한다.
   *
   * @param key 캐시 키
   */
  async del(key: string): Promise<void> {
    await this.localCacheStore.del(key);
    await this.redisService.del(key);
  }

  private readPositiveInteger(rawValue: string | undefined, fallback: number): number {
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }
}
