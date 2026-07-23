# Prisma Schema Specification

## Model Inventory

The initial Prisma schema contains these models:

```text
raw
  ProviderPayload

core
  League
  Season
  Team
  Player
  Game
  PlayerGameStat
  TeamGameStat
  LeagueProviderIdentity
  SeasonProviderIdentity
  TeamProviderIdentity
  PlayerProviderIdentity
  GameProviderIdentity

analytics
  TeamStandingSnapshot
  PlayerMetricSnapshot
  TeamMetricSnapshot
  TeamRankingSnapshot

ops
  JobExecution
  ImportIssue
```

No `User`, token, session, role, or authorization model belongs in the MVP
schema.

## Required Relations

- `League` has seasons and teams.
- `Season` belongs to a league and has games, standings, and metric snapshots.
- `Team` belongs to a league, may be a player's current team, appears as a
  game's home or away team, and owns team/player game-stat rows.
- `Player` optionally belongs to a current team and owns player game-stat rows.
- `Game` belongs to a season and has two named team relations.
- Each core entity with an upstream identity has explicit provider-identity
  rows.
- Analytics snapshots reference normalized core entities and their cutoff game
  where applicable.
- Raw payloads and import issues optionally reference the job that processed
  them.

## Mapping Example

```prisma
model Team {
  id           String   @id @default(uuid()) @db.Uuid
  leagueId     String   @map("league_id") @db.Uuid
  name         String
  abbreviation String
  city         String
  active       Boolean  @default(true)
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  league League @relation(fields: [leagueId], references: [id], onDelete: Restrict)

  @@unique([leagueId, abbreviation])
  @@index([leagueId, active])
  @@map("team")
  @@schema("core")
}
```

All actual models follow the mapping, relation, timestamp, and delete rules in
`docs/03-prisma-model-guidelines.md`.

## Enums and Custom SQL

Prisma enums mirror the values in `docs/13-database-schema.md`. Generated
migrations are extended with named PostgreSQL checks and indexes that Prisma
cannot express. Constraint names use:

```text
ck_<table>_<rule>
uq_<table>_<columns>
ix_<table>_<columns>
```

## Seeds

The seed is deterministic and contains:

- one NHL league;
- one representative season;
- at least four teams;
- skaters and a goaltender;
- scheduled and final games;
- complete player and team statistics for final games; and
- analytics snapshots with known expected values.

Seed identifiers are fixed UUIDs so API fixtures and frontend development are
repeatable. Seed data is for development and tests only and is never applied by
the production migration command.
