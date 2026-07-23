/** 분산 락을 획득한 주체가 소유권을 증명하기 위해 사용하는 임대 정보다. */
export interface DistributedLockLease {
  key: string;
  ownerToken: string;
}

/**
 * 분산 락 구현이 제공해야 하는 공통 계약이다.
 *
 * 캐시 재계산 흐름이 Redis 명령 같은 구체 기술에 의존하지 않도록 락 동작만 노출한다.
 */
export interface DistributedLock {
  /**
   * 지정한 시간 동안 유효한 락 획득을 시도한다.
   *
   * @param key 락 키
   * @param ttlMilliseconds 락 만료 시간(밀리초)
   * @returns 획득한 락 임대 정보 또는 다른 소유자가 있을 때 null
   */
  tryAcquire(key: string, ttlMilliseconds: number): Promise<DistributedLockLease | null>;

  /**
   * 현재 소유자가 보유한 락만 해제한다.
   *
   * @param lease 해제할 락의 임대 정보
   */
  release(lease: DistributedLockLease): Promise<void>;
}

/** NestJS에서 분산 락 구현을 교체하기 위한 주입 토큰이다. */
export const DISTRIBUTED_LOCK = Symbol('DISTRIBUTED_LOCK');
