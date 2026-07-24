import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Test, type TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  JobStatus,
  JobTrigger,
  JobType,
} from '../src/generated/prisma/client.js';
import { IngestionCaptureService } from '../src/ingestion/ingestion-capture.service.js';
import { parseTeams } from '../src/ingestion/providers/nhl/nhl.schemas.js';
import { ProviderValidationError } from '../src/ingestion/providers/provider.errors.js';
import type {
  ProviderFetch,
  ProviderTeam,
} from '../src/ingestion/providers/provider.types.js';
import { AdvisoryLockService } from '../src/jobs/advisory-lock.service.js';
import { JobCoordinatorService } from '../src/jobs/job-coordinator.service.js';
import { JobExecutionService } from '../src/jobs/job-execution.service.js';
import { ReplayService } from '../src/jobs/replay.service.js';
import { EMPTY_JOB_COUNTS } from '../src/jobs/job.types.js';
import { allocatePort } from './support/allocate-port.js';
import {
  createPostgresTestDatabaseConfiguration,
  startPostgresTestContainer,
  type StartedPostgresTestDatabase,
} from './support/postgres-test-container.js';

const prismaCliPath = fileURLToPath(
  new URL('../../../node_modules/prisma/build/index.js', import.meta.url),
);
const fixturePath = fileURLToPath(
  new URL('./fixtures/nhl/teams.json', import.meta.url),
);

