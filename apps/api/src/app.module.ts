import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { ApiExceptionFilter } from './common/errors/api-exception.filter.js';
import { validateEnvironment } from './common/config/environment.js';
import { HealthModule } from './common/health/health.module.js';
import { HttpCacheInterceptor } from './common/http/http-cache.interceptor.js';
import { ResponseEnvelopeInterceptor } from './common/http/response-envelope.interceptor.js';
import { LoggingModule } from './common/logging/logging.module.js';
import { ApiThrottlerGuard } from './common/rate-limit/api-throttler.guard.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: ['../../.env', '.env'],
      isGlobal: true,
      validate: validateEnvironment,
    }),
    LoggingModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          limit: config.get<number>('RATE_LIMIT_PER_MINUTE') ?? 120,
          ttl: 60_000,
        },
      ],
    }),
    DatabaseModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseEnvelopeInterceptor,
    },
  ],
})
export class AppModule {}
