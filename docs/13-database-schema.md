# Database Schema Specification

This is the canonical logical schema. Prisma naming and mapping requirements are
defined in `docs/23-prisma-schema.md`.

Unless noted otherwise, identifiers are UUIDs and mutable models include
`created_at` and `updated_at`.

## Enumerations

- `game_status`: `SCHEDULED`, `PRE_GAME`, `LIVE`, `FINAL`, `POSTPONED`,
  `CANCELLED`
- `game_type`: `PRESEASON`, `REGULAR_SEASON`, `PLAYOFF`, `ALL_STAR`
- `decision_type`: `REGULATION`, `OVERTIME`, `SHOOTOUT`
- `payload_status`: `FETCHED`, `VALIDATED`, `PROCESSED`, `REJECTED`
- `job_type`: `TEAMS`, `PLAYERS`, `SCHEDULE`, `GAME_STATISTICS`,
  `STANDINGS`, `ANALYTICS`, `DISPATCH`
- `job_trigger`: `SCHEDULED`, `MANUAL`, `REPLAY`
- `job_status`: `PENDING`, `RUNNING`, `SUCCEEDED`, `PARTIAL`, `FAILED`,
  `SKIPPED`
- `issue_severity`: `WARNING`, `ERROR`
- `metric_window`: `SEASON`, `LAST_5`, `LAST_10`, `LAST_20`

## Raw Schema

### `raw.provider_payload`

An immutable response received from a provider.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid | primary key |
| `provider` | text | `nhl` for the initial adapter |
| `resource_type` | text | adapter-owned stable resource name |
| `external_key` | text | stable lookup key, such as game ID |
| `request_path` | text | path only; no secret-bearing query values |
| `request_parameters` | jsonb | allowlisted non-secret parameters |
| `http_status` | integer | 100 through 599 |
| `content_type` | text | response content type when supplied |
| `payload` | jsonb | parsed complete JSON body, nullable |
| `body_text` | text | non-JSON body, nullable |
| `checksum` | char(64) | SHA-256 of the exact response body bytes |
| `status` | payload_status | defaults to `FETCHED` |
| `fetched_at` | timestamptz | required |
| `processed_at` | timestamptz | nullable |
| `job_execution_id` | uuid | nullable FK to `ops.job_execution`; `SET NULL` |

Unique: `(provider, resource_type, external_key, checksum)`.

Exactly one of `payload` and `body_text` is required. An invalid or non-JSON
upstream response is retained as text and rejected before transformation.

Indexes: `(provider, resource_type, external_key, fetched_at desc)`,
`(status, fetched_at)`, and `job_execution_id`.

The row is append-only except for `status` and `processed_at`.

## Core Schema

### `core.league`

`id`, `code`, `name`, timestamps.

- `code` is unique, uppercase, and uses `NHL` for the initial league.

### `core.season`

`id`, `league_id`, `label`, `start_date`, `end_date`, timestamps.

- Unique `(league_id, label)`.
- `label` format is `YYYY-YYYY`.
- `start_date < end_date`.

### `core.team`

`id`, `league_id`, `name`, `abbreviation`, `city`, `active`, timestamps.

- Unique `(league_id, abbreviation)`.
- `abbreviation` is uppercase.
- Historical teams remain present with `active = false`.

### `core.player`

`id`, `current_team_id` nullable, `first_name`, `last_name`, `position`
nullable, `shoots_catches` nullable, `birth_date` nullable, `active`,
timestamps.

- `current_team_id` uses `SET NULL` on team deletion.
- Position values are provider-normalized to `C`, `L`, `R`, `D`, or `G`.
- Player names are indexed case-insensitively for prefix and token search.

Historical team participation is preserved on `player_game_stat.team_id`;
the MVP does not model contract or trade history.

### `core.game`

`id`, `season_id`, `home_team_id`, `away_team_id`, `starts_at`, `game_type`,
`status`, `venue` nullable, `home_score` nullable, `away_score` nullable,
`decision_type` nullable, timestamps.

- Home and away teams must differ.
- Scores are non-negative and required when status is `FINAL`.
- `decision_type` is set only for a final game.
- Unique `(season_id, home_team_id, away_team_id, starts_at)`.
- Indexes: `(season_id, starts_at desc)`, `(home_team_id, starts_at desc)`,
  `(away_team_id, starts_at desc)`, and `(status, starts_at)`.

### `core.player_game_stat`

`id`, `game_id`, `player_id`, `team_id`, `goals`, `assists`, `shots`,
`penalty_minutes`, `plus_minus`, `power_play_goals`, `short_handed_goals`,
`time_on_ice_seconds`, timestamps.

