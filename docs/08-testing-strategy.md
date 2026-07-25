# Testing Strategy

## Tooling

| Level | Tool | Purpose |
| --- | --- | --- |
| Unit | Vitest | Pure functions, services, validators, metric formulas |
| Angular component | Angular test utilities + Vitest | Rendering and interaction |
| API integration | Supertest + Vitest | Real NestJS request pipeline |
| Persistence/integration | Testcontainers PostgreSQL 17 | Prisma, migrations, constraints, repositories |
| Browser end-to-end | Playwright | Critical public user flows |

Do not use SQLite as a PostgreSQL substitute. Do not mock Prisma in repository
or API integration tests.

## Test Boundaries

- Unit tests mock only owned ports, such as repositories or provider interfaces.
- Provider adapter tests use committed JSON fixtures and a controlled fake HTTP
  server; CI never depends on live NHL endpoints.
- Integration tests migrate a fresh PostgreSQL database.
- Database foundation tests apply the committed migration, run the deterministic
  seed twice, and exercise uniqueness, check, and cross-table integrity
  constraints against PostgreSQL 17.
- End-to-end tests use deterministic seeded data and built applications.
- External Render smoke tests are a separate deployment check, not part of the
  deterministic unit suite.

## Required Coverage by Change

- Endpoint: validation, success, empty collection, not found, envelope, and
  documented filtering/sorting.
- Repository: real query, ordering, pagination, and relevant constraints.
- ETL job: success, repeated idempotent run, malformed payload, retryable
  failure, partial failure, and correction.
- Metric: hand-calculated result, zero denominator, partial window, tie-break,
  and recalculation.
- Angular feature: loading, success, empty, and error states plus primary
  interaction.
- Production bug: failing regression test before or with the fix.

## CI Suites

Fast checks on every pull request:

```text
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run openapi:check
npm run build
```

Integration checks on every pull request after fast checks:

```text
npm run test:integration
```

`npm run test:e2e` is a pull-request gate. It builds the production web
application, serves those static assets from a process owned by Playwright, and
runs the Chromium suite. The Pass 10 baseline covers keyboard navigation,
client-side lazy routing, the in-app not-found path, and the 320 CSS pixel
layout.

Each integration test file creates its own PostgreSQL 17 Testcontainers instance
with a unique database name and credentials; suites never use the local Compose
database or share state.

`main` and release candidates run the complete suite. Tests may be parallelized
by suite but must not share a database.

## Quality Policy

Use coverage reports to identify untested behavior, not as a substitute for
test design. Initial repository thresholds are 80% statements, branches,
functions, and lines for backend domain/analytics code. Generated files,
bootstrap files, DTO annotations, migrations, and framework registration classes
whose behavior is exercised by integration tests are excluded with documented
configuration.

## HTTP Platform Test Boundary

The shared HTTP platform is tested as a running Nest application. Integration
tests cover response and error envelopes, strict request validation, pagination
metadata, request correlation, safe structured logs, security and CORS headers,
rate-limit behavior, cache policy, conditional ETag requests, and health
endpoint exceptions. Unit tests remain focused on deterministic helpers and
service behavior rather than duplicating framework wiring assertions.

Flaky tests are defects. Do not add retries to hide nondeterminism. Quarantine
requires an issue, owner, and removal date.
