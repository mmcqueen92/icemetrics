# API Endpoint Specification

All product paths below are relative to `/api/v1`. Unless stated otherwise,
responses use the envelopes from `docs/04-api-specification.md`.

Every core collection in this document is paginated using the shared `page`,
`pageSize`, and `order` parameters, including leagues, seasons, teams, rosters,
players, standings, games, and game-statistics collections. A valid filter that
matches no rows returns an empty collection. A collection scoped beneath a
missing path resource, such as a missing player's statistics, returns 404.

## Leagues and Seasons

### `GET /leagues`

Returns active leagues. MVP result is NHL.

Sort: `name`, `code`. Default: `name asc`.

### `GET /seasons`

Filters: `leagueId`, `activeOn` (`YYYY-MM-DD`).

Sort: `startDate`, `label`. Default: `startDate desc`.

### `GET /seasons/:id`

Returns one season.

## Players

### `GET /players`

Filters:

- `search`
- `teamId`
- `position`: `C`, `L`, `R`, `D`, or `G`
- `active`: `true` or `false`

Sort: `lastName`, `firstName`, `position`. Default: `lastName asc`.

### `GET /players/:id`

Returns the player profile and current team summary. It does not embed game
history or analytics.

### `GET /players/:id/stats`

Returns paginated game-by-game statistics.

Required filter: `seasonId`. Optional filters: `dateFrom`, `dateTo`.

Sort: `gameDate`. Default: `gameDate desc`. Default page size: `50`.

Each row contains game and opponent summaries plus goals, assists, points,
shots, shooting percentage, penalty minutes, plus/minus, and time-on-ice
seconds.

## Teams

### `GET /teams`

Filters: `leagueId`, `active`.

Sort: `name`, `city`, `abbreviation`. Default: `name asc`.

### `GET /teams/:id`

Returns a team summary.

### `GET /teams/:id/roster`

Filters: `active`, defaulting to `true`.

Sort: `lastName`, `position`. Default: `lastName asc`.

The response is paginated because roster history may be added later.

### `GET /standings`

Required filter: `seasonId`.

Optional filter: `asOfDate`; an explicit value selects that exact snapshot
date. When omitted, the latest available snapshot for the season is selected.

Sort: `leagueRank`, `points`, `pointPercentage`, `name`. Default:
`leagueRank asc`.

## Games

### `GET /games`

Filters:

- `seasonId`
- `teamId`
- `status`
- `gameType`
- `dateFrom`
- `dateTo`

At least `seasonId` or one date bound is required. Date bounds may span no more
than 366 days.

Sort: `startsAt`, `status`. Default: `startsAt desc`.

### `GET /games/:id`

Returns the game summary, score, status, and team game statistics when
available.

### `GET /games/:id/player-stats`

Returns paginated player box-score rows.

Filter: `teamId`. Sort: `points`, `shots`, `timeOnIceSeconds`, `lastName`.
Default: `points desc`.

## Analytics

### `GET /analytics/players/:id/summary`

Required: `seasonId`.

Returns the API-owned season aggregate for one player, including the player and
season summaries, sample size, data cutoff, formula version, and named metric
values. This endpoint is the player-profile source; clients must not calculate
the aggregate from paginated game logs.

### `GET /analytics/players/:id/trends`

Required: `seasonId`.

Optional: `window`, one of `5`, `10`, or `20`; default `10`.

Returns chronological rolling points-per-game, goals-per-game,
assists-per-game, shooting percentage, and consistency score snapshots.

### `GET /analytics/player-comparisons`

Required:

- `playerIds`: 2 to 5 distinct comma-separated UUIDs
- `seasonId`

Optional: `window`: `season`, `5`, `10`, or `20`; default `season`.

Returns the same named metrics for every requested player and reports each
sample size. Missing players produce 404. Players with no sample return null
metric values rather than being omitted.

### `GET /analytics/teams/:id/trends`