- Unique `(game_id, player_id)`.
- Count fields except `plus_minus` are non-negative.
- The team must be one of the game's two teams; ingestion validates this and an
  integration test covers it.
- Indexes: `(player_id, game_id)` and `(team_id, game_id)`.
- Points and shooting percentage are derived, not stored.

### `core.team_game_stat`

`id`, `game_id`, `team_id`, `goals_for`, `goals_against`, `shots_for`,
`shots_against`, `power_play_goals`, `power_play_opportunities`,
`penalty_minutes`, timestamps.

- Unique `(game_id, team_id)`.
- All values are non-negative.
- Exactly two rows, one for each team, are expected for a final game.
- Index: `(team_id, game_id)`.
- Power-play percentage is derived, not stored.

## Provider Identity Tables

The following tables exist in `core`:

- `league_provider_identity`
- `season_provider_identity`
- `team_provider_identity`
- `player_provider_identity`
- `game_provider_identity`

Each has `id`, `provider`, `external_id`, the corresponding entity foreign key,
and `created_at`. Each enforces:

- unique `(provider, external_id)`; and
- unique `(provider, <entity>_id)`.

Entity deletion cascades to its identity rows. External IDs are strings and are
never exposed as IceMetrics resource IDs.

## Core Delete Policy

- League deletion is restricted while seasons or teams exist.
- Season deletion is restricted while games or analytics exist.
- Team deletion sets a player's `current_team_id` to null but is restricted by
  games or statistics.
- Player deletion is restricted while game statistics exist.
- Game deletion cascades to its player/team statistics and metric snapshots,
  but imported games are not deleted during normal operation.
- Provider identities cascade only when their owning core entity is deliberately
  removed.

## Analytics Schema

### `analytics.team_standing_snapshot`

`id`, `season_id`, `team_id`, `as_of_date`, `games_played`, `wins`, `losses`,
`overtime_losses`, `points`, `goals_for`, `goals_against`, `league_rank`,
`conference_rank` nullable, `division_rank` nullable, `point_percentage`,
`source_cutoff`, `computed_at`, `formula_version`.

Unique `(season_id, team_id, as_of_date)`.

### `analytics.player_metric_snapshot`

`id`, `season_id`, `player_id`, `metric_code`, `window`, `as_of_game_id`,
`value`, `sample_size`, `formula_version`, `computed_at`.

Unique `(season_id, player_id, metric_code, window, as_of_game_id)`.

Only rolling metrics are persisted. `window` cannot be `SEASON` in the MVP.
Allowed `metric_code` values are:

- `player.pointsPerGame`
- `player.goalsPerGame`
- `player.assistsPerGame`
- `player.shootingPercentage`
- `player.consistencyScore`

### `analytics.team_metric_snapshot`

The team equivalent of `player_metric_snapshot`, keyed by team and game cutoff.
Allowed `metric_code` values are:

- `team.pointPercentage`
- `team.scoringDifferentialPerGame`
- `team.recentPerformanceTrend`

### `analytics.team_ranking_snapshot`

`id`, `season_id`, `team_id`, `ranking_code`, `as_of_date`, `rank`, `score`,
`sample_size`, `formula_version`, `computed_at`.

Unique `(season_id, team_id, ranking_code, as_of_date)`.

The only MVP `ranking_code` is `team.powerRanking`.

All analytics values use `numeric(12,6)`. Analytics rows cascade when their
owning core entity is removed; core historical entities are normally retained.

## Operations Schema

### `ops.job_execution`

`id`, `job_type`, `trigger`, `status`, `scheduled_for` nullable, `requested_at`,
`started_at` nullable, `finished_at` nullable, `attempt`, `correlation_id`,
`parameters` jsonb, `cursor` jsonb nullable, `records_fetched`,
`records_created`, `records_updated`, `records_unchanged`, `records_failed`,
`error_summary` jsonb nullable.

- `correlation_id` is indexed.
- `(job_type, status, requested_at desc)` is indexed.
- Counters are non-negative.
- Terminal states require `finished_at`.

### `ops.import_issue`

`id`, `job_execution_id`, `provider_payload_id` nullable, `severity`, `code`,
`entity_type`, `external_key` nullable, `message`, `details` jsonb nullable,
`created_at`.

- Deleting a job execution cascades to its issues.
- Deleting a raw payload is prohibited while referenced.
- Indexes: `job_execution_id`, `(code, created_at desc)`.

## Initial Migration Acceptance Criteria

- A fresh PostgreSQL 17 database migrates without manual SQL.
- All four application schemas and every table above exist.
- Duplicate provider identities, duplicate game statistics, negative counts,
  and same-team games are rejected.
- The API query indexes are visible in the migration.
- Migration rollback guidance is documented; production rollback uses a forward
  corrective migration rather than deleting an applied migration.
