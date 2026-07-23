/**
 * 캐시 저장소 구현이 제공해야 하는 공통 계약이다.
 *
 * 랭킹 도메인이 Redis 같은 구체 기술을 직접 알지 않도록 읽기/쓰기/삭제 동작만 노출한다.
 */
export interface CacheStore {
  /**
   * 키에 저장된 값을 조회한다.
   *
   * @param key 캐시 키
   * @returns 저장된 값 또는 캐시 미스일 때 null
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * 값을 TTL과 함께 저장한다.
   *
   * @param key 캐시 키
   * @param value 저장할 값
   * @param ttlSeconds 만료 시간(초)
   */
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;

  /**
   * 키에 저장된 값을 삭제한다.
   *
   * @param key 캐시 키
   */
  del(key: string): Promise<void>;
}

/** NestJS에서 캐시 저장소 구현을 교체하기 위한 주입 토큰이다. */
export const CACHE_STORE = Symbol('CACHE_STORE');
