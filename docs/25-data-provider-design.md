# Data Provider Design

## Provider Contract

The ingestion layer depends on a framework-independent `HockeyDataProvider`
interface. The initial interface exposes:

```text
getTeams()
getRoster(teamAbbreviation, seasonExternalId)
getSchedule(date)
getTeamSeasonSchedule(teamAbbreviation, seasonExternalId)
getGameBoxscore(gameExternalId)
getPlayer(playerExternalId)
getStandings(date)
```

Each operation returns:

- an allowlisted request descriptor for raw-storage metadata;
- the unmodified response body;
- a validated provider DTO; and
- retrieval metadata including fetch time and HTTP status.

The adapter does not write to Prisma. Ingestion orchestration stores the raw
response and then passes the validated DTO to a transformer.

## Internal Provider DTOs

All upstream identifiers are normalized to non-empty strings at the adapter
boundary. These DTOs contain no Prisma or NestJS types:

```text
ProviderTeam
  externalId, name, abbreviation, city, active

ProviderPlayer
  externalId, firstName, lastName, position|null, shootsCatches|null,
  birthDate|null, active, currentTeamExternalId|null

ProviderGame
  externalId, seasonExternalId, startsAt, gameType, status, venue|null,
  homeTeamExternalId, awayTeamExternalId, homeScore|null, awayScore|null,
  decisionType|null

ProviderPlayerGameStat
  playerExternalId, teamExternalId, goals, assists, shots, penaltyMinutes,
  plusMinus, powerPlayGoals, shortHandedGoals, timeOnIceSeconds

ProviderTeamGameStat
  teamExternalId, goalsFor, goalsAgainst, shotsFor, shotsAgainst,
  powerPlayGoals, powerPlayOpportunities, penaltyMinutes

ProviderGameBoxscore
  game: ProviderGame, players: ProviderPlayerGameStat[],
  teams: ProviderTeamGameStat[]

ProviderStanding
  teamExternalId, seasonExternalId, asOfDate, gamesPlayed, wins, losses,
  overtimeLosses, points, goalsFor, goalsAgainst, leagueRank,
  conferenceRank|null, divisionRank|null, pointPercentage, sourceCutoff
```

Provider localized strings use the upstream default/English value. A required
name without a default/English value rejects the entity instead of guessing a
translation.

## NHL Value Mapping

Game type values map as:

| NHL value | Internal value |
| --- | --- |
| `1` | `PRESEASON` |
| `2` | `REGULAR_SEASON` |
| `3` | `ALL_STAR` |
| `4` | `PLAYOFF` |

Schedule state takes precedence: a provider postponed marker maps to
`POSTPONED`, and a cancelled marker maps to `CANCELLED`. Otherwise game-state
values map as:

| NHL value | Internal value |
| --- | --- |
| `FUT` | `SCHEDULED` |
| `PRE` | `PRE_GAME` |
| `LIVE`, `CRIT` | `LIVE` |
| `FINAL`, `OFF` | `FINAL` |

Unknown values fail validation and create an import issue. Do not silently map
them to the nearest known status.

## Initial Provider

Provider code: `nhl`

Hosts:

- `https://api-web.nhle.com/v1`
- `https://api.nhle.com/stats/rest/en`

Approved endpoint families:

| Capability | Endpoint |
| --- | --- |
| Team directory and stable IDs | Stats API `/team` |
| Current or dated standings | Web API `/standings/{date-or-now}` |
| Roster | Web API `/roster/{teamAbbreviation}/{seasonCode}` |
| Daily schedule | Web API `/schedule/{date}` |
| Season backfill schedule | Web API `/club-schedule-season/{teamAbbreviation}/{seasonCode}` |
| Game and player box score | Web API `/gamecenter/{gameId}/boxscore` |
| Player profile | Web API `/player/{playerId}/landing` |

Endpoint paths are configuration inside the NHL adapter, not scattered
constants. The adapter may combine web and stats responses, but downstream code
sees one provider.

## Reliability Policy

The NHL-owned endpoints are public and currently require no API key, but they do
not publish a developer SLA or a versioned compatibility contract. Therefore:

- request timeout is 10 seconds;
- maximum concurrency per process is 4;
- retry at most 3 times after the initial attempt;
- retry only network failures, HTTP 408, 429, and 5xx;
- use exponential backoff beginning at 500 ms with jitter;
- honor `Retry-After` when present;
- do not retry other 4xx responses;
- send a descriptive `User-Agent` with a project contact URL;
- log endpoint family and status, never full bodies; and
- fail the job rather than silently returning incomplete data.

The base URLs and timeout are configurable. Endpoint shapes and transformation
rules are code and require tests.

## Runtime Validation

Provider DTOs are explicit and validated at runtime. Unknown upstream fields are
ignored after the complete payload is preserved. Missing required identifiers,
invalid dates, unknown game statuses, and impossible statistics reject the
affected entity and create an import issue.

Provider fixture tests must include:

- one fixture per approved endpoint family;
- nullable/localized name variants;
- a postponed game;
- a live and a final game;
- skater and goalie roster entries;
- empty arrays; and
- a deliberately malformed response.

Fixtures are sanitized snapshots and record their retrieval date and endpoint.

## Provider Replacement

A second provider or fallback is added only after:

1. measured failures or missing data are documented;
2. licensing and cost are reviewed;
3. its identifiers can be mapped without changing core IDs; and
4. contract fixtures demonstrate equivalent internal DTOs.

Fallback must not merge two upstream responses implicitly. Each raw payload and
provider identity retains its source.

## Usage Constraints

Do not ingest or display NHL logos, player photographs, video, or other media in
the MVP unless redistribution rights are separately confirmed. Public
deployment must include attribution and a disclaimer that IceMetrics is not
affiliated with or endorsed by the NHL.
