# Sequential Implementation Passes

Passes execute in order. A pass is complete only when its acceptance criteria
are met, required tests pass, and documentation matches implementation. Do not
begin a dependent pass on an unstable foundation.

## Pass 0: Implementation Specification

Deliver:

- version-controlled context and aligned `AGENTS.md`;
- fixed repository/toolchain/command conventions;
- accepted provider, analytics, authentication-scope, and deployment decisions;
- complete API and persistence contracts; and
- executable roadmap acceptance criteria.

Acceptance:

- every path referenced by `AGENTS.md` exists;
- no context document contradicts the accepted ADRs;
- every MVP endpoint, model group, metric formula, job, and deployment component
  has an owner and contract;
- unresolved choices are explicitly marked future/non-goal rather than left
  implicit; and
- context passes the documentation consistency audit and is committed.

## Pass 1: Workspace Foundation

Deliver the npm workspace, NestJS and Angular applications, strict TypeScript,
formatting, linting, test runners, root commands, `.env.example`, and README.

Acceptance:

- Node/npm version enforcement rejects unsupported majors;
- `npm ci`, format check, lint, typecheck, unit tests, and production builds pass
  from a clean clone;
- both applications start from documented root commands; and
- no placeholder feature logic or unapproved packages are introduced.

## Pass 2: Local Infrastructure and CI

Deliver Docker Compose PostgreSQL 17, test database isolation, GitHub Actions,
health endpoints, and dependency/security automation.

Acceptance:

- one documented command starts local dependencies;
- readiness fails when PostgreSQL is unavailable and recovers when available;
- CI runs every required check on a pull request;
- integration suites receive isolated PostgreSQL; and
- no secrets are committed.

## Pass 3: Database Foundation

Deliver the full Prisma schema, reviewed initial migration, constraints,
indexes, deterministic seed, and migration tests.

Acceptance:

- a fresh PostgreSQL 17 database migrates and seeds automatically;
- raw/core/analytics/ops separation exists;
- all negative/duplicate/integrity cases in the schema specification are
  rejected; and
- migration and seed behavior is tested in CI.

## Pass 4: Backend Platform

Deliver validated configuration, database integration, structured logging,
request IDs, validation, error envelopes, pagination primitives, OpenAPI
generation, rate limiting, caching headers, and health behavior.

Acceptance:

- API integration tests prove the common success/error contracts;
- logs contain correlation and no forbidden values;
- OpenAPI/client drift checking works; and
- health, validation, rate limiting, and ETag behavior are tested.

## Pass 5: Core Read API

Implement leagues, seasons, teams, rosters, players/search, games, and
game-statistics endpoints against seeded data.

Acceptance:

- every endpoint in the core sections of the API specification exists;
- filters, sorting, pagination, empty, validation, and not-found behavior pass
  integration tests;
- controllers contain no persistence/business logic; and
- representative queries meet indexes and performance budgets.

## Pass 6: Provider and Ingestion Framework

Deliver the provider interface, NHL adapter, runtime schemas, HTTP policy, raw
storage, job records, advisory locks, replay, and dispatcher framework.

Acceptance:

- every endpoint family has sanitized fixtures;
- raw payload is stored before transformation;
- retry, timeout, concurrency, rejection, replay, and lock behavior is tested;
- identical runs do not duplicate raw/core data; and
- CI does not call the live provider.

## Pass 7: Reference Imports

Implement league/season/team and player/roster imports.

Acceptance:

- provider identities are stable and foreign-keyed;
- repeated imports are idempotent;
- missing records follow three-snapshot inactivation rules;
- valid siblings survive a partitionable invalid entity; and
- job counts/issues reconcile with fixture contents.

## Pass 8: Games, Statistics, and Standings

Implement schedule, box-score, correction, and official standings imports plus
hourly dispatch policy.

Acceptance:

- scheduled/live/final/postponed/cancelled transitions are covered;
- final games have consistent team/player statistics;
- duplicate schedule discovery produces one game;
- corrected box scores update core data while preserving both payloads; and
- freshness/data-quality alerts have queryable signals.

## Pass 9: Analytics Engine

Implement all catalogued formulas, hybrid persistence, recalculation, trends,
comparisons, standings, and rankings endpoints.

Acceptance:

- every formula has hand-calculated regression fixtures;
- zero/partial-window/tie/correction behavior passes;
- snapshots include version, sample, cutoff, and compute time;
- comparison and ranking endpoints match their contracts; and
- no analytics calculation consumes raw provider DTOs.

## Pass 10: Angular Foundation

Deliver application shell, routing, generated API client, design tokens, shared
states/components, error handling, and accessibility baseline.

Acceptance:

- feature routes lazy-load;
- generated client drift is enforced;
- loading/empty/error/not-found primitives are keyboard accessible;
- component and accessibility checks pass; and
- production bundle meets its budget.

## Pass 11: Explorer Features

Implement dashboard, team, player, and game explorer/detail flows.

Acceptance:

- route/query state is shareable and survives reload;
- all specified loading/empty/error/success states work;
- API data drives every production view;
- primary Playwright flows pass; and
- pages meet responsive and accessibility requirements.

## Pass 12: Analytics Dashboard

Implement player comparison, rolling trends, team rankings, formula
explanations, and equivalent chart tables.

Acceptance:

- 2-5 player comparison validates and round-trips through URL state;
- displayed metric values, samples, and cutoffs match API fixtures;
- charts are lazy-loaded and have accessible table alternatives; and
- analytics end-to-end and performance tests pass.

## Pass 13: Production Deployment

Deliver Render Blueprint, staging/production environments, production image,
migration/promotion workflow, monitoring, Sentry, alerts, backups, smoke tests,
and runbooks.

Acceptance:

- the same commit promotes from passing staging to protected production;
- paid PostgreSQL recovery capability is verified;
- migrations run once before compatible services;
- smoke tests and job freshness checks pass; and
- rollback, forward-fix, provider-outage, and database-restore procedures are
  documented and rehearsed where safe.

## Pass 14: Stable MVP Release

Perform full acceptance, documentation reconciliation, performance/security
review, and release `1.0.0`.

Acceptance:

- all feature criteria in `docs/34-mvp-feature-specification.md` pass;
- no critical security finding or unresolved data-integrity defect remains;
- 30-day operational objectives have either been met or explicitly reviewed;
- README/onboarding/runbooks are verified by a clean setup; and
- the release checklist and semantic tag are complete.

## Post-MVP: Authentication and AI

Authentication begins only with user-owned functionality. The AI assistant
begins only after stable analytics APIs exist. Each requires a separately
approved specification and is not a hidden requirement for any MVP pass.
