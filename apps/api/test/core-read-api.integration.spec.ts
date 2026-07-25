/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Supertest exposes parsed JSON response bodies as `any`; assertions validate the runtime contract. */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { configureApplication } from '../src/common/configure-application.js';
import { AnalyticsRefreshService } from '../src/analytics/services/analytics-refresh.service.js';
import { allocatePort } from './support/allocate-port.js';
import {
  createPostgresTestDatabaseConfiguration,
  startPostgresTestContainer,
  type StartedPostgresTestDatabase,
} from './support/postgres-test-container.js';

const prismaCliPath = fileURLToPath(
  new URL('../../../node_modules/prisma/build/index.js', import.meta.url),
);
const LEAGUE_ID = '00000000-0000-4000-8000-000000000001';
const SEASON_ID = '00000000-0000-4000-8000-000000000101';
const CANUCKS_ID = '00000000-0000-4000-8000-000000000201';
const OILERS_ID = '00000000-0000-4000-8000-000000000202';
const MERCER_ID = '00000000-0000-4000-8000-000000000301';
const GOALTENDER_ID = '00000000-0000-4000-8000-000000000302';
const FINAL_GAME_ID = '00000000-0000-4000-8000-000000000401';
const SCHEDULED_GAME_ID = '00000000-0000-4000-8000-000000000402';
const MISSING_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

