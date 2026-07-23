import {
  Injectable,
  Inject,
  type OnApplicationShutdown,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

import type { Environment } from '../config/environment.js';

const DATABASE_HEALTH_TIMEOUT_MS = 2_000;

@Injectable()
export class DatabaseHealthService
  implements OnApplicationShutdown, OnModuleDestroy
{
  private readonly pool: Pool;
  private closePromise: Promise<void> | undefined;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    this.pool = new Pool({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      connectionTimeoutMillis: DATABASE_HEALTH_TIMEOUT_MS,
      idleTimeoutMillis: 10_000,
      max: 2,
      query_timeout: DATABASE_HEALTH_TIMEOUT_MS,
    });
    this.pool.on('error', () => {
      // Readiness reports database loss; an idle-client error must not crash
      // the otherwise-live API process.
    });
  }

  async isReady(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  private close(): Promise<void> {
    this.closePromise ??= this.pool.end();
    return this.closePromise;
  }
}
