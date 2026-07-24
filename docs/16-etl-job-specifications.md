# ETL Job Specifications

## Dispatcher

Render runs one command hourly at minute 10 UTC:

```text
npm run jobs:dispatch --workspace @icemetrics/api
```

The dispatcher records its own execution, reconciles abandoned `RUNNING` rows,
checks which logical jobs are due, runs them in dependency order, and exits.
Render's single-run guarantee is supplemented by a PostgreSQL advisory lock so
manual and scheduled executions cannot overlap.

## Logical Jobs

### Teams

- Frequency: daily after 09:00 UTC.
- Fetches the team directory and current standings metadata.
- Fetches authoritative season dates for the single season identified by the
  standings snapshot.
- Joins current standings teams to the directory by uppercase abbreviation and
  upserts the league, season, active teams, and provider identities in one
  transaction.
- Marks a team inactive only after it is absent from three consecutive
  successful daily snapshots; absence never deletes history.

### Players

- Frequency: daily after Teams, after 10:00 UTC.
- Fetches the active roster for every active team in the current season.
- Upserts players, current teams, positions, and provider identities.
- A player is marked inactive only after successful processing of every active
  roster and absence from three consecutive daily runs.
- Each team roster is transformed in its own transaction so an invalid entity
  or failed roster cannot roll back a previously completed team.

### Reference Snapshot Semantics

Teams and Players store the sorted external IDs observed by a successful,
non-dry-run snapshot in `ops.job_execution.cursor.externalIds`. The two most
recent qualifying cursors provide absence history: the first and second
consecutive absence create warning issues, and the third deactivates the
record. Partial, failed, skipped, and dry-run executions never advance this
history. Inactivation is also suppressed when any required roster or reference
entity failed, preventing an incomplete provider response from creating false
inactive records.

Reference-job counts describe normalized entities, not HTTP requests:

- `records_fetched` counts provider collection members, including rejected
  members, plus the season record;
- created, updated, and unchanged count persisted league, season, team, or
  player mutations; inactivation counts as an update; and
- `records_failed` counts each rejected or unjoinable entity.

Top-level payload validation failures fail the execution. Partitionable entity
failures produce `PARTIAL` when valid siblings were persisted. Raw payloads are
marked `PROCESSED` only after their corresponding core transaction succeeds.

### Schedule

- Frequency: hourly during an active NHL season; daily otherwise.
- Fetches the provider's date-oriented schedule window.
- Upserts scheduled games and status/score changes.
- Deduplicates games by game provider identity.

### Game Statistics

- Frequency: hourly after Schedule.
- Selects final games with missing statistics, changed upstream checksums, or a
  last successful import older than 24 hours during the seven-day correction
  window.
- Fetches and preserves both the gamecenter box-score payload and its
  right-rail team-stat payload; the latter is authoritative for shots,
  power-play goals/opportunities, and penalty minutes.
- Imports one box score transaction per game.
- Rechecks final games at 1, 6, and 24 hours after first becoming final.

### Standings

- Frequency: hourly after Game Statistics during an active season; daily
  otherwise.
- Imports the official dated standings snapshot.
- Does not overwrite a previous date's snapshot.

### Analytics

- Trigger: after any Game Statistics job that creates or updates records, and
  once nightly after 11:00 UTC.
- Recalculates rolling metrics and rankings from the earliest affected game
  forward.
- Uses normalized core statistics; official standings are used only for
  standings display and season point-percentage inputs.

## Active Season

A season is active when the current UTC date is between its start and end dates
inclusive. If no active season exists, hourly game-related jobs return
`SKIPPED` unless explicitly given a season or date.

## Required Parameters

Manual commands accept explicit, validated options:

- `--job <type>`
- `--season-id <uuid>`
- `--date YYYY-MM-DD`
- `--date-from` and `--date-to`
- `--game-id <internal uuid>`
- `--dry-run`

`--dry-run` may fetch and validate but must not write core or analytics data. It
still records a job execution and raw payload unless `--fixture` is used, and
does not contribute to absence history.

## Completion Requirements

Every job:

- records start, terminal status, parameters, correlation ID, counts, and
  duration;
- is idempotent and lock-protected;
- validates all provider data;
- has fixture-backed success, retry, partial-failure, and repeat-run tests; and
- emits one structured completion log.
