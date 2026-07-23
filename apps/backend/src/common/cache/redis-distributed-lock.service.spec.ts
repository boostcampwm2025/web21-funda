import { RedisService } from '../redis/redis.service';

import { RedisDistributedLockService } from './redis-distributed-lock.service';

describe('RedisDistributedLockService', () => {
  let redisService: Pick<RedisService, 'setIfAbsent' | 'compareAndDelete'>;
  let distributedLock: RedisDistributedLockService;

  beforeEach(() => {
    redisService = {
      setIfAbsent: jest.fn(),
      compareAndDelete: jest.fn(),
    };
    distributedLock = new RedisDistributedLockService(redisService as RedisService);
  });

  it('조건부 저장에 성공하면 소유권 토큰이 포함된 임대 정보를 반환한다', async () => {
    (redisService.setIfAbsent as jest.Mock).mockResolvedValue(true);

    const lease = await distributedLock.tryAcquire('lock:ranking:1', 10_000);

    expect(lease).not.toBeNull();
    expect(redisService.setIfAbsent).toHaveBeenCalledWith(
      'lock:ranking:1',
      lease?.ownerToken,
      10_000,
    );
  });

  it('이미 다른 소유자가 있으면 null을 반환한다', async () => {
    (redisService.setIfAbsent as jest.Mock).mockResolvedValue(false);

    await expect(distributedLock.tryAcquire('lock:ranking:1', 10_000)).resolves.toBeNull();
  });

  it('획득 시 발급한 토큰으로만 락 해제를 요청한다', async () => {
    const lease = { key: 'lock:ranking:1', ownerToken: 'owner-1' };

    await distributedLock.release(lease);

    expect(redisService.compareAndDelete).toHaveBeenCalledWith('lock:ranking:1', 'owner-1');
  });
});
