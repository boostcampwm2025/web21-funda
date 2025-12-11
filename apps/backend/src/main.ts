import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.listen(process.env.PORT ?? 3000);

  const logger = new Logger('Bootstrap');
  logger.log(`Backend listening on port ${process.env.PORT ?? 3000}`);
}

bootstrap();
