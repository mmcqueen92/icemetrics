import {
  Inject,
  Injectable,
  type OnApplicationShutdown,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import type { Environment } from '../common/config/environment.js';
import { PrismaClient } from '../generated/prisma/client.js';

const API_STATEMENT_TIMEOUT_MS = 5_000;
const DATABASE_CONNECTION_TIMEOUT_MS = 5_000;
const DATABASE_HEALTH_TIMEOUT_MS = 2_000;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnApplicationShutdown, OnModuleDestroy
{
  private readonly pool: Pool;
  private disconnectPromise: Promise<void> | undefined;

  constructor(
    @Inject(ConfigService)
    config: ConfigService<Environment, true>,
  ) {
    const pool = new Pool({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      connectionTimeoutMillis: DATABASE_CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: 30_000,
      max: 10,
      query_timeout: API_STATEMENT_TIMEOUT_MS,
      statement_timeout: API_STATEMENT_TIMEOUT_MS,
    });
    const adapter = new PrismaPg(pool, {
      disposeExternalPool: false,
      onPoolError: () => {
        // Readiness reports database loss. Idle-client errors must not crash
        // the API process or disclose connection details.
      },
    });

    super({ adapter });
    this.pool = pool;
  }

  async isReady(): Promise<boolean> {
    try {
      await withTimeout(
        this.pool.query('SELECT 1'),
        DATABASE_HEALTH_TIMEOUT_MS,
      );
      return true;
    } catch {
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.disconnect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private disconnect(): Promise<void> {
    this.disconnectPromise ??= this.closeConnections();
    return this.disconnectPromise;
  }

  private async closeConnections(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMilliseconds: number,
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Database readiness timed out')),
          timeoutMilliseconds,
        );
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
