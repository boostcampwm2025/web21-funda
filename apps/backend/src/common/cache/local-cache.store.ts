import { Injectable } from '@nestjs/common';

import type { CacheStore } from './cache-store';

interface LocalCacheEntry {
  value: unknown;
  expiresAt: number;
}

const DEFAULT_MAX_ENTRIES = 1_000;

/**
 * 한 애플리케이션 인스턴스 안에서 사용하는 크기 제한 LRU 캐시다.
 *
 * 오래된 값을 무기한 보관하지 않도록 항목별 TTL을 적용하고, 최대 개수를 넘으면
 * 가장 오랫동안 사용하지 않은 항목부터 제거한다.
 */
@Injectable()
export class LocalCacheStore implements CacheStore {
  private readonly entries = new Map<string, LocalCacheEntry>();
  private readonly maxEntries = this.readPositiveInteger(
    process.env.RANKING_LOCAL_CACHE_MAX_ENTRIES,
    DEFAULT_MAX_ENTRIES,
  );

  /**
   * 만료되지 않은 값을 조회하고 최근 사용 항목으로 갱신한다.
   *
   * @param key 캐시 키
   * @returns 저장된 값 또는 캐시 미스일 때 null
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value as T;
  }

  /**
   * 값을 TTL과 함께 저장하고 최대 항목 수를 유지한다.
   *
   * @param key 캐시 키
   * @param value 저장할 값
   * @param ttlSeconds 만료 시간(초)
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) {
      this.entries.delete(key);
      return;
    }

    this.entries.delete(key);
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1_000,
    });

    this.evictLeastRecentlyUsedEntry();
  }

  /**
   * 로컬 캐시에서 키를 제거한다.
   *
   * @param key 캐시 키
   */
  async del(key: string): Promise<void> {
    this.entries.delete(key);
  }

  private evictLeastRecentlyUsedEntry(): void {
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey === undefined) {
        return;
      }
      this.entries.delete(oldestKey);
    }
  }

  private readPositiveInteger(rawValue: string | undefined, fallback: number): number {
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }
}
