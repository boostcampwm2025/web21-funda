import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

import type { CacheStore } from '../cache/cache-store';

@Injectable()
export class RedisService implements CacheStore, OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
    });
  }

  onModuleDestroy() {
    this.client.disconnect();
  }

  // 데이터 저장 (TTL 포함)
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  // 데이터 가져오기
  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    return data ? (JSON.parse(data) as T) : null;
  }

  // 데이터 삭제
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * 키가 없을 때만 값을 밀리초 TTL과 함께 저장한다.
   *
   * 분산 락 획득을 하나의 Redis 명령으로 처리해 인스턴스 간 경쟁을 원자적으로 조정한다.
   *
   * @param key 저장할 키
   * @param value 락 소유권을 식별할 값
   * @param ttlMilliseconds 만료 시간(밀리초)
   * @returns 저장에 성공했으면 true
   */
  async setIfAbsent(key: string, value: string, ttlMilliseconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'PX', ttlMilliseconds, 'NX');
    return result === 'OK';
  }

  /**
   * 현재 값이 예상한 소유권 토큰과 일치할 때만 키를 삭제한다.
   *
   * 만료된 락을 새로 획득한 다른 인스턴스의 락을 지우지 않도록 비교와 삭제를
   * 하나의 Lua 스크립트로 실행한다.
   *
   * @param key 삭제할 키
   * @param expectedValue 락을 획득할 때 발급한 소유권 토큰
   * @returns 키를 삭제했으면 true
   */
  async compareAndDelete(key: string, expectedValue: string): Promise<boolean> {
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      end
      return 0
    `;
    const result = await this.client.eval(script, 1, key, expectedValue);
    return Number(result) === 1;
  }
}
