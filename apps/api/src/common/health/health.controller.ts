import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { DatabaseHealthService } from './database-health.service.js';

interface HealthResponse {
  status: 'ok';
}

@ApiExcludeController()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DatabaseHealthService)
    private readonly databaseHealth: DatabaseHealthService,
  ) {}

  @Get('live')
  liveness(): HealthResponse {
    return { status: 'ok' };
  }

  @Get('ready')
  async readiness(): Promise<HealthResponse> {
    if (!(await this.databaseHealth.isReady())) {
      throw new ServiceUnavailableException({ status: 'unavailable' });
    }

    return { status: 'ok' };
  }
}
