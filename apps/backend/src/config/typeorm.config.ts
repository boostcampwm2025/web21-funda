import { ConfigService } from '@nestjs/config';
import { type DataSourceOptions } from 'typeorm';

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const createTypeOrmOptions = (config: ConfigService): DataSourceOptions => ({
  type: 'mysql',
  host: config.get<string>('DB_HOST', 'localhost'),
  port: toInt(config.get<string>('DB_PORT'), 3306),
  username: config.get<string>('DB_USER', 'root'),
  password: config.get<string>('DB_PASSWORD', ''),
  database: config.get<string>('DB_NAME', 'app'),
  entities: [],
  synchronize: false,
  logging: false,
});
