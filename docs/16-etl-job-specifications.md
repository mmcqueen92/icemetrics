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
- Upserts league, active teams, and provider identities.
- Marks a team inactive only after it is absent from three consecutive
  successful daily snapshots; absence never deletes history.

### Players

- Frequency: daily after Teams, after 10:00 UTC.
- Fetches the active roster for every active team in the current season.
- Upserts players, current teams, positions, and provider identities.
- A player is marked inactive only after successful processing of every active
  roster and absence from three consecutive daily runs.

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
still records a job execution and raw payload unless `--fixture` is used.

## Completion Requirements

Every job:

- records start, terminal status, parameters, correlation ID, counts, and
  duration;
- is idempotent and lock-protected;
- validates all provider data;
- has fixture-backed success, retry, partial-failure, and repeat-run tests; and
- emits one structured completion log.
