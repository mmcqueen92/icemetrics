import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

import { DatabaseHealthService } from './database-health.service.js';
import type { Environment } from '../config/environment.js';

interface HealthResponse {
  environment: Environment['APP_ENV'];
  release: string;
  status: 'ok';
}

@ApiExcludeController()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DatabaseHealthService)
    private readonly databaseHealth: DatabaseHealthService,
    @Inject(ConfigService)
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Get('live')
  liveness(): HealthResponse {
    return this.response();
  }

  @Get('ready')
  async readiness(): Promise<HealthResponse> {
    if (!(await this.databaseHealth.isReady())) {
      throw new ServiceUnavailableException({ status: 'unavailable' });
    }

    return this.response();
  }

  private response(): HealthResponse {
    return {
      environment: this.config.get('APP_ENV', { infer: true }),
      release: this.config.get('APP_VERSION', { infer: true }) ?? 'development',
      status: 'ok',
    };
  }
}
