import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { createTypeOrmOptions } from './typeorm.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'local'}`, '.env'],
    }),
    // TODO: db 연결 설정
    // TypeOrmModule.forRootAsync({
    //   inject: [ConfigService],
    //   useFactory: createTypeOrmOptions,
    // }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
