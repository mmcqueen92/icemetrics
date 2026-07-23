import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Pool, type DatabaseError } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { allocatePort } from './support/allocate-port.js';
import {
  createPostgresTestDatabaseConfiguration,
  startPostgresTestContainer,
  type StartedPostgresTestDatabase,
} from './support/postgres-test-container.js';

const prismaCliPath = fileURLToPath(
  new URL('../../../node_modules/prisma/build/index.js', import.meta.url),
);
describe('database foundation', () => {
  let database: StartedPostgresTestDatabase;
  let pool: Pool;

  beforeAll(async () => {
    const hostPort = await allocatePort();
    const configuration = createPostgresTestDatabaseConfiguration(hostPort);
    database = await startPostgresTestContainer(configuration, hostPort);
    pool = new Pool({ connectionString: database.databaseUrl });

    await runNode([prismaCliPath, 'migrate', 'deploy'], database.databaseUrl);
    await runNode([prismaCliPath, 'db', 'seed'], database.databaseUrl);
    await runNode([prismaCliPath, 'db', 'seed'], database.databaseUrl);
  });

  afterAll(async () => {
    await pool?.end();
    await database?.container.stop();
  });

  it('migrates all application schemas and tables', async () => {
    const schemas = await pool.query<{ schema_name: string }>(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name IN ('raw', 'core', 'analytics', 'ops')
      ORDER BY schema_name
    `);
    const tables = await pool.query<{ table_count: number }>(`
      SELECT count(*)::int AS table_count
      FROM information_schema.tables
      WHERE table_schema IN ('raw', 'core', 'analytics', 'ops')
        AND table_type = 'BASE TABLE'
    `);
    const migrationTable = await pool.query<{ exists: boolean }>(`
      SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS exists
    `);
    const queryIndexes = await pool.query<{ indexname: string }>(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'core'
        AND indexname IN (
          'ix_game_season_id_starts_at',
          'ix_game_home_team_id_starts_at',
          'ix_game_away_team_id_starts_at',
          'ix_player_first_name_ci',
          'ix_player_last_name_ci',
          'ix_player_full_name_ci',
          'ix_team_league_id_active'
        )
      ORDER BY indexname
    `);

    expect(schemas.rows.map(({ schema_name }) => schema_name)).toEqual([
      'analytics',
      'core',
      'ops',
      'raw',
    ]);
    expect(tables.rows[0]?.table_count).toBe(19);
    expect(migrationTable.rows[0]?.exists).toBe(true);
    expect(queryIndexes.rows.map(({ indexname }) => indexname)).toEqual([
      'ix_game_away_team_id_starts_at',
      'ix_game_home_team_id_starts_at',
      'ix_game_season_id_starts_at',
      'ix_player_first_name_ci',
      'ix_player_full_name_ci',
      'ix_player_last_name_ci',
      'ix_team_league_id_active',
    ]);
  });

  it('seeds deterministic, repeatable development fixtures', async () => {
    const result = await pool.query<{
      games: number;
      players: number;
      scheduled_games: number;
      teams: number;
    }>(`
      SELECT
        (SELECT count(*)::int FROM core.team) AS teams,
        (SELECT count(*)::int FROM core.player) AS players,
        (SELECT count(*)::int FROM core.game) AS games,
        (
          SELECT count(*)::int
          FROM core.game
          WHERE status = 'SCHEDULED'
        ) AS scheduled_games
    `);
    const metric = await pool.query<{ value: string }>(`
      SELECT value::text
      FROM analytics.player_metric_snapshot
      WHERE id = '00000000-0000-4000-8000-000000000711'
    `);
    const inconsistentFinalStats = await pool.query<{ count: number }>(`
      SELECT count(*)::int AS count
      FROM core.team_game_stat AS team_stat
      JOIN core.game ON core.game.id = team_stat.game_id
      LEFT JOIN (
        SELECT game_id, team_id, sum(goals)::int AS goals
        FROM core.player_game_stat
        GROUP BY game_id, team_id
      ) AS player_totals
        ON player_totals.game_id = team_stat.game_id
        AND player_totals.team_id = team_stat.team_id
      WHERE core.game.status = 'FINAL'
        AND team_stat.goals_for <> coalesce(player_totals.goals, 0)
    `);

    expect(result.rows[0]).toEqual({
      games: 2,
      players: 8,
      scheduled_games: 1,
      teams: 4,
    });
    expect(metric.rows[0]?.value).toBe('4.000000');
    expect(inconsistentFinalStats.rows[0]?.count).toBe(0);
  });

  it('rejects duplicate provider identities and game statistics', async () => {
    await expectConstraint(
      pool.query(`
        INSERT INTO core.team_provider_identity (
          id, provider, external_id, team_id, created_at
        )
        VALUES (
          gen_random_uuid(), 'nhl', '23',
          '00000000-0000-4000-8000-000000000202', now()
        )
      `),
      '23505',
    );

    await expectConstraint(
      pool.query(`
        INSERT INTO core.team_game_stat (
          id, game_id, team_id, goals_for, goals_against, shots_for,
          shots_against, power_play_goals, power_play_opportunities,
          penalty_minutes, created_at, updated_at
        )
        VALUES (
          gen_random_uuid(),
          '00000000-0000-4000-8000-000000000401',
          '00000000-0000-4000-8000-000000000201',
          4, 3, 31, 29, 1, 3, 8, now(), now()
        )
      `),
      '23505',
    );
  });

  it('rejects negative statistics and same-team games', async () => {
    await expectConstraint(
      pool.query(`
        UPDATE core.player_game_stat
        SET goals = -1
        WHERE id = '00000000-0000-4000-8000-000000000601'
      `),
      '23514',
    );

    await expectConstraint(
      pool.query(`
        INSERT INTO core.game (
          id, season_id, home_team_id, away_team_id, starts_at, game_type,
          status, created_at, updated_at
        )
        VALUES (
          gen_random_uuid(),
          '00000000-0000-4000-8000-000000000101',
          '00000000-0000-4000-8000-000000000201',
          '00000000-0000-4000-8000-000000000201',
          TIMESTAMPTZ '2026-03-01 00:00:00+00',
          'REGULAR_SEASON', 'SCHEDULED', now(), now()
        )
      `),
      '23514',
    );
  });

  it('rejects statistics assigned to a team outside the game', async () => {
    await expectConstraint(
      pool.query(`
        INSERT INTO core.team_game_stat (
          id, game_id, team_id, goals_for, goals_against, shots_for,
          shots_against, power_play_goals, power_play_opportunities,
          penalty_minutes, created_at, updated_at
        )
        VALUES (
          gen_random_uuid(),
          '00000000-0000-4000-8000-000000000401',
          '00000000-0000-4000-8000-000000000203',
          0, 0, 0, 0, 0, 0, 0, now(), now()
        )
      `),
      '23514',
    );
  });

  it('rejects invalid raw payload representations', async () => {
    await expectConstraint(
      pool.query(`
        INSERT INTO raw.provider_payload (
          id, provider, resource_type, external_key, request_path,
          request_parameters, http_status, payload, body_text, checksum,
          status, fetched_at
        )
        VALUES (
          gen_random_uuid(), 'nhl', 'game', 'bad', '/game/bad/landing',
          '{}'::jsonb, 200, '{}'::jsonb, 'duplicate body',
          repeat('a', 64), 'FETCHED', now()
        )
      `),
      '23514',
    );
  });
});

async function expectConstraint(
  operation: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  try {
    await operation;
    throw new Error('Expected PostgreSQL to reject the operation.');
  } catch (error) {
    expect((error as DatabaseError).code).toBe(expectedCode);
  }
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
        reject(
          new Error(
            `Command "${arguments_.join(' ')}" exited with ${String(code)}:\n${stderr}`,
          ),
        );
      }
    });
  });
}
