# Performance Guide

## Budgets

Initial production budgets:

- API p95 under 500 ms and p99 under 1 second for normal read endpoints.
- API response body under 1 MB; normal paginated responses under 250 KB.
- Angular initial compressed JavaScript budget set by the Angular build to
  500 KB warning and 750 KB error.
- No synchronous request may invoke the NHL provider.
- Hourly dispatcher should finish within 15 minutes under normal game-day load.

## Database

- Add indexes for every documented filter/order pair before enabling the
  endpoint.
- Use bounded pagination and explicit field selection.
- Avoid N+1 relation loading; verify query counts in integration tests for
  compound responses.
- Use `EXPLAIN (ANALYZE, BUFFERS)` with representative data before adding an
  index for a measured slow query.
- Set an application statement timeout of 5 seconds for API queries and a
  documented longer timeout only for bounded analytics/job operations.

The implemented Prisma service owns a bounded PostgreSQL pool with five-second
connection and statement timeouts. Readiness uses that same pool with an
additional two-second outward deadline so dependency stalls cannot hold the
health endpoint open indefinitely.

## API

- Use ETag and cache headers from `docs/04-api-specification.md`.
- Compress JSON at the platform edge when supported.
- Do not add application caching until measurements identify a stable,
  frequently repeated query and invalidation is defined.
- A response requiring more than 100 rows must use a specifically documented
  bounded collection exception, such as NHL team rankings.

## Frontend

- Lazy-load feature routes.
- Use image/media assets only when licensed and appropriately sized.
- Avoid rendering unbounded table rows.
- Preserve chart data transformations as memoized pure functions.

## Scaling Triggers

Consider additional infrastructure only when a recorded load test or production
metric demonstrates need:

- Redis: repeated query computation remains a bottleneck after indexing and HTTP
  caching.
- Queue/worker: dispatcher regularly exceeds its schedule or needs independent
  concurrency.
- Read replica: read load harms ingestion writes after query optimization.
- Cursor pagination: deep page queries violate API latency targets.

Each change requires an ADR with measured evidence.
