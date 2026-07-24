import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import type { Environment } from '../config/environment.js';
import { createHttpLoggingOptions } from './http-logging.js';

@Module({
  exports: [PinoLoggerModule],
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        pinoHttp: createHttpLoggingOptions({
          APP_ENV: config.get('APP_ENV', { infer: true }),
          APP_VERSION: config.get('APP_VERSION', { infer: true }),
          LOG_LEVEL: config.get('LOG_LEVEL', { infer: true }),
        }),
      }),
    }),
  ],
})
export class LoggingModule {}
