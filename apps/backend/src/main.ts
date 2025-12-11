import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get<string>('CLIENT_ORIGIN', 'http://localhost:5173'),
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Backend listening on port ${port}`);
}

bootstrap();
