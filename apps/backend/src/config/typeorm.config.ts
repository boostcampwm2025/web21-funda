import path from 'node:path';

import { ConfigService } from '@nestjs/config';
import { type DataSourceOptions } from 'typeorm';

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isNaN(parsed) ? fallback : parsed;
};

const entityPaths = [path.join(__dirname, '..', '**', '*.entity.{ts,js}')];

export const createTypeOrmOptions = (config: ConfigService): DataSourceOptions => ({
  type: 'mysql',
  host: config.get<string>('DB_HOST', 'localhost'),
  port: toInt(config.get<string>('DB_PORT'), 3306),
  username: config.get<string>('DB_USER', 'root'),
  password: config.get<string>('DB_PASSWORD', ''),
  database: config.get<string>('DB_NAME', 'app'),
  // 엔티티 추가 시마다 목록을 수정하지 않도록 글롭 패턴으로 자동 로드한다.
  entities: entityPaths,
  synchronize: false,
  logging: config.get<string>('NODE_ENV') !== 'production',
  // 커넥션 풀 크기. 미설정 시 mysql2 기본값(10)과 동일하게 유지해 기존 동작을 보존하되,
  // 운영부하 실험에서 풀을 변인으로 통제할 수 있도록 DB_POOL_SIZE로 노출한다.
  extra: {
    connectionLimit: toInt(config.get<string>('DB_POOL_SIZE'), 10),
  },
});
