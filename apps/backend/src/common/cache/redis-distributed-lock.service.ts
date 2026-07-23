import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';

import type { DistributedLock, DistributedLockLease } from './distributed-lock';

/**
 * Redis의 원자적 조건부 저장과 소유권 확인 삭제를 사용하는 분산 락이다.
 */
@Injectable()
export class RedisDistributedLockService implements DistributedLock {
  constructor(private readonly redisService: RedisService) {}

  /**
   * 다른 인스턴스가 보유하지 않은 락만 획득한다.
   *
   * @param key 락 키
   * @param ttlMilliseconds 락 만료 시간(밀리초)
   * @returns 획득한 락 임대 정보 또는 null
   */
  async tryAcquire(key: string, ttlMilliseconds: number): Promise<DistributedLockLease | null> {
    const ownerToken = randomUUID();
    const acquired = await this.redisService.setIfAbsent(key, ownerToken, ttlMilliseconds);
    if (!acquired) {
      return null;
    }

    return { key, ownerToken };
  }

  /**
   * 락을 획득할 때 발급한 토큰이 일치하는 경우에만 해제한다.
   *
   * @param lease 해제할 락의 임대 정보
   */
  async release(lease: DistributedLockLease): Promise<void> {
    await this.redisService.compareAndDelete(lease.key, lease.ownerToken);
  }
}
