# Engineering Decisions

This document is the concise decision index. Detailed rationale is recorded in
`docs/20-architecture-decisions.md`; domain contracts live in their respective
specifications.

## Application Architecture

- Use an npm-workspace TypeScript monorepo.
- Keep the backend as a NestJS modular monolith.
- Run HTTP requests and scheduled jobs from separate entry points in the same
  deployable backend codebase.
- Use Angular for a client-rendered single-page application.
- Do not introduce microservices, a message broker, or a distributed cache for
  the MVP.

## Persistence

- Use PostgreSQL 17 and Prisma ORM 7 with the PostgreSQL driver adapter.
- Separate data physically into `raw`, `core`, `analytics`, and `ops`
  PostgreSQL schemas.
- Preserve provider payloads before transformation.
- Use explicit provider-identity tables instead of placing NHL identifiers on
  core entities.
- Apply every schema change through a reviewed Prisma migration.

## External Data

- Use the NHL-owned `api-web.nhle.com` and `api.nhle.com` endpoints as the
  initial `nhl` provider.
- Treat those endpoints as an undocumented, no-SLA dependency.
- Isolate all upstream shapes in one adapter and validate every response before
  it reaches core logic.
- Do not add a second provider until measured reliability or coverage problems
  justify it.

## API

- Expose a REST API under `/api/v1`, documented with OpenAPI.
- Use page-number pagination for the MVP.
- Return camelCase DTOs in a consistent envelope.
- Keep all MVP product endpoints public and read-only.
- Do not expose job execution or data mutation over HTTP.

## Analytics

- Calculate simple season aggregates on demand from normalized statistics.
- Materialize rolling trends, standings snapshots, and rankings after completed
  game imports.
- Version formulas and retain the calculation timestamp and sample size.
- Do not add Redis or a separate analytics database for the MVP.

## Authentication

User authentication is deferred until the product has a user-specific feature.
The MVP has no user table, registration endpoint, login endpoint, or
`JWT_SECRET`. A JWT-based design is retained as the approved future direction
in `docs/26-authentication-design.md`, but it must not be implemented speculatively.

## Deployment

- Use Render in its Oregon region.
- Deploy Angular as a Render Static Site.
- Deploy NestJS as a Render Web Service.
- Execute ingestion through a single hourly Render Cron Job using the API
  image and a job-runner command.
- Use paid Render PostgreSQL for production so point-in-time recovery is
  available.
- Describe infrastructure in a committed Render Blueprint.

## Quality

- Use Vitest for unit and component tests, Supertest for API integration tests,
  Testcontainers for PostgreSQL integration tests, and Playwright for browser
  end-to-end tests.
- CI must run formatting checks, linting, type checking, tests, OpenAPI drift
  checks, and production builds.
- Documentation and migrations are implementation artifacts and are reviewed
  with code.
