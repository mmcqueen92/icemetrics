import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { config as loadEnvironment } from 'dotenv';
import pg from 'pg';

const { Client } = pg;
const LOCAL_DATABASE_URL =
  'postgresql://icemetrics:icemetrics@localhost:5433/icemetrics';

loadEnvironment({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});

if (
  process.env.NODE_ENV === 'production' ||
  process.env.APP_ENV === 'production'
) {
  throw new Error('Development seed data must never be applied in production.');
}

const client = new Client({
  connectionString: process.env.DATABASE_URL ?? LOCAL_DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});

async function seed() {
  await client.connect();
  await client.query('BEGIN');

  try {
    await client.query(`
      INSERT INTO core.league (id, code, name, created_at, updated_at)
      VALUES (
        '00000000-0000-4000-8000-000000000001',
        'NHL',
        'National Hockey League',
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE
      SET code = EXCLUDED.code, name = EXCLUDED.name, updated_at = now();

      INSERT INTO core.season (
        id, league_id, label, start_date, end_date, created_at, updated_at
      )
      VALUES (
        '00000000-0000-4000-8000-000000000101',
        '00000000-0000-4000-8000-000000000001',
        '2025-2026',
        DATE '2025-10-07',
        DATE '2026-06-30',
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE
      SET
        league_id = EXCLUDED.league_id,
        label = EXCLUDED.label,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        updated_at = now();

      INSERT INTO core.team (
        id, league_id, name, abbreviation, city, active, created_at, updated_at
      )
      VALUES
        (
          '00000000-0000-4000-8000-000000000201',
          '00000000-0000-4000-8000-000000000001',
          'Canucks', 'VAN', 'Vancouver', true, now(), now()
        ),
        (
          '00000000-0000-4000-8000-000000000202',
          '00000000-0000-4000-8000-000000000001',
          'Oilers', 'EDM', 'Edmonton', true, now(), now()
        ),
        (
          '00000000-0000-4000-8000-000000000203',
          '00000000-0000-4000-8000-000000000001',
          'Maple Leafs', 'TOR', 'Toronto', true, now(), now()
        ),
        (
          '00000000-0000-4000-8000-000000000204',
          '00000000-0000-4000-8000-000000000001',
          'Canadiens', 'MTL', 'Montreal', true, now(), now()
        )
      ON CONFLICT (id) DO UPDATE
      SET
        league_id = EXCLUDED.league_id,
        name = EXCLUDED.name,
        abbreviation = EXCLUDED.abbreviation,
        city = EXCLUDED.city,
        active = EXCLUDED.active,
        updated_at = now();

      INSERT INTO core.player (
        id, current_team_id, first_name, last_name, position, shoots_catches,
        birth_date, active, created_at, updated_at
      )
      VALUES
        (
          '00000000-0000-4000-8000-000000000301',
          '00000000-0000-4000-8000-000000000201',
          'Alex', 'Mercer', 'C', 'L', DATE '1998-03-11', true, now(), now()
        ),
        (
          '00000000-0000-4000-8000-000000000302',
          '00000000-0000-4000-8000-000000000201',
          'Jonah', 'Price', 'G', 'L', DATE '1997-08-20', true, now(), now()
        ),
        (
          '00000000-0000-4000-8000-000000000303',
          '00000000-0000-4000-8000-000000000202',
          'Evan', 'Hart', 'C', 'R', DATE '1999-01-05', true, now(), now()
        ),
        (
          '00000000-0000-4000-8000-000000000304',
          '00000000-0000-4000-8000-000000000202',
          'Mikael', 'Stone', 'G', 'L', DATE '1996-12-14', true, now(), now()
        ),
        (
          '00000000-0000-4000-8000-000000000305',
          '00000000-0000-4000-8000-000000000203',
          'Noah', 'Clarke', 'D', 'R', DATE '2000-04-09', true, now(), now()
        ),
        (
          '00000000-0000-4000-8000-000000000306',
          '00000000-0000-4000-8000-000000000203',
          'Liam', 'Roy', 'G', 'L', DATE '1998-06-01', true, now(), now()
        ),
        (
          '00000000-0000-4000-8000-000000000307',
          '00000000-0000-4000-8000-000000000204',
          'Owen', 'Bouchard', 'L', 'L', DATE '2001-02-18', true, now(), now()
        ),
        (
          '00000000-0000-4000-8000-000000000308',
          '00000000-0000-4000-8000-000000000204',
          'Felix', 'Martin', 'G', 'R', DATE '1997-09-27', true, now(), now()
        )
      ON CONFLICT (id) DO UPDATE
      SET
        current_team_id = EXCLUDED.current_team_id,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        position = EXCLUDED.position,
        shoots_catches = EXCLUDED.shoots_catches,
        birth_date = EXCLUDED.birth_date,
        active = EXCLUDED.active,
        updated_at = now();

      INSERT INTO core.game (
        id, season_id, home_team_id, away_team_id, starts_at, game_type,
        status, venue, home_score, away_score, decision_type, created_at, updated_at
      )
      VALUES
        (
          '00000000-0000-4000-8000-000000000401',
          '00000000-0000-4000-8000-000000000101',
          '00000000-0000-4000-8000-000000000201',
          '00000000-0000-4000-8000-000000000202',
          TIMESTAMPTZ '2025-10-11 02:00:00+00',
          'REGULAR_SEASON', 'FINAL', 'Pacific Coliseum',
          4, 3, 'OVERTIME', now(), now()
        ),
        (
          '00000000-0000-4000-8000-000000000402',
          '00000000-0000-4000-8000-000000000101',
          '00000000-0000-4000-8000-000000000203',
          '00000000-0000-4000-8000-000000000204',
          TIMESTAMPTZ '2026-02-15 00:00:00+00',
          'REGULAR_SEASON', 'SCHEDULED', 'Exhibition Arena',
          NULL, NULL, NULL, now(), now()
        )
      ON CONFLICT (id) DO UPDATE
      SET
        season_id = EXCLUDED.season_id,
        home_team_id = EXCLUDED.home_team_id,
        away_team_id = EXCLUDED.away_team_id,
        starts_at = EXCLUDED.starts_at,
        game_type = EXCLUDED.game_type,
        status = EXCLUDED.status,
        venue = EXCLUDED.venue,
        home_score = EXCLUDED.home_score,
        away_score = EXCLUDED.away_score,
        decision_type = EXCLUDED.decision_type,
        updated_at = now();

      INSERT INTO core.player_game_stat (
        id, game_id, player_id, team_id, goals, assists, shots,
        penalty_minutes, plus_minus, power_play_goals, short_handed_goals,
        time_on_ice_seconds, created_at, updated_at
      )
      VALUES
        (
          '00000000-0000-4000-8000-000000000601',
          '00000000-0000-4000-8000-000000000401',
          '00000000-0000-4000-8000-000000000301',
          '00000000-0000-4000-8000-000000000201',
          4, 0, 8, 0, 2, 1, 0, 1234, now(), now()
        ),
        (
          '00000000-0000-4000-8000-000000000602',
          '00000000-0000-4000-8000-000000000401',
          '00000000-0000-4000-8000-000000000302',
          '00000000-0000-4000-8000-000000000201',
          0, 0, 0, 0, 0, 0, 0, 3600, now(), now()
        ),
        (
          '00000000-0000-4000-8000-000000000603',
          '00000000-0000-4000-8000-000000000401',
          '00000000-0000-4000-8000-000000000303',
          '00000000-0000-4000-8000-000000000202',
          3, 0, 7, 2, -1, 0, 0, 1301, now(), now()
        ),
        (
          '00000000-0000-4000-8000-000000000604',
          '00000000-0000-4000-8000-000000000401',
          '00000000-0000-4000-8000-000000000304',
          '00000000-0000-4000-8000-000000000202',
          0, 0, 0, 0, 0, 0, 0, 3587, now(), now()
        )
      ON CONFLICT (id) DO UPDATE
      SET
        game_id = EXCLUDED.game_id,
        player_id = EXCLUDED.player_id,
        team_id = EXCLUDED.team_id,
        goals = EXCLUDED.goals,
        assists = EXCLUDED.assists,
        shots = EXCLUDED.shots,
        penalty_minutes = EXCLUDED.penalty_minutes,
        plus_minus = EXCLUDED.plus_minus,
        power_play_goals = EXCLUDED.power_play_goals,
        short_handed_goals = EXCLUDED.short_handed_goals,
        time_on_ice_seconds = EXCLUDED.time_on_ice_seconds,
        updated_at = now();

      INSERT INTO core.team_game_stat (
        id, game_id, team_id, goals_for, goals_against, shots_for, shots_against,
        power_play_goals, power_play_opportunities, penalty_minutes, created_at, updated_at
      )
      VALUES
        (
          '00000000-0000-4000-8000-000000000611',
          '00000000-0000-4000-8000-000000000401',
          '00000000-0000-4000-8000-000000000201',
          4, 3, 31, 29, 1, 3, 8, now(), now()
        ),
        (
          '00000000-0000-4000-8000-000000000612',
          '00000000-0000-4000-8000-000000000401',
          '00000000-0000-4000-8000-000000000202',
          3, 4, 29, 31, 0, 2, 10, now(), now()
        )
      ON CONFLICT (id) DO UPDATE
      SET
        game_id = EXCLUDED.game_id,
        team_id = EXCLUDED.team_id,
        goals_for = EXCLUDED.goals_for,
        goals_against = EXCLUDED.goals_against,
        shots_for = EXCLUDED.shots_for,
        shots_against = EXCLUDED.shots_against,
        power_play_goals = EXCLUDED.power_play_goals,
        power_play_opportunities = EXCLUDED.power_play_opportunities,
        penalty_minutes = EXCLUDED.penalty_minutes,
        updated_at = now();
    `);

    await client.query(`
      INSERT INTO core.league_provider_identity (
        id, provider, external_id, league_id, created_at
      )
      VALUES (
        '00000000-0000-4000-8000-000000000501',
        'nhl', 'NHL', '00000000-0000-4000-8000-000000000001', now()
      )
      ON CONFLICT (provider, external_id) DO UPDATE
      SET league_id = EXCLUDED.league_id;

      INSERT INTO core.season_provider_identity (
        id, provider, external_id, season_id, created_at
      )
      VALUES (
        '00000000-0000-4000-8000-000000000502',
        'nhl', '20252026', '00000000-0000-4000-8000-000000000101', now()
      )
      ON CONFLICT (provider, external_id) DO UPDATE
      SET season_id = EXCLUDED.season_id;

      INSERT INTO core.team_provider_identity (
        id, provider, external_id, team_id, created_at
      )
      VALUES
        (
          '00000000-0000-4000-8000-000000000511',
          'nhl', '23', '00000000-0000-4000-8000-000000000201', now()
        ),
        (
          '00000000-0000-4000-8000-000000000512',
          'nhl', '22', '00000000-0000-4000-8000-000000000202', now()
        ),
        (
          '00000000-0000-4000-8000-000000000513',
          'nhl', '10', '00000000-0000-4000-8000-000000000203', now()
        ),
        (
          '00000000-0000-4000-8000-000000000514',
          'nhl', '8', '00000000-0000-4000-8000-000000000204', now()
        )
      ON CONFLICT (provider, external_id) DO UPDATE
      SET team_id = EXCLUDED.team_id;

      INSERT INTO core.player_provider_identity (
        id, provider, external_id, player_id, created_at
      )
      VALUES
        (
          '00000000-0000-4000-8000-000000000521',
          'nhl', '900001', '00000000-0000-4000-8000-000000000301', now()
        ),
        (
          '00000000-0000-4000-8000-000000000522',
          'nhl', '900002', '00000000-0000-4000-8000-000000000302', now()
        ),
        (
          '00000000-0000-4000-8000-000000000523',
          'nhl', '900003', '00000000-0000-4000-8000-000000000303', now()
        ),
        (
          '00000000-0000-4000-8000-000000000524',
          'nhl', '900004', '00000000-0000-4000-8000-000000000304', now()
        ),
        (
          '00000000-0000-4000-8000-000000000525',
          'nhl', '900005', '00000000-0000-4000-8000-000000000305', now()
        ),
        (
          '00000000-0000-4000-8000-000000000526',
          'nhl', '900006', '00000000-0000-4000-8000-000000000306', now()
        ),
        (
          '00000000-0000-4000-8000-000000000527',
          'nhl', '900007', '00000000-0000-4000-8000-000000000307', now()
        ),
        (
          '00000000-0000-4000-8000-000000000528',
          'nhl', '900008', '00000000-0000-4000-8000-000000000308', now()
        )
      ON CONFLICT (provider, external_id) DO UPDATE
      SET player_id = EXCLUDED.player_id;

      INSERT INTO core.game_provider_identity (
        id, provider, external_id, game_id, created_at
      )
      VALUES
        (
          '00000000-0000-4000-8000-000000000531',
          'nhl', '2025020010', '00000000-0000-4000-8000-000000000401', now()
        ),
        (
          '00000000-0000-4000-8000-000000000532',
          'nhl', '2025020888', '00000000-0000-4000-8000-000000000402', now()
        )
      ON CONFLICT (provider, external_id) DO UPDATE
      SET game_id = EXCLUDED.game_id;
    `);

    await client.query(`
      INSERT INTO analytics.team_standing_snapshot (
        id, season_id, team_id, as_of_date, games_played, wins, losses,
        overtime_losses, points, goals_for, goals_against, league_rank,
        conference_rank, division_rank, point_percentage, source_cutoff,
        computed_at, formula_version
      )
      VALUES
        (
          '00000000-0000-4000-8000-000000000701',
          '00000000-0000-4000-8000-000000000101',
          '00000000-0000-4000-8000-000000000201',
          DATE '2025-10-11', 1, 1, 0, 0, 2, 4, 3, 1, 1, 1,
          1.000000, TIMESTAMPTZ '2025-10-11 05:00:00+00',
          TIMESTAMPTZ '2025-10-11 05:05:00+00', 'standings.v1'
        ),
        (
          '00000000-0000-4000-8000-000000000702',
          '00000000-0000-4000-8000-000000000101',
          '00000000-0000-4000-8000-000000000202',
          DATE '2025-10-11', 1, 0, 0, 1, 1, 3, 4, 2, 2, 2,
          0.500000, TIMESTAMPTZ '2025-10-11 05:00:00+00',
          TIMESTAMPTZ '2025-10-11 05:05:00+00', 'standings.v1'
        ),
        (
          '00000000-0000-4000-8000-000000000703',
          '00000000-0000-4000-8000-000000000101',
          '00000000-0000-4000-8000-000000000203',
          DATE '2025-10-11', 0, 0, 0, 0, 0, 0, 0, 3, 3, 3,
          0.000000, TIMESTAMPTZ '2025-10-11 05:00:00+00',
          TIMESTAMPTZ '2025-10-11 05:05:00+00', 'standings.v1'
        ),
        (
          '00000000-0000-4000-8000-000000000704',
          '00000000-0000-4000-8000-000000000101',
          '00000000-0000-4000-8000-000000000204',
          DATE '2025-10-11', 0, 0, 0, 0, 0, 0, 0, 4, 4, 4,
          0.000000, TIMESTAMPTZ '2025-10-11 05:00:00+00',
          TIMESTAMPTZ '2025-10-11 05:05:00+00', 'standings.v1'
        )
      ON CONFLICT (id) DO UPDATE
      SET
        games_played = EXCLUDED.games_played,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses,
        overtime_losses = EXCLUDED.overtime_losses,
        points = EXCLUDED.points,
        goals_for = EXCLUDED.goals_for,
        goals_against = EXCLUDED.goals_against,
        league_rank = EXCLUDED.league_rank,
        conference_rank = EXCLUDED.conference_rank,
        division_rank = EXCLUDED.division_rank,
        point_percentage = EXCLUDED.point_percentage,
        source_cutoff = EXCLUDED.source_cutoff,
        computed_at = EXCLUDED.computed_at,
        formula_version = EXCLUDED.formula_version;

      INSERT INTO analytics.player_metric_snapshot (
        id, season_id, player_id, metric_code, "window", as_of_game_id,
        value, sample_size, formula_version, computed_at
      )
      VALUES (
        '00000000-0000-4000-8000-000000000711',
        '00000000-0000-4000-8000-000000000101',
        '00000000-0000-4000-8000-000000000301',
        'player.pointsPerGame', 'LAST_5',
        '00000000-0000-4000-8000-000000000401',
        4.000000, 1, 'player.pointsPerGame.v1',
        TIMESTAMPTZ '2025-10-11 05:05:00+00'
      )
      ON CONFLICT (id) DO UPDATE
      SET
        value = EXCLUDED.value,
        sample_size = EXCLUDED.sample_size,
        formula_version = EXCLUDED.formula_version,
        computed_at = EXCLUDED.computed_at;

      INSERT INTO analytics.team_metric_snapshot (
        id, season_id, team_id, metric_code, "window", as_of_game_id,
        value, sample_size, formula_version, computed_at
      )
      VALUES (
        '00000000-0000-4000-8000-000000000721',
        '00000000-0000-4000-8000-000000000101',
        '00000000-0000-4000-8000-000000000201',
        'team.scoringDifferentialPerGame', 'LAST_5',
        '00000000-0000-4000-8000-000000000401',
        1.000000, 1, 'team.scoringDifferentialPerGame.v1',
        TIMESTAMPTZ '2025-10-11 05:05:00+00'
      )
      ON CONFLICT (id) DO UPDATE
      SET
        value = EXCLUDED.value,
        sample_size = EXCLUDED.sample_size,
        formula_version = EXCLUDED.formula_version,
        computed_at = EXCLUDED.computed_at;

      INSERT INTO analytics.team_ranking_snapshot (
        id, season_id, team_id, ranking_code, as_of_date, rank, score,
        sample_size, formula_version, computed_at
      )
      VALUES
        (
          '00000000-0000-4000-8000-000000000731',
          '00000000-0000-4000-8000-000000000101',
          '00000000-0000-4000-8000-000000000201',
          'team.powerRanking', DATE '2025-10-11', 1, 100.000000, 1,
          'team.powerRanking.v1', TIMESTAMPTZ '2025-10-11 05:05:00+00'
        ),
        (
          '00000000-0000-4000-8000-000000000732',
          '00000000-0000-4000-8000-000000000101',
          '00000000-0000-4000-8000-000000000202',
          'team.powerRanking', DATE '2025-10-11', 2, 75.000000, 1,
          'team.powerRanking.v1', TIMESTAMPTZ '2025-10-11 05:05:00+00'
        ),
        (
          '00000000-0000-4000-8000-000000000733',
          '00000000-0000-4000-8000-000000000101',
          '00000000-0000-4000-8000-000000000203',
          'team.powerRanking', DATE '2025-10-11', 3, 50.000000, 1,
          'team.powerRanking.v1', TIMESTAMPTZ '2025-10-11 05:05:00+00'
        ),
        (
          '00000000-0000-4000-8000-000000000734',
          '00000000-0000-4000-8000-000000000101',
          '00000000-0000-4000-8000-000000000204',
          'team.powerRanking', DATE '2025-10-11', 4, 25.000000, 1,
          'team.powerRanking.v1', TIMESTAMPTZ '2025-10-11 05:05:00+00'
        )
      ON CONFLICT (id) DO UPDATE
      SET
        rank = EXCLUDED.rank,
        score = EXCLUDED.score,
        sample_size = EXCLUDED.sample_size,
        formula_version = EXCLUDED.formula_version,
        computed_at = EXCLUDED.computed_at;
    `);

    await client.query('COMMIT');

    const result = await client.query(`
      SELECT
        (SELECT count(*)::int FROM core.team) AS teams,
        (SELECT count(*)::int FROM core.player) AS players,
        (SELECT count(*)::int FROM core.game) AS games
    `);
    const counts = result.rows[0];
    console.info(
      `Seed complete: ${counts.teams} teams, ${counts.players} players, ${counts.games} games.`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

await seed();
