# GitHub Backlog Structure

The backlog mirrors the sequential passes in
`docs/18-implementation-phases.md`. Create one milestone per pass and do not
schedule a later milestone until its required predecessor is accepted.

## Issue Template Requirements

Every implementation issue includes:

- user/engineering outcome;
- in-scope and out-of-scope behavior;
- authoritative document links;
- test expectations;
- objective acceptance criteria;
- migration/OpenAPI/documentation impact; and
- dependencies on earlier issues.

Architecture choices are not delegated to issue implementers. If a new choice
is discovered, resolve it in documentation/ADR before continuing the issue.

## Milestones

### Pass 1: Workspace Foundation

Workspace/tool versions, NestJS, Angular, strict configuration, root commands,
README, environment example.

### Pass 2: Infrastructure and CI

Docker PostgreSQL, health checks, test database, CI, dependency and secret
automation.

### Pass 3: Database

Prisma schema, initial migration, constraints/indexes, deterministic seed,
migration tests.

### Pass 4: Backend Platform

Configuration, logging, errors, validation, pagination, OpenAPI/client
generation, ETag/rate limiting, health integration.

### Pass 5: Core API

League/season, team/roster, player/search/stats, game/box-score read endpoints.

### Pass 6: Ingestion Framework

Provider adapter, fixtures, raw storage, jobs, locks, retries, replay.

### Pass 7: Reference Imports

League, season, team, player, and roster transformations/jobs.

### Pass 8: Game Data

Schedule, game statistics, standings, corrections, freshness checks.

### Pass 9: Analytics

Metric functions, snapshots, recalculation, trends, comparisons, rankings.

### Pass 10: Angular Foundation

Shell, generated client, shared UI, routing, state/error/accessibility baseline.

### Pass 11: Explorers

Dashboard, team, player, and game flows.

### Pass 12: Analytics UI

Comparison, charts/tables, team ranking and trends.

### Pass 13: Production

Render Blueprint, environments, image, deployment, monitoring, recovery,
runbooks.

### Pass 14: MVP 1.0

Full acceptance, hardening, onboarding validation, and stable release.

## Labels

Use consistent labels:

```text
area:api
area:web
area:data
area:analytics
area:database
area:infra
area:docs
type:feature
type:bug
type:chore
type:decision
blocked
```

Priority reflects user/data/operational risk, not implementation convenience.
