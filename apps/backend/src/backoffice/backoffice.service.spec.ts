import { BadRequestException } from '@nestjs/common';
import type { DataSource, EntityManager, Repository } from 'typeorm';

import { RedisService } from '../common/redis/redis.service';
import { CodeFormatter } from '../common/utils/code-formatter';
import { Unit } from '../roadmap/entities/unit.entity';

import { BackofficeService } from './backoffice.service';

describe('BackofficeService', () => {
  let service: BackofficeService;
  let dataSource: Partial<DataSource>;
  let manager: Partial<EntityManager>;
  let unitRepository: Partial<Repository<Unit>>;
  let transactionMock: jest.Mock;
  let redisService: Partial<RedisService>;
  let codeFormatter: Partial<CodeFormatter>;

  beforeEach(() => {
    unitRepository = {
      find: jest.fn(),
      save: jest.fn(),
    };

    manager = {
      getRepository: jest.fn().mockReturnValue(unitRepository),
    };

    transactionMock = jest.fn(async (arg1: unknown, arg2?: unknown) => {
      const work = typeof arg1 === 'function' ? arg1 : arg2;
      if (typeof work !== 'function') {
        throw new Error('transaction 콜백이 없습니다.');
      }
      await work(manager as EntityManager);
    });

    dataSource = {
      transaction: transactionMock as DataSource['transaction'],
    };

    redisService = {
      del: jest.fn(),
    };

    codeFormatter = {
      format: jest.fn().mockImplementation(async (code: string) => code),
    };

    service = new BackofficeService(
      dataSource as DataSource,
      redisService as RedisService,
      codeFormatter as CodeFormatter,
    );
  });

  it('유닛 개요를 업로드하면 해당 유닛의 개요를 업데이트한다', async () => {
    (unitRepository.find as jest.Mock).mockResolvedValue([
      { id: 1, title: 'HTML', overview: 'old' } as Unit,
    ]);
    (unitRepository.save as jest.Mock).mockImplementation(async (unit: Unit) => unit);

    const fileBuffer = Buffer.from(
      JSON.stringify({ unit_title: 'HTML', overview: '### 새 개요' }) + '\n',
    );

    const result = await service.uploadUnitOverviewsFromJsonl(fileBuffer);

    expect(result).toEqual({
      processed: 1,
      unitsUpdated: 1,
      unitsNotFound: 0,
    });
    expect(unitRepository.save).toHaveBeenCalledWith({
      id: 1,
      title: 'HTML',
      overview: '### 새 개요',
    });
  });

  it('유닛이 없으면 not found 수를 증가시킨다', async () => {
    (unitRepository.find as jest.Mock).mockResolvedValue([]);

    const fileBuffer = Buffer.from(
      JSON.stringify({ unit_title: 'CSS', overview: '### 개요' }) + '\n',
    );

    const result = await service.uploadUnitOverviewsFromJsonl(fileBuffer);

    expect(result).toEqual({
      processed: 1,
      unitsUpdated: 0,
      unitsNotFound: 1,
    });
  });

  it('필수 필드가 누락되면 예외를 던진다', async () => {
    const fileBuffer = Buffer.from(JSON.stringify({ unit_title: '' }) + '\n');

    await expect(service.uploadUnitOverviewsFromJsonl(fileBuffer)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