describe('core read API', () => {
  let app: NestExpressApplication;
  let database: StartedPostgresTestDatabase;
  let pool: Pool;
  let analyticsRefresh: AnalyticsRefreshService;

  beforeAll(async () => {
    const hostPort = await allocatePort();
    const configuration = createPostgresTestDatabaseConfiguration(hostPort);
    database = await startPostgresTestContainer(configuration, hostPort);
    pool = new Pool({ connectionString: database.databaseUrl });

    await runNode([prismaCliPath, 'migrate', 'deploy'], database.databaseUrl);
    await runNode([prismaCliPath, 'db', 'seed'], database.databaseUrl);

    process.env['APP_ENV'] = 'test';
    process.env['APP_VERSION'] = 'core-read-integration';
    process.env['CORS_ALLOWED_ORIGINS'] = 'http://localhost:4200';
    process.env['DATABASE_URL'] = database.databaseUrl;
    process.env['LOG_LEVEL'] = 'error';
    process.env['NODE_ENV'] = 'test';
    process.env['RATE_LIMIT_PER_MINUTE'] = '1000';

    const { AppModule } = await import('../src/app.module.js');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    analyticsRefresh = module.get(AnalyticsRefreshService);
    app = module.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();
    await analyticsRefresh.execute(
      '00000000-0000-4000-8000-000000000999',
      { seasonId: SEASON_ID },
      new Date('2025-10-11T06:00:00Z'),
    );
  });

  afterAll(async () => {
    await app?.close();
    await pool?.end();
    await database?.container.stop();
  });

  it('lists leagues and seasons with filters, stable pagination, and date serialization', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/leagues?page=1&pageSize=1&sort=code&order=desc')
      .expect(200)
      .expect({
        data: [
          {
            code: 'NHL',
            id: LEAGUE_ID,
            name: 'National Hockey League',
          },
        ],
        meta: {
          order: 'desc',
          page: 1,
          pageSize: 1,
          sort: 'code',
          totalItems: 1,
          totalPages: 1,
        },
      });

    await request(app.getHttpServer())
      .get(
        `/api/v1/seasons?leagueId=${LEAGUE_ID}&activeOn=2026-01-01&sort=label&order=asc`,
      )
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          data: [
            {
              endDate: '2026-06-30',
              id: SEASON_ID,
              label: '2025-2026',
              leagueId: LEAGUE_ID,
              startDate: '2025-10-07',
            },
          ],
        });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/seasons/${SEASON_ID}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.id).toBe(SEASON_ID);
      });
  });

  it('returns season not-found and structured UUID/date validation errors', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/seasons/${MISSING_ID}`)
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
        expect(response.body.error.message).toBe('Season does not exist.');
      });

    await request(app.getHttpServer())
      .get('/api/v1/seasons/not-a-uuid')
      .expect(400)
      .expect((response) => {
        expect(response.body.error.details).toContainEqual(
          expect.objectContaining({ code: 'INVALID_UUID', field: 'id' }),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/seasons?activeOn=2026-02-30')
      .expect(400)
      .expect((response) => {
        expect(response.body.error.details).toContainEqual(
          expect.objectContaining({ code: 'INVALID_DATE', field: 'activeOn' }),
        );
      });
  });

  it('lists, filters, sorts, and retrieves teams and rosters', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/teams?leagueId=${LEAGUE_ID}&active=true&page=1&pageSize=2&sort=city&order=desc`,
      )
      .expect(200)
      .expect((response) => {
        expect(response.body.meta).toMatchObject({
          pageSize: 2,
          sort: 'city',
          totalItems: 4,
          totalPages: 2,
        });
        expect(
          response.body.data.map((team: { city: string }) => team.city),
        ).toEqual(['Vancouver', 'Toronto']);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/teams/${CANUCKS_ID}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          abbreviation: 'VAN',
          league: { code: 'NHL', id: LEAGUE_ID },
        });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/teams/${CANUCKS_ID}/roster?sort=position&order=asc`)
      .expect(200)
      .expect((response) => {
        expect(response.body.meta.totalItems).toBe(2);
        expect(
          response.body.data.map(
            (player: { position: string }) => player.position,
          ),
        ).toEqual(['C', 'G']);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/teams/${MISSING_ID}/roster`)
      .expect(404);
  });

  it('searches and filters players without leaking persistence types', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/players?search=%20ALEX%20mer%20&teamId=${CANUCKS_ID}&position=C&active=true`,
      )
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toEqual([
          {
            active: true,
            currentTeam: {
              abbreviation: 'VAN',
              active: true,
              city: 'Vancouver',
              id: CANUCKS_ID,
              name: 'Canucks',
            },
            firstName: 'Alex',
            id: MERCER_ID,
            lastName: 'Mercer',
            position: 'C',
          },
        ]);
        expect(response.body.meta.totalItems).toBe(1);
      });

    await request(app.getHttpServer())
      .get('/api/v1/players?active=false')
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toEqual([]);
        expect(response.body.meta.totalPages).toBe(0);
      });

    await request(app.getHttpServer())
      .get('/api/v1/players?search=a')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/players?unknown=value')
      .expect(400);
  });

  it('returns player profiles and historical game statistics with derived values', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/players/${MERCER_ID}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          birthDate: '1998-03-11',
          id: MERCER_ID,
          shootsCatches: 'L',
        });
      });

    await request(app.getHttpServer())
      .get(
        `/api/v1/players/${MERCER_ID}/stats?seasonId=${SEASON_ID}&dateFrom=2025-10-01&dateTo=2025-10-31`,
      )
      .expect(200)
      .expect((response) => {
        expect(response.body.meta).toMatchObject({
          pageSize: 50,
          sort: 'gameDate',
          totalItems: 1,
        });
        expect(response.body.data[0]).toMatchObject({
          game: { id: FINAL_GAME_ID },
          goals: 4,
          isHome: true,
          opponent: { id: OILERS_ID },
          points: 4,
          shootingPercentage: 50,
          team: { id: CANUCKS_ID },
        });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/players/${GOALTENDER_ID}/stats?seasonId=${SEASON_ID}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data[0].shootingPercentage).toBeNull();
      });
  });

  it('validates player-stat requirements, ranges, and missing players', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/players/${MERCER_ID}/stats`)
      .expect(400);

    await request(app.getHttpServer())
      .get(
        `/api/v1/players/${MERCER_ID}/stats?seasonId=${SEASON_ID}&dateFrom=2026-01-02&dateTo=2026-01-01`,
      )
      .expect(400)
      .expect((response) => {
        expect(response.body.error.details).toContainEqual(
          expect.objectContaining({ code: 'INVALID_RANGE', field: 'dateTo' }),
        );
      });

    await request(app.getHttpServer())
      .get(`/api/v1/players/${MISSING_ID}/stats?seasonId=${SEASON_ID}`)
      .expect(404);
  });

  it('lists games with required bounds, filters, sorting, and empty results', async () => {
    await request(app.getHttpServer()).get('/api/v1/games').expect(400);

    await request(app.getHttpServer())
      .get(
        `/api/v1/games?seasonId=${SEASON_ID}&teamId=${CANUCKS_ID}&status=FINAL&gameType=REGULAR_SEASON`,
      )
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toMatchObject({
          away: { score: 3, team: { id: OILERS_ID } },
          home: { score: 4, team: { id: CANUCKS_ID } },
          id: FINAL_GAME_ID,
          startsAt: '2025-10-11T02:00:00.000Z',
        });
      });

    await request(app.getHttpServer())
      .get('/api/v1/games?dateFrom=2025-01-01&dateTo=2026-01-02&pageSize=1')
      .expect(400)
      .expect((response) => {
        expect(response.body.error.details).toContainEqual(
          expect.objectContaining({ code: 'MAX_DATE_RANGE', field: 'dateTo' }),
        );
      });

    await request(app.getHttpServer())
      .get(`/api/v1/games?seasonId=${MISSING_ID}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toEqual([]);
      });
  });

  it('returns game details with status-aware caching and team statistics', async () => {
    const finalGame = await request(app.getHttpServer())
      .get(`/api/v1/games/${FINAL_GAME_ID}`)
      .expect(200);
    expect(finalGame.headers['cache-control']).toBe('public, max-age=3600');
    expect(finalGame.body.data).toMatchObject({
      id: FINAL_GAME_ID,
      status: 'FINAL',
      teamStats: [
        {
          powerPlayPercentage: 33.3333,
          team: { id: CANUCKS_ID },
        },
        {
          powerPlayPercentage: 0,
          team: { id: OILERS_ID },
        },
      ],
    });

    const scheduledGame = await request(app.getHttpServer())
      .get(`/api/v1/games/${SCHEDULED_GAME_ID}`)
      .expect(200);
    expect(scheduledGame.headers['cache-control']).toBe('public, max-age=60');
    expect(scheduledGame.body.data.teamStats).toEqual([]);

    await request(app.getHttpServer())
      .get(`/api/v1/games/${MISSING_ID}`)
      .expect(404);
  });

  it('sorts and filters player box scores using the bounded SQL query', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/games/${FINAL_GAME_ID}/player-stats?page=1&pageSize=2&sort=points&order=desc`,
      )
      .expect(200)
      .expect((response) => {
        expect(response.body.meta).toMatchObject({
          pageSize: 2,
          totalItems: 4,
          totalPages: 2,
        });
        expect(
          response.body.data.map((stat: { points: number }) => stat.points),
        ).toEqual([4, 3]);
      });

    await request(app.getHttpServer())
      .get(
        `/api/v1/games/${FINAL_GAME_ID}/player-stats?teamId=${CANUCKS_ID}&sort=lastName&order=asc`,
      )
      .expect(200)
      .expect((response) => {
        expect(response.body.meta.totalItems).toBe(2);
        expect(
          response.body.data.map(
            (stat: { player: { lastName: string } }) => stat.player.lastName,
          ),
        ).toEqual(['Mercer', 'Price']);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/games/${MISSING_ID}/player-stats`)
      .expect(404);
  });

  it('returns the latest or requested standings snapshot with numeric values', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/standings?seasonId=${SEASON_ID}&sort=points&order=desc&pageSize=2`,
      )
      .expect(200)
      .expect((response) => {
        expect(response.body.meta).toMatchObject({
          totalItems: 4,
          totalPages: 2,
        });
        expect(response.body.data[0]).toMatchObject({
          asOfDate: '2025-10-11',
          pointPercentage: 1,
          points: 2,
          sourceCutoff: '2025-10-11T05:00:00.000Z',
          team: { id: CANUCKS_ID },
        });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/standings?seasonId=${SEASON_ID}&asOfDate=2025-10-10`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toEqual([]);
      });

    await request(app.getHttpServer()).get('/api/v1/standings').expect(400);
  });

  it('returns materialized player and team trends with partial windows', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/analytics/players/${MERCER_ID}/trends?seasonId=${SEASON_ID}&window=10`,
      )
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toEqual([
          expect.objectContaining({
            asOfGameId: FINAL_GAME_ID,
            formulaVersion: '1',
            metrics: {
              assistsPerGame: 0,
              consistencyScore: null,
              goalsPerGame: 4,
              pointsPerGame: 4,
              shootingPercentage: 50,
            },
            sampleSize: 1,
            window: 10,
          }),
        ]);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/analytics/teams/${CANUCKS_ID}/trends?seasonId=${SEASON_ID}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data[0]).toMatchObject({
          pointPercentage: 1,
          recentPerformanceTrend: 0,
          sampleSize: 1,
          scoringDifferentialPerGame: 1,
        });
      });
  });

  it('compares season and rolling player metrics and validates distinct players', async () => {
    await request(app.getHttpServer())
      .get(
        `/api/v1/analytics/player-comparisons?seasonId=${SEASON_ID}&playerIds=${MERCER_ID},${GOALTENDER_ID}`,
      )
      .expect(200)
      .expect((response) => {
        expect(response.body.data.players).toHaveLength(2);
        expect(response.body.data.players[0]).toMatchObject({
          metrics: {
            assistsPerGame: 0,
            consistencyScore: null,
            goalsPerGame: 4,
            pointsPerGame: 4,
            shootingPercentage: 50,
          },
          sampleSize: 1,
        });
      });

    await request(app.getHttpServer())
      .get(
        `/api/v1/analytics/player-comparisons?seasonId=${SEASON_ID}&playerIds=${MERCER_ID},${MERCER_ID}`,
      )
      .expect(400);
  });

  it('returns ranked teams with documented components and ordering', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/analytics/teams/rankings?seasonId=${SEASON_ID}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0]).toMatchObject({
          formulaVersion: '1',
          last10PointPercentage: 1,
          rank: 1,
          scoringDifferentialPerGame: 1,
          seasonPointPercentage: 1,
          team: { id: CANUCKS_ID },
        });
        expect(response.body.data[1]).toMatchObject({
          rank: 2,
          team: { id: OILERS_ID },
        });
      });
  });

  it('recalculates corrected downstream snapshots and preserves unchanged timestamps', async () => {
    const unchanged = await analyticsRefresh.execute(
      '00000000-0000-4000-8000-000000000998',
      { affectedGameIds: [FINAL_GAME_ID] },
      new Date('2025-10-11T07:00:00Z'),
    );
    expect(unchanged.counts.recordsUpdated).toBe(0);
    expect(unchanged.counts.recordsUnchanged).toBeGreaterThan(0);

    await pool.query(
      `
        UPDATE core.player_game_stat
        SET goals = 2
        WHERE game_id = $1::uuid AND player_id = $2::uuid
      `,
      [FINAL_GAME_ID, MERCER_ID],
    );
    const corrected = await analyticsRefresh.execute(
      '00000000-0000-4000-8000-000000000997',
      { affectedGameIds: [FINAL_GAME_ID] },
      new Date('2025-10-11T08:00:00Z'),
    );
    expect(corrected.counts.recordsUpdated).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .get(
        `/api/v1/analytics/players/${MERCER_ID}/trends?seasonId=${SEASON_ID}&window=5`,
      )
      .expect(200)
      .expect((response) => {
        expect(response.body.data[0].metrics).toMatchObject({
          goalsPerGame: 2,
          pointsPerGame: 2,
          shootingPercentage: 25,
        });
      });
  });

  it('excludes preseason statistics from regular-season analytics', async () => {
    const preseasonGameId = '00000000-0000-4000-8000-000000000499';
    await pool.query(
      `
        INSERT INTO core.game (
          id, season_id, home_team_id, away_team_id, starts_at, game_type,
          status, home_score, away_score, decision_type, created_at, updated_at
        )
        VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4::uuid,
          TIMESTAMPTZ '2025-10-12 02:00:00+00', 'PRESEASON', 'FINAL',
          1, 0, 'REGULATION', now(), now()
        )
      `,
      [preseasonGameId, SEASON_ID, CANUCKS_ID, OILERS_ID],
    );
    await pool.query(
      `
        INSERT INTO core.player_game_stat (
          id, game_id, player_id, team_id, goals, assists, shots,
          penalty_minutes, plus_minus, power_play_goals, short_handed_goals,
          time_on_ice_seconds, created_at, updated_at
        )
        VALUES (
          '00000000-0000-4000-8000-000000000699', $1::uuid, $2::uuid,
          $3::uuid, 1, 1, 1, 0, 1, 0, 0, 1200, now(), now()
        )
      `,
      [preseasonGameId, MERCER_ID, CANUCKS_ID],
    );
    await analyticsRefresh.execute(
      '00000000-0000-4000-8000-000000000996',
      { affectedGameIds: [preseasonGameId] },
      new Date('2025-10-12T03:00:00Z'),
    );

    await request(app.getHttpServer())
      .get(
        `/api/v1/analytics/players/${MERCER_ID}/trends?seasonId=${SEASON_ID}&window=5`,
      )
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toMatchObject({
          asOfGameId: FINAL_GAME_ID,
          sampleSize: 1,
        });
      });
  });

  it('installs read-path indexes and keeps representative plans within budget', async () => {
    const indexes = await pool.query<{ indexname: string }>(`
      SELECT indexname
      FROM pg_indexes
      WHERE indexname IN (
        'ix_player_full_name_ci',
        'ix_player_team_active_last_name_id',
        'ix_game_season_id_starts_at',
        'ix_player_game_stat_game_points_player_id',
        'ix_standing_season_date_rank_id'
      )
      ORDER BY indexname
    `);
    expect(indexes.rows.map(({ indexname }) => indexname)).toEqual([
      'ix_game_season_id_starts_at',
      'ix_player_full_name_ci',
      'ix_player_game_stat_game_points_player_id',
      'ix_player_team_active_last_name_id',
      'ix_standing_season_date_rank_id',
    ]);

    const statements = [
      `
        SELECT id
        FROM core.game
        WHERE season_id = '${SEASON_ID}'::uuid
        ORDER BY starts_at DESC, id
        LIMIT 25
      `,
      `
        SELECT id
        FROM core.player
        WHERE current_team_id = '${CANUCKS_ID}'::uuid
          AND active = true
        ORDER BY last_name, id
        LIMIT 25
      `,
      `
        SELECT id
        FROM analytics.team_standing_snapshot
        WHERE season_id = '${SEASON_ID}'::uuid
          AND as_of_date = DATE '2025-10-11'
        ORDER BY league_rank, id
        LIMIT 25
      `,
    ];

    for (const statement of statements) {
      const plan = await pool.query<{ 'QUERY PLAN': ExplainDocument[] }>(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${statement}`,
      );
      const executionTime = plan.rows[0]?.['QUERY PLAN'][0]?.['Execution Time'];
      expect(executionTime).toBeTypeOf('number');
      expect(executionTime).toBeLessThan(500);
    }
  });
});

interface ExplainDocument {
  'Execution Time': number;
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