Required: `seasonId`.

Optional: `window`, currently only `10`.

Returns recent point-percentage and scoring-differential trend data.

### `GET /analytics/teams/rankings`

Required: `seasonId`.

Optional: `asOfDate`; defaults to the latest complete ranking date.

Returns all ranked teams. This collection is not page-limited because one NHL
season contains a bounded number of teams; it still returns `{ data }`.

## Canonical Response DTOs

All documented fields are present. Nullable values are serialized as `null`,
not omitted. List endpoints use the summary DTO for their resource.

### League and Season

```text
LeagueSummary
  id, code, name

SeasonSummary
  id, leagueId, label, startDate, endDate
```

### Team

```text
TeamSummary
  id, name, abbreviation, city, active

TeamDetail
  id, league: LeagueSummary, name, abbreviation, city, active

RosterPlayer
  id, firstName, lastName, position|null, shootsCatches|null, active
```

### Player

```text
PlayerSummary
  id, firstName, lastName, position|null, active,
  currentTeam: TeamSummary|null

PlayerDetail
  id, firstName, lastName, position|null, shootsCatches|null,
  birthDate|null, active, currentTeam: TeamSummary|null

PlayerGameStat
  game: GameSummary, team: TeamSummary, opponent: TeamSummary, isHome,
  goals, assists, points, shots, shootingPercentage|null, penaltyMinutes,
  plusMinus, powerPlayGoals, shortHandedGoals, timeOnIceSeconds
```

### Game

```text
GameTeam
  team: TeamSummary, score|null

GameSummary
  id, seasonId, startsAt, gameType, status, venue|null,
  home: GameTeam, away: GameTeam, decisionType|null

TeamGameStat
  team: TeamSummary, goalsFor, goalsAgainst, shotsFor, shotsAgainst,
  powerPlayGoals, powerPlayOpportunities, powerPlayPercentage|null,
  penaltyMinutes

GameDetail
  all GameSummary fields, teamStats: TeamGameStat[]

PlayerBoxScore
  player: RosterPlayer, team: TeamSummary, goals, assists, points, shots,
  shootingPercentage|null, penaltyMinutes, plusMinus, powerPlayGoals,
  shortHandedGoals, timeOnIceSeconds
```

### Standings and Analytics

```text
Standing
  team: TeamSummary, seasonId, asOfDate, gamesPlayed, wins, losses,
  overtimeLosses, points, goalsFor, goalsAgainst, leagueRank,
  conferenceRank|null, divisionRank|null, pointPercentage, sourceCutoff

MetricValues
  pointsPerGame|null, goalsPerGame|null, assistsPerGame|null,
  shootingPercentage|null, consistencyScore|null

PlayerTrendPoint
  asOfGameId, asOfDate, window, sampleSize, metrics: MetricValues,
  formulaVersion, computedAt

PlayerComparison
  season: SeasonSummary, window, players: [
    { player: PlayerSummary, sampleSize, metrics: MetricValues }
  ], dataCutoff, formulaVersion

TeamTrendPoint
  team: TeamSummary, seasonId, asOfGameId, asOfDate, window, sampleSize,
  pointPercentage, scoringDifferentialPerGame, recentPerformanceTrend,
  formulaVersion, computedAt

TeamRanking
  rank, team: TeamSummary, seasonId, asOfDate, score, sampleSize,
  seasonPointPercentage, last10PointPercentage,
  scoringDifferentialPerGame, formulaVersion, computedAt
```

Rates and percentages are JSON numbers rounded to four decimal places. The API
does not serialize Prisma `Decimal` objects or numeric strings.

## Endpoint Scope

There are deliberately no routes for:

- registration, login, users, or tokens;
- creating or editing hockey data;
- triggering, retrying, or inspecting ingestion jobs; or
- exposing raw provider payloads.

Operational execution uses the job-runner CLI and Render access controls.
