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
  ProviderCollection,
  ProviderFetch,
  ProviderGame,
  ProviderGameBoxscore,
  ProviderPlayer,
  ProviderSeason,
  ProviderStanding,
  ProviderTeam,
  ProviderTeamGameSummary,
} from '../src/ingestion/providers/provider.types.js';
import { GameImportRepository } from '../src/ingestion/games/game-import.repository.js';
import { GameStatisticsImportService } from '../src/ingestion/games/game-statistics-import.service.js';
import { ScheduleImportService } from '../src/ingestion/games/schedule-import.service.js';
import { ImportIssueService } from '../src/ingestion/raw/import-issue.service.js';
import { RawPayloadService } from '../src/ingestion/raw/raw-payload.service.js';
import { PlayersImportService } from '../src/ingestion/reference/players-import.service.js';
import { ReferenceImportRepository } from '../src/ingestion/reference/reference-import.repository.js';
import { TeamsImportService } from '../src/ingestion/reference/teams-import.service.js';
import { StandingsImportRepository } from '../src/ingestion/standings/standings-import.repository.js';
import { StandingsImportService } from '../src/ingestion/standings/standings-import.service.js';
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
  let gameStatisticsImport: GameStatisticsImportService;
  let module: TestingModule;
  let playersImport: PlayersImportService;
  let pool: Pool;
  let replay: ReplayService;
  let scheduleImport: ScheduleImportService;
  let standingsImport: StandingsImportService;
  let teamsImport: TeamsImportService;
  const referenceProvider = new ReferenceFixtureProvider();

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
    const repository = module.get(ReferenceImportRepository);
    const gameRepository = module.get(GameImportRepository);
    const standingsRepository = module.get(StandingsImportRepository);
    const rawPayloads = module.get(RawPayloadService);
    const issues = module.get(ImportIssueService);
    teamsImport = new TeamsImportService(
      referenceProvider,
      capture,
      repository,
      rawPayloads,
      issues,
    );
    playersImport = new PlayersImportService(
      referenceProvider,
      capture,
      repository,
      rawPayloads,
      issues,
    );
    scheduleImport = new ScheduleImportService(
      referenceProvider,
      capture,
      gameRepository,
      rawPayloads,
      issues,
    );
    gameStatisticsImport = new GameStatisticsImportService(
      referenceProvider,
      capture,
      gameRepository,
      rawPayloads,
      issues,
    );
    standingsImport = new StandingsImportService(
      referenceProvider,
      capture,
      standingsRepository,
      rawPayloads,
      issues,
    );
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

  it('imports stable league, season, and team identities idempotently', async () => {
    const first = await coordinator.run(manualTeamsRequest(), (executionId) =>
      teamsImport.execute(executionId, { date: '2026-01-15' }),
    );
    const second = await coordinator.run(manualTeamsRequest(), (executionId) =>
      teamsImport.execute(executionId, { date: '2026-01-15' }),
    );
    const identities = await pool.query<{
      league_identities: number;
      season_identities: number;
      team_identities: number;
      teams: number;
    }>(`
      SELECT
        (SELECT count(*)::int FROM core.league_provider_identity) AS league_identities,
        (SELECT count(*)::int FROM core.season_provider_identity) AS season_identities,
        (SELECT count(*)::int FROM core.team_provider_identity) AS team_identities,
        (SELECT count(*)::int FROM core.team) AS teams
    `);
    const processed = await pool.query<{ count: number }>(`
      SELECT count(*)::int AS count
      FROM raw.provider_payload
      WHERE resource_type IN ('teams', 'standings', 'season')
        AND status = 'PROCESSED'
    `);
    const execution = await pool.query<{ error_summary: unknown }>(
      'SELECT error_summary FROM ops.job_execution WHERE id = $1',
      [first.executionId],
    );

    expect(execution.rows[0]?.error_summary).toBeNull();
    expect(first).toMatchObject({
      counts: { recordsCreated: 4, recordsFailed: 0 },
      status: JobStatus.SUCCEEDED,
    });
    expect(second).toMatchObject({
      counts: { recordsUnchanged: 4 },
      status: JobStatus.SUCCEEDED,
    });
    expect(identities.rows[0]).toEqual({
      league_identities: 1,
      season_identities: 1,
      team_identities: 2,
      teams: 2,
    });
    expect(processed.rows[0]?.count).toBe(3);
  });

  it('commits valid roster siblings and reconciles partial-job issues', async () => {
    referenceProvider.rosters.set('VAN', {
      items: [providerPlayer('1001', 'Ada', 'Forward')],
      rejections: [
        { externalKey: 'bad-player', issues: ['player.position: invalid'] },
      ],
    });
    referenceProvider.rosters.set('TOR', {
      items: [providerPlayer('1002', 'Grace', 'Goalie')],
      rejections: [],
    });
    const season = await pool.query<{ id: string }>(
      'SELECT id FROM core.season LIMIT 1',
    );
    const result = await coordinator.run(
      {
        jobType: JobType.PLAYERS,
        parameters: { seasonId: season.rows[0]!.id },
        trigger: JobTrigger.MANUAL,
      },
      (executionId) =>
        playersImport.execute(executionId, {
          seasonId: season.rows[0]!.id,
        }),
    );
    const persisted = await pool.query<{
      error_issues: number;
      players: number;
      provider_identities: number;
      recorded_failures: number;
    }>(
      `
      SELECT
        (SELECT count(*)::int FROM core.player) AS players,
        (SELECT count(*)::int FROM core.player_provider_identity) AS provider_identities,
        (
          SELECT count(*)::int
          FROM ops.import_issue
          WHERE job_execution_id = $1 AND severity = 'ERROR'
        ) AS error_issues,
        (
          SELECT records_failed
          FROM ops.job_execution
          WHERE id = $1
        ) AS recorded_failures
    `,
      [result.executionId],
    );

    expect(result).toMatchObject({
      counts: {
        recordsCreated: 2,
        recordsFailed: 1,
        recordsFetched: 3,
      },
      status: JobStatus.PARTIAL,
    });
    expect(persisted.rows[0]).toEqual({
      error_issues: 1,
      players: 2,
      provider_identities: 2,
      recorded_failures: 1,
    });
  });

  it('deactivates a player only after three clean consecutive absences', async () => {
    referenceProvider.rosters.set('VAN', {
      items: [providerPlayer('1001', 'Ada', 'Forward')],
      rejections: [],
    });
    referenceProvider.rosters.set('TOR', {
      items: [providerPlayer('1002', 'Grace', 'Goalie')],
      rejections: [],
    });
    const season = await pool.query<{ id: string }>(
      'SELECT id FROM core.season LIMIT 1',
    );
    const request = {
      jobType: JobType.PLAYERS,
      parameters: { seasonId: season.rows[0]!.id },
      trigger: JobTrigger.MANUAL,
    } as const;
    await coordinator.run(request, (executionId) =>
      playersImport.execute(executionId, request.parameters),
    );

    referenceProvider.rosters.set('TOR', { items: [], rejections: [] });
    const firstAbsence = await coordinator.run(request, (executionId) =>
      playersImport.execute(executionId, request.parameters),
    );
    const secondAbsence = await coordinator.run(request, (executionId) =>
      playersImport.execute(executionId, request.parameters),
    );
    const thirdAbsence = await coordinator.run(request, (executionId) =>
      playersImport.execute(executionId, request.parameters),
    );
    const player = await pool.query<{
      active: boolean;
      current_team_id: string | null;
    }>(`
      SELECT player.active, player.current_team_id
      FROM core.player AS player
      JOIN core.player_provider_identity AS identity
        ON identity.player_id = player.id
      WHERE identity.provider = 'nhl' AND identity.external_id = '1002'
    `);
    const absenceIssues = await pool.query<{
      absence_count: number;
    }>(
      `
      SELECT (details->>'consecutiveSuccessfulSnapshots')::int AS absence_count
      FROM ops.import_issue
      WHERE job_execution_id IN ($1, $2)
        AND code = 'REFERENCE_ENTITY_ABSENT'
      ORDER BY absence_count
    `,
      [firstAbsence.executionId, secondAbsence.executionId],
    );

    expect(firstAbsence.status).toBe(JobStatus.SUCCEEDED);
    expect(secondAbsence.status).toBe(JobStatus.SUCCEEDED);
    expect(thirdAbsence).toMatchObject({
      counts: { recordsUpdated: 1 },
      status: JobStatus.SUCCEEDED,
    });
    expect(absenceIssues.rows).toEqual([
      { absence_count: 1 },
      { absence_count: 2 },
    ]);
    expect(player.rows[0]).toEqual({
      active: false,
      current_team_id: null,
    });
  });

  it('deduplicates schedule discovery and persists status progression', async () => {
    const base = providerGame('2025020700', 'SCHEDULED');
    referenceProvider.schedule = {
      items: [base, base],
      rejections: [],
    };
    const request = {
      jobType: JobType.SCHEDULE,
      parameters: { date: '2026-01-15' },
      trigger: JobTrigger.MANUAL,
    } as const;
    const first = await coordinator.run(request, (executionId) =>
      scheduleImport.execute(executionId, request.parameters),
    );
    const observedStatuses = [
      'LIVE',
      'POSTPONED',
      'CANCELLED',
      'FINAL',
    ] as const;
    const persistedStatuses = ['SCHEDULED'];
    for (const status of observedStatuses) {
      referenceProvider.schedule = {
        items: [providerGame('2025020700', status)],
        rejections: [],
      };
      await coordinator.run(request, (executionId) =>
        scheduleImport.execute(executionId, request.parameters),
      );
      const persistedStatus = await pool.query<{ status: string }>(
        'SELECT status::text FROM core.game LIMIT 1',
      );
      persistedStatuses.push(persistedStatus.rows[0]!.status);
    }
    referenceProvider.schedule = { items: [base], rejections: [] };
    await coordinator.run(request, (executionId) =>
      scheduleImport.execute(executionId, request.parameters),
    );
    const persisted = await pool.query<{
      games: number;
      provider_identities: number;
      status: string;
    }>(`
      SELECT
        (SELECT count(*)::int FROM core.game) AS games,
        (SELECT count(*)::int FROM core.game_provider_identity) AS provider_identities,
        (SELECT status::text FROM core.game LIMIT 1) AS status
    `);

    expect(first).toMatchObject({
      counts: { recordsCreated: 1, recordsUnchanged: 1 },
      status: JobStatus.SUCCEEDED,
    });
    expect(persistedStatuses).toEqual([
      'SCHEDULED',
      'LIVE',
      'POSTPONED',
      'CANCELLED',
      'FINAL',
    ]);
    expect(persisted.rows[0]).toEqual({
      games: 1,
      provider_identities: 1,
      status: 'FINAL',
    });
  });

  it('imports complete final statistics and applies corrected box scores', async () => {
    referenceProvider.boxscore = providerBoxscore(3);
    referenceProvider.teamSummary = providerTeamSummary();
    referenceProvider.profiles.set(
      '1003',
      providerPlayer('1003', 'Linus', 'Goalie'),
    );
    referenceProvider.profiles.set(
      '1004',
      providerPlayer('1004', 'Ken', 'Goalie'),
    );
    const game = await pool.query<{ id: string }>(
      'SELECT id FROM core.game LIMIT 1',
    );
    const request = {
      jobType: JobType.GAME_STATISTICS,
      parameters: { gameId: game.rows[0]!.id },
      trigger: JobTrigger.MANUAL,
    } as const;
    const first = await coordinator.run(request, (executionId) =>
      gameStatisticsImport.execute(executionId, request.parameters),
    );
    referenceProvider.boxscore = providerBoxscore(4);
    const correction = await coordinator.run(request, (executionId) =>
      gameStatisticsImport.execute(executionId, request.parameters),
    );
    const persisted = await pool.query<{
      away_goals: number;
      boxscore_payloads: number;
      home_goals: number;
      home_score: number;
      player_stats: number;
      right_rail_payloads: number;
      team_stats: number;
    }>(`
      SELECT
        (SELECT home_score FROM core.game LIMIT 1) AS home_score,
        (SELECT count(*)::int FROM core.player_game_stat) AS player_stats,
        (SELECT count(*)::int FROM core.team_game_stat) AS team_stats,
        (
          SELECT goals_for
          FROM core.team_game_stat
          WHERE team_id = (
            SELECT team_id FROM core.team_provider_identity
            WHERE provider = 'nhl' AND external_id = '23'
          )
        ) AS home_goals,
        (
          SELECT goals_for
          FROM core.team_game_stat
          WHERE team_id = (
            SELECT team_id FROM core.team_provider_identity
            WHERE provider = 'nhl' AND external_id = '10'
          )
        ) AS away_goals,
        (
          SELECT count(*)::int FROM raw.provider_payload
          WHERE resource_type = 'game-boxscore'
        ) AS boxscore_payloads,
        (
          SELECT count(*)::int FROM raw.provider_payload
          WHERE resource_type = 'game-team-stats'
        ) AS right_rail_payloads
    `);

    expect(first).toMatchObject({
      counts: { recordsCreated: 8, recordsFailed: 0 },
      status: JobStatus.SUCCEEDED,
    });
    expect(correction).toMatchObject({
      counts: { recordsFailed: 0, recordsUpdated: 4 },
      cursor: {
        affectedGameIds: [game.rows[0]!.id],
        checkedExternalIds: ['2025020700'],
      },
      status: JobStatus.SUCCEEDED,
    });
    expect(persisted.rows[0]).toEqual({
      away_goals: 2,
      boxscore_payloads: 2,
      home_goals: 4,
      home_score: 4,
      player_stats: 4,
      right_rail_payloads: 1,
      team_stats: 2,
    });
  });

  it('rejects only an unresolved box-score player and preserves valid siblings', async () => {
    referenceProvider.boxscore = {
      ...providerBoxscore(4),
      players: [
        ...providerBoxscore(4).players,
        providerPlayerStat('9999', '23', 0),
      ],
    };
    const game = await pool.query<{ id: string }>(
      'SELECT id FROM core.game LIMIT 1',
    );
    const result = await coordinator.run(
      {
        jobType: JobType.GAME_STATISTICS,
        parameters: { gameId: game.rows[0]!.id },
        trigger: JobTrigger.MANUAL,
      },
      (executionId) =>
        gameStatisticsImport.execute(executionId, {
          gameId: game.rows[0]!.id,
        }),
    );
    const persisted = await pool.query<{
      error_issues: number;
      player_stats: number;
    }>(
      `
      SELECT
        (SELECT count(*)::int FROM core.player_game_stat) AS player_stats,
        (
          SELECT count(*)::int
          FROM ops.import_issue
          WHERE job_execution_id = $1
            AND code = 'PLAYER_PROFILE_FETCH_FAILED'
        ) AS error_issues
    `,
      [result.executionId],
    );

    expect(result).toMatchObject({
      counts: { recordsFailed: 1, recordsUnchanged: 7 },
      status: JobStatus.PARTIAL,
    });
    expect(persisted.rows[0]).toEqual({
      error_issues: 1,
      player_stats: 4,
    });
  });

  it('imports dated official standings idempotently with queryable quality signals', async () => {
    referenceProvider.standings = {
      items: [
        providerStanding('VAN', 'Vancouver', 'Canucks'),
        providerStanding('TOR', 'Toronto', 'Maple Leafs'),
      ],
      rejections: [
        { externalKey: 'bad-standing', issues: ['standing.points: invalid'] },
      ],
    };
    const request = {
      jobType: JobType.STANDINGS,
      parameters: { date: '2026-01-15' },
      trigger: JobTrigger.MANUAL,
    } as const;
    const partial = await coordinator.run(request, (executionId) =>
      standingsImport.execute(executionId, request.parameters),
    );
    referenceProvider.standings = {
      items: referenceProvider.standings.items,
      rejections: [],
    };
    const repeat = await coordinator.run(request, (executionId) =>
      standingsImport.execute(executionId, request.parameters),
    );
    referenceProvider.standings = {
      items: referenceProvider.standings.items.map((standing) => ({
        ...standing,
        asOfDate: '2026-01-16',
        sourceCutoff: '2026-01-16T12:00:00.000Z',
      })),
      rejections: [],
    };
    await coordinator.run(
      { ...request, parameters: { date: '2026-01-16' } },
      (executionId) =>
        standingsImport.execute(executionId, { date: '2026-01-16' }),
    );
    const persisted = await pool.query<{
      error_issues: number;
      snapshot_dates: number;
      snapshots: number;
      successful_jobs: number;
    }>(
      `
      SELECT
        (SELECT count(*)::int FROM analytics.team_standing_snapshot) AS snapshots,
        (
          SELECT count(DISTINCT as_of_date)::int
          FROM analytics.team_standing_snapshot
        ) AS snapshot_dates,
        (
          SELECT count(*)::int
          FROM ops.import_issue
          WHERE job_execution_id = $1 AND severity = 'ERROR'
        ) AS error_issues,
        (
          SELECT count(*)::int
          FROM ops.job_execution
          WHERE job_type IN ('SCHEDULE', 'GAME_STATISTICS', 'STANDINGS')
            AND status = 'SUCCEEDED'
        ) AS successful_jobs
    `,
      [partial.executionId],
    );

    expect(partial).toMatchObject({
      counts: { recordsCreated: 2, recordsFailed: 1, recordsFetched: 3 },
      status: JobStatus.PARTIAL,
    });
    expect(repeat).toMatchObject({
      counts: { recordsUnchanged: 2 },
      status: JobStatus.SUCCEEDED,
    });
    expect(persisted.rows[0]).toMatchObject({
      error_issues: 1,
      snapshot_dates: 2,
      snapshots: 4,
    });
    expect(persisted.rows[0]!.successful_jobs).toBeGreaterThanOrEqual(3);
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
  validate: () => ProviderCollection<ProviderTeam>,
): ProviderFetch<ProviderCollection<ProviderTeam>> {
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

class ReferenceFixtureProvider {
  boxscore = providerBoxscore(3);
  readonly profiles = new Map<string, ProviderPlayer>();
  readonly rosters = new Map<string, ProviderCollection<ProviderPlayer>>();
  schedule: ProviderCollection<ProviderGame> = {
    items: [],
    rejections: [],
  };
  standings: ProviderCollection<ProviderStanding> = {
    items: [
      providerStanding('VAN', 'Vancouver', 'Canucks'),
      providerStanding('TOR', 'Toronto', 'Maple Leafs'),
    ],
    rejections: [],
  };
  teamSummary = providerTeamSummary();

  getTeams(): Promise<ProviderFetch<ProviderCollection<ProviderTeam>>> {
    return Promise.resolve(
      fixtureFetch('teams', 'nhl', {
        items: [
          {
            abbreviation: 'VAN',
            externalId: '23',
            fullName: 'Vancouver Canucks',
            leagueExternalId: '133',
          },
          {
            abbreviation: 'TOR',
            externalId: '10',
            fullName: 'Toronto Maple Leafs',
            leagueExternalId: '133',
          },
        ],
        rejections: [],
      }),
    );
  }

  getStandings(
    date: string,
  ): Promise<ProviderFetch<ProviderCollection<ProviderStanding>>> {
    return Promise.resolve(fixtureFetch('standings', date, this.standings));
  }

  getSeason(externalId: string): Promise<ProviderFetch<ProviderSeason>> {
    return Promise.resolve(
      fixtureFetch('season', externalId, {
        endDate: '2026-06-15',
        externalId,
        label: '2025-2026',
        startDate: '2025-10-07',
      }),
    );
  }

  getRoster(
    abbreviation: string,
    seasonExternalId: string,
  ): Promise<ProviderFetch<ProviderCollection<ProviderPlayer>>> {
    return Promise.resolve(
      fixtureFetch(
        'roster',
        `${abbreviation}:${seasonExternalId}`,
        this.rosters.get(abbreviation) ?? { items: [], rejections: [] },
      ),
    );
  }

  getSchedule(
    date: string,
  ): Promise<ProviderFetch<ProviderCollection<ProviderGame>>> {
    return Promise.resolve(fixtureFetch('schedule', date, this.schedule));
  }

  getTeamSeasonSchedule(
    abbreviation: string,
    seasonExternalId: string,
  ): Promise<ProviderFetch<ProviderCollection<ProviderGame>>> {
    return Promise.resolve(
      fixtureFetch(
        'team-season-schedule',
        `${abbreviation}:${seasonExternalId}`,
        this.schedule,
      ),
    );
  }

  getGameBoxscore(
    externalId: string,
  ): Promise<ProviderFetch<ProviderGameBoxscore>> {
    return Promise.resolve(
      fixtureFetch('game-boxscore', externalId, this.boxscore),
    );
  }

  getGameTeamStats(
    externalId: string,
  ): Promise<ProviderFetch<ProviderTeamGameSummary>> {
    return Promise.resolve(
      fixtureFetch('game-team-stats', externalId, this.teamSummary),
    );
  }

  getPlayer(externalId: string): Promise<ProviderFetch<ProviderPlayer>> {
    const player = this.profiles.get(externalId);
    if (!player) {
      return Promise.reject(new Error('Missing player fixture'));
    }
    return Promise.resolve(fixtureFetch('player', externalId, player));
  }
}

function fixtureFetch<T>(
  resourceType:
    | 'game-boxscore'
    | 'game-team-stats'
    | 'player'
    | 'roster'
    | 'schedule'
    | 'season'
    | 'standings'
    | 'team-season-schedule'
    | 'teams',
  externalKey: string,
  value: T,
): ProviderFetch<T> {
  return {
    body: new TextEncoder().encode(JSON.stringify(value)),
    contentType: 'application/json',
    descriptor: {
      externalKey,
      parameters: {},
      path: `/${resourceType}`,
      resourceType,
    },
    fetchedAt: new Date('2026-01-15T12:00:00Z'),
    httpStatus: 200,
    provider: 'nhl',
    validate: () => value,
  };
}

function providerStanding(
  abbreviation: string,
  city: string,
  name: string,
): ProviderStanding {
  return {
    asOfDate: '2026-01-15',
    city,
    conferenceRank: 1,
    divisionRank: 1,
    gamesPlayed: 40,
    goalsAgainst: 100,
    goalsFor: 120,
    leagueRank: 1,
    losses: 10,
    overtimeLosses: 5,
    pointPercentage: 0.625,
    points: 50,
    seasonExternalId: '20252026',
    sourceCutoff: '2026-01-15T12:00:00.000Z',
    teamAbbreviation: abbreviation,
    teamName: name,
    wins: 25,
  };
}

function providerPlayer(
  externalId: string,
  firstName: string,
  lastName: string,
): ProviderPlayer {
  return {
    active: true,
    birthDate: null,
    currentTeamExternalId: null,
    externalId,
    firstName,
    lastName,
    position: null,
    shootsCatches: null,
  };
}

function providerGame(
  externalId: string,
  status: ProviderGame['status'],
): ProviderGame {
  const final = status === 'FINAL';
  return {
    awayScore: final ? 2 : null,
    awayTeamExternalId: '10',
    decisionType: final ? 'OVERTIME' : null,
    externalId,
    gameType: 'REGULAR_SEASON',
    homeScore: final ? 3 : null,
    homeTeamExternalId: '23',
    seasonExternalId: '20252026',
    startsAt: '2026-01-15T03:00:00.000Z',
    status,
    venue: 'Fixture Arena',
  };
}

function providerBoxscore(homeScore: number): ProviderGameBoxscore {
  return {
    game: {
      ...providerGame('2025020700', 'FINAL'),
      homeScore,
    },
    players: [
      providerPlayerStat('1001', '23', homeScore),
      providerPlayerStat('1002', '10', 2),
      providerPlayerStat('1003', '23', 0),
      providerPlayerStat('1004', '10', 0),
    ],
  };
}

function providerPlayerStat(
  playerExternalId: string,
  teamExternalId: string,
  goals: number,
) {
  return {
    assists: 0,
    goals,
    penaltyMinutes: 0,
    playerExternalId,
    plusMinus: 0,
    powerPlayGoals: 0,
    shortHandedGoals: 0,
    shots: goals,
    teamExternalId,
    timeOnIceSeconds: 1_200,
  };
}

function providerTeamSummary(): ProviderTeamGameSummary {
  return {
    away: {
      penaltyMinutes: 8,
      powerPlayGoals: 0,
      powerPlayOpportunities: 2,
      shotsAgainst: 31,
      shotsFor: 29,
      teamExternalId: '10',
    },
    home: {
      penaltyMinutes: 6,
      powerPlayGoals: 1,
      powerPlayOpportunities: 3,
      shotsAgainst: 29,
      shotsFor: 31,
      teamExternalId: '23',
    },
  };
}
