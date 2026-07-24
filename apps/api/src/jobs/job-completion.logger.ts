import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino, { type Logger } from 'pino';

import type { Environment } from '../common/config/environment.js';
import type { JobRunResult } from './job.types.js';

@Injectable()
export class JobCompletionLogger {
  private readonly logger: Logger;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    this.logger = pino({
      base: {
        environment: String(config.get('APP_ENV', { infer: true })),
        release: String(
          config.get('APP_VERSION', { infer: true }) ?? 'development',
        ),
        service: 'icemetrics-jobs',
      },
      level: config.get('LOG_LEVEL', { infer: true }),
    });
  }

  completed(jobType: string, result: JobRunResult, durationMs: number): void {
    this.logger.info(
      {
        ...result.counts,
        durationMs,
        jobExecutionId: result.executionId,
        jobType,
        status: result.status,
      },
      'job completed',
    );
  }
}
