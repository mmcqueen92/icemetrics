import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Pool } from 'pg';
import request from 'supertest';
import type { StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { configureApplication } from '../src/common/configure-application.js';
import { allocatePort } from './support/allocate-port.js';
import {
  createPostgresTestDatabaseConfiguration,
  type PostgresTestDatabaseConfiguration,
  startPostgresTestContainer,
} from './support/postgres-test-container.js';

describe('health endpoints', () => {
  let app: NestExpressApplication;
  let container: StartedTestContainer | undefined;
  let databaseConfiguration: PostgresTestDatabaseConfiguration;
  let hostPort: number;

  beforeAll(async () => {
    hostPort = await allocatePort();
    databaseConfiguration = createPostgresTestDatabaseConfiguration(hostPort);
    process.env['APP_ENV'] = 'test';
    process.env['CORS_ALLOWED_ORIGINS'] = 'http://localhost:4200';
    process.env['DATABASE_URL'] = databaseConfiguration.databaseUrl;
    process.env['LOG_LEVEL'] = 'error';
    process.env['NODE_ENV'] = 'test';

    const { AppModule } = await import('../src/app.module.js');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
    await container?.stop();
  });

  it('keeps liveness independent from PostgreSQL', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({
        environment: 'test',
        release: 'development',
        status: 'ok',
      });

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
    expect(response.headers['ratelimit-limit']).toBeUndefined();
  });

  it('fails readiness while PostgreSQL is unavailable and recovers', async () => {
    const unavailable = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503)
      .expect({ status: 'unavailable' });
    expect(unavailable.headers['ratelimit-limit']).toBeUndefined();

    const database = await startPostgresTestContainer(
      databaseConfiguration,
      hostPort,
    );
    container = database.container;

    expect(database.databaseUrl).toContain(`:${hostPort}/`);
    const probe = new Pool({ connectionString: database.databaseUrl });
    const result = await probe.query<{ database: string }>(
      'SELECT current_database() AS database',
    );
    await probe.end();
    expect(result.rows[0]?.database).toBe(databaseConfiguration.database);

    await request(app.getHttpServer()).get('/health/ready').expect(200).expect({
      environment: 'test',
      release: 'development',
      status: 'ok',
    });
  });

  it('does not expose health endpoints under the product API prefix', async () => {
    await request(app.getHttpServer()).get('/api/v1/health/live').expect(404);
  });
});
