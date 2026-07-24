import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';

import type { Environment } from '../common/config/environment.js';

@Injectable()
export class AdvisoryLockService {
  private readonly databaseUrl: string;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    this.databaseUrl = config.get('DATABASE_URL', { infer: true });
  }

  async withLock<T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<{ acquired: false } | { acquired: true; value: T }> {
    const client = new Client({
      connectionString: this.databaseUrl,
      connectionTimeoutMillis: 5_000,
      query_timeout: 30_000,
      statement_timeout: 30_000,
    });
    await client.connect();
    let acquired = false;
    try {
      const result = await client.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired',
        [key],
      );
      acquired = result.rows[0]?.acquired === true;
      if (!acquired) {
        return { acquired: false };
      }
      return { acquired: true, value: await operation() };
    } finally {
      if (acquired) {
        await client.query(
          'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
          [key],
        );
      }
      await client.end();
    }
  }
}
