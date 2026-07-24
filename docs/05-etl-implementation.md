# ETL Implementation

## Pipeline

```text
NHL provider
  -> provider HTTP client
  -> immutable raw payload
  -> runtime schema validation
  -> data-quality validation
  -> internal provider DTO
  -> bounded core transaction
  -> analytics refresh
  -> job summary
```

Raw storage precedes transformation. If the response is valid JSON but fails
schema validation, preserve it with `REJECTED` status and record an import
issue.

## Idempotency

- Fetches deduplicate identical payloads by provider, resource type, external
  key, and SHA-256 checksum of the exact response body bytes.
- Core upserts resolve explicit provider identity first.
- A game-statistics import that encounters an unknown player fetches and
  validates that player's profile, stores its raw payload, and creates the
  player identity before importing the box score. If the player cannot be
  resolved, only that player row is rejected and the job becomes `PARTIAL`.
- A repeated unchanged record increments `records_unchanged`.
- Statistics use `(game_id, player_id)` and `(game_id, team_id)` uniqueness.
- A corrected final box score updates normalized statistics, preserves both raw
  responses, and triggers analytics recalculation from the affected game date.
- Every logical job can be safely re-run with the same parameters.

## Transactions

- Create the raw payload outside the core transaction.
- Use one transaction per team roster, schedule page, game, or standings
  snapshot.
- Do not wrap an entire season backfill in one transaction.
- Update payload processing status only after the core transaction succeeds.
- Analytics refresh is a separate transaction and can be retried without
  re-fetching upstream data.

## Concurrency

- The dispatcher acquires a PostgreSQL advisory lock.
- Each logical job acquires its own advisory lock derived from job type and
  scope.
- If a lock is unavailable, create a `SKIPPED` execution rather than waiting
  indefinitely.
- Provider concurrency is capped at 4 requests per process.
- There is no queue or background worker in the MVP.

## Replay

The job runner supports replaying an existing raw payload without a network
request:

```text
npm run jobs:replay --workspace @icemetrics/api -- --payload-id <uuid>
```

Replay creates a new `JobExecution` with trigger `REPLAY`, links the existing
payload through the immutable `parameters.payloadId` value, applies current
validators/transformers, and records its own outcome. The payload retains its
original `job_execution_id`; replay never rewrites provenance.

## Failure Semantics

- One invalid entity does not discard valid sibling entities when the provider
  response can be partitioned safely.
- `PARTIAL` means at least one entity committed and at least one failed.
- A required parent identity failure rejects dependent records.
- Unexpected process failure marks a still-running execution `FAILED` on the
  next dispatcher reconciliation.
- Logical job commands exit non-zero for `FAILED`, and zero for `SUCCEEDED` or
  `SKIPPED`. The dispatcher also exits non-zero when a child fails or when a
  `PARTIAL` child exceeds the 1% failed-entity alert threshold. Smaller partial
  outcomes exit zero but remain visible as warnings and job records.

## Backfills

Backfills are explicit manual CLI runs with a league, season, or date range.
Date ranges are validated and processed in resumable chunks. The cursor is
stored on `JobExecution`; restarting a failed backfill resumes after the last
committed chunk.
