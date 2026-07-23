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
npm run test:e2e
```

`main` and release candidates run the complete suite. Tests may be parallelized
by suite but must not share a database.

## Quality Policy

Use coverage reports to identify untested behavior, not as a substitute for
test design. Initial repository thresholds are 80% statements, branches,
functions, and lines for backend domain/analytics code. Generated files,
bootstrap files, DTO annotations, and migrations are excluded with documented
configuration.

Flaky tests are defects. Do not add retries to hide nondeterminism. Quarantine
requires an issue, owner, and removal date.