describe('provider and ingestion framework', () => {
  let advisoryLocks: AdvisoryLockService;
  let capture: IngestionCaptureService;
  let coordinator: JobCoordinatorService;
  let database: StartedPostgresTestDatabase;
  let executions: JobExecutionService;
  let module: TestingModule;
  let pool: Pool;
  let replay: ReplayService;

  beforeAll(async () => {
    const hostPort = await allocatePort();
    const configuration = createPostgresTestDatabaseConfiguration(hostPort);
    database = await startPostgresTestContainer(configuration, hostPort);
    pool = new Pool({ connectionString: database.databaseUrl });
    await runNode([prismaCliPath, 'migrate', 'deploy'], database.databaseUrl);

    process.env['APP_ENV'] = 'test';
    process.env['APP_VERSION'] = 'ingestion-integration';
    process.env['CORS_ALLOWED_ORIGINS'] = 'http://localhost:4200';
    process.env['DATABASE_URL'] = database.databaseUrl;
    process.env['LOG_LEVEL'] = 'error';
    process.env['NHL_STATS_API_BASE_URL'] = 'https://stats.invalid/';
    process.env['NHL_WEB_API_BASE_URL'] = 'https://web.invalid/v1/';
    process.env['NODE_ENV'] = 'test';
    process.env['PROVIDER_MAX_CONCURRENCY'] = '4';
    process.env['PROVIDER_TIMEOUT_MS'] = '1000';

    const { JobRunnerModule } = await import('../src/job-runner.module.js');
    module = await Test.createTestingModule({
      imports: [JobRunnerModule],
    }).compile();
    advisoryLocks = module.get(AdvisoryLockService);
    capture = module.get(IngestionCaptureService);
    coordinator = module.get(JobCoordinatorService);
    executions = module.get(JobExecutionService);
    replay = module.get(ReplayService);
  });

  afterAll(async () => {
    await module?.close();
    await pool?.end();
    await database?.container.stop();
  });

  it('stores raw payloads before transformation and deduplicates identical runs', async () => {
    const body = new Uint8Array(await readFile(fixturePath));
    const order: string[] = [];
    const fetch = teamFetch(body, () => {
      order.push('validate');
      return parseTeams(JSON.parse(new TextDecoder().decode(body)) as unknown);
    });

    const first = await coordinator.run(manualTeamsRequest(), async (id) => {
      order.push('operation');
      const captured = await capture.captureAndValidate(fetch, id);
      order.push('captured');
      return {
        counts: {
          ...EMPTY_JOB_COUNTS,
          recordsCreated: captured.created ? 1 : 0,
          recordsFetched: 1,
        },
        status: JobStatus.SUCCEEDED,
      };
    });
    const second = await coordinator.run(manualTeamsRequest(), async (id) => {
      const captured = await capture.captureAndValidate(fetch, id);
      return {
        counts: {
          ...EMPTY_JOB_COUNTS,
          recordsFetched: 1,
          recordsUnchanged: captured.created ? 0 : 1,
        },
        status: JobStatus.SUCCEEDED,
      };
    });

    const payloads = await pool.query<{
      checksum: string;
      payload_count: number;
      status: string;
    }>(`
      SELECT
        count(*)::int AS payload_count,
        min(checksum) AS checksum,
        min(status::text) AS status
      FROM raw.provider_payload
      WHERE resource_type = 'teams'
    `);
    const core = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM core.team',
    );

    expect(order).toEqual(['operation', 'validate', 'captured', 'validate']);
    expect(first.counts.recordsCreated).toBe(1);
    expect(second.counts.recordsUnchanged).toBe(1);
    expect(payloads.rows[0]).toEqual({
      checksum: createHash('sha256').update(body).digest('hex'),
      payload_count: 1,
      status: 'VALIDATED',
    });
    expect(core.rows[0]?.count).toBe(0);
  });

  it('retains rejected payloads and records validation issues', async () => {
    const fetch = teamFetch(
      new TextEncoder().encode('{"data":[{"fullName":"Invalid"}]}'),
      () => {
        throw new ProviderValidationError('teams', ['data.0.id: required']);
      },
    );

    const result = await coordinator.run(
      {
        jobType: JobType.TEAMS,
        parameters: { fixture: 'malformed' },
        trigger: JobTrigger.MANUAL,
      },
      async (id) => {
        await capture.captureAndValidate(fetch, id);
        return { counts: EMPTY_JOB_COUNTS, status: JobStatus.SUCCEEDED };
      },
    );
    const rejected = await pool.query<{ issues: number; status: string }>(`
      SELECT payload.status::text AS status, count(issue.id)::int AS issues
      FROM raw.provider_payload AS payload
      LEFT JOIN ops.import_issue AS issue
        ON issue.provider_payload_id = payload.id
      WHERE payload.external_key = 'malformed'
      GROUP BY payload.status
    `);

    expect(result.status).toBe(JobStatus.FAILED);
    expect(rejected.rows[0]).toEqual({ issues: 1, status: 'REJECTED' });
  });

  it('replays preserved data without network access or duplicate raw/core rows', async () => {
    const payload = await pool.query<{ id: string }>(`
      SELECT id
      FROM raw.provider_payload
      WHERE external_key = 'nhl'
      LIMIT 1
    `);
    const payloadId = payload.rows[0]!.id;

    const result = await replay.replay(payloadId);
    const counts = await pool.query<{
      core_teams: number;
      payloads: number;
      replay_jobs: number;
    }>(
      `
      SELECT
        (SELECT count(*)::int FROM raw.provider_payload) AS payloads,
        (SELECT count(*)::int FROM core.team) AS core_teams,
        (
          SELECT count(*)::int
          FROM ops.job_execution
          WHERE trigger = 'REPLAY'
            AND parameters->>'payloadId' = $1
        ) AS replay_jobs
    `,
      [payloadId],
    );

    expect(result).toMatchObject({
      counts: { recordsFetched: 1, recordsUnchanged: 1 },
      status: JobStatus.SUCCEEDED,
    });
    expect(counts.rows[0]).toEqual({
      core_teams: 0,
      payloads: 2,
      replay_jobs: 1,
    });
  });

  it('does not wait when an advisory lock is already held', async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = vi.fn();
    const first = advisoryLocks.withLock('integration-lock', async () => {
      entered();
      await held;
      return 'first';
    });
    await vi.waitFor(() => expect(entered).toHaveBeenCalledOnce());

    const second = await advisoryLocks.withLock('integration-lock', () =>
      Promise.resolve('second'),
    );
    release();

    await expect(first).resolves.toEqual({ acquired: true, value: 'first' });
    expect(second).toEqual({ acquired: false });
  });

  it('creates a skipped execution for a contended logical job', async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = vi.fn();
    const request = {
      jobType: JobType.SCHEDULE,
      parameters: { date: '2026-01-15' },
      trigger: JobTrigger.MANUAL,
    } as const;
    const first = coordinator.run(request, async () => {
      entered();
      await held;
      return { counts: EMPTY_JOB_COUNTS, status: JobStatus.SUCCEEDED };
    });
    await vi.waitFor(() => expect(entered).toHaveBeenCalledOnce());

    const second = await coordinator.run(request, () =>
      Promise.resolve({
        counts: EMPTY_JOB_COUNTS,
        status: JobStatus.SUCCEEDED,
      }),
    );
    release();
    await first;

    expect(second).toMatchObject({
      errorSummary: { code: 'LOCK_UNAVAILABLE' },
      status: JobStatus.SKIPPED,
    });
  });

  it('reconciles abandoned running executions', async () => {
    const id = await executions.create({
      jobType: JobType.STANDINGS,
      parameters: {},
      trigger: JobTrigger.SCHEDULED,
    });
    await executions.start(id);
    await pool.query(
      `UPDATE ops.job_execution
       SET requested_at = now() - interval '32 minutes',
           started_at = now() - interval '31 minutes'
       WHERE id = $1`,
      [id],
    );

    expect(await executions.reconcileAbandoned()).toBe(1);
    const execution = await pool.query<{
      finished_at: Date | null;
      status: string;
    }>(
      'SELECT status::text, finished_at FROM ops.job_execution WHERE id = $1',
      [id],
    );
    expect(execution.rows[0]?.status).toBe('FAILED');
    expect(execution.rows[0]?.finished_at).toBeInstanceOf(Date);
  });
});

function manualTeamsRequest() {
  return {
    jobType: JobType.TEAMS,
    parameters: {},
    trigger: JobTrigger.MANUAL,
  } as const;
}

function teamFetch(
  body: Uint8Array,
  validate: () => ProviderTeam[],
): ProviderFetch<ProviderTeam[]> {
  return {
    body,
    contentType: 'application/json',
    descriptor: {
      externalKey: body.byteLength < 100 ? 'malformed' : 'nhl',
      parameters: {},
      path: '/team',
      resourceType: 'teams',
    },
    fetchedAt: new Date('2026-07-22T12:00:00Z'),
    httpStatus: 200,
    provider: 'nhl',
    validate,
  };
}

function runNode(arguments_: string[], databaseUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, arguments_, {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: {
        ...process.env,
        APP_ENV: 'test',
        DATABASE_URL: databaseUrl,
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Prisma command failed:\n${stderr}`));
      }
    });
  });
}
