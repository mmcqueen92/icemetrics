# IceMetrics Project Overview

IceMetrics is a production-style NHL analytics platform that demonstrates
backend engineering, data engineering, analytics, frontend engineering, and
managed cloud deployment.

## Product Goal

The MVP provides four public, read-only experiences:

- a team explorer with rosters, standings, and recent performance;
- a player explorer with search, profiles, and game-by-game statistics;
- a game explorer with schedules, results, and box scores; and
- an analytics dashboard with trends, comparisons, and team rankings.

The first stable release targets the NHL only. Provider boundaries and league
keys must remain explicit, but the implementation must not introduce generic
multi-sport abstractions until a second sport is approved.

## Architecture

IceMetrics is a TypeScript monorepo containing:

- an Angular 22 single-page application;
- a NestJS 11 modular-monolith API and job runner;
- Prisma ORM backed by PostgreSQL 17;
- Docker Compose for local PostgreSQL;
- GitHub Actions for continuous integration; and
- Render for the hosted web application, API, scheduled jobs, and PostgreSQL.

The API, scheduled jobs, and analytics engine are separate entry points into
the same backend codebase. They are not separate services or independently
versioned products.

## Repository Layout

```text
apps/
  api/
    prisma/
    src/
    test/
  web/
    src/
    e2e/
docs/
infra/
  render/
scripts/
.github/
  workflows/
render.yaml
```

Rules:

- `apps/api` owns backend domain logic, Prisma schema and migrations, OpenAPI
  generation, ingestion, and analytics.
- `apps/web` owns the browser application and its generated API client.
- Root `render.yaml` is the Render Blueprint entry point. `infra/render` owns
  supporting deployment scripts and runbooks.
- `scripts` contains repository-level automation only. Business logic must not
  be implemented in scripts.
- A `packages` directory must not be created until two real consumers need the
  same framework-independent code.
- Database models and NestJS DTO classes must never be imported by the Angular
  application. The checked OpenAPI document is the cross-application contract.

## Supported Toolchain

- Node.js `24.18.x` LTS. `package.json` must enforce `>=24.18.0 <25`.
- npm `11.16.x`, with the repository's exact version declared in the root
  `packageManager` field.
- TypeScript `6.0.x`.
- Prisma ORM `7.x` using ESM and the PostgreSQL driver adapter.
- npm workspaces, with one root `package-lock.json`.
- TypeScript strict mode in both applications.

Commit `.nvmrc` with `24.18.0`, declare Node/npm ranges in root `engines`, set
`engine-strict=true` in the committed `.npmrc`, and declare the exact npm patch
in `packageManager`. CI uses the `.nvmrc` version.

Dependency patch and minor versions are locked by `package-lock.json`. Major
framework upgrades require an explicit maintenance change and passing the full
test suite.

## Selected Implementation Libraries

- NestJS uses its Express platform adapter.
- HTTP DTO validation uses `class-validator` and `class-transformer`.
- OpenAPI uses `@nestjs/swagger`.
- Provider-response validation uses Zod inside the adapter boundary.
- Prisma uses `@prisma/adapter-pg` with `pg`; Prisma Accelerate is not used.
- Structured logging uses Pino through `nestjs-pino`.
- Public throttling uses `@nestjs/throttler`.
- OpenAPI Generator's `typescript-angular` generator creates the web API client;
  generation runs from a version-pinned container so host Java is not required.
- Repository formatting/linting uses Prettier and ESLint flat configuration.
- The root development command uses `concurrently`.
- Frontend component primitives use Angular Material/CDK and charts use Apache
  ECharts.
- Test libraries are fixed in `docs/08-testing-strategy.md`.

Equivalent substitutes require a documented decision before they are added.

## Naming Conventions

- TypeScript files and directories: `kebab-case`.
- Classes, interfaces, types, enums, Angular components, and NestJS providers:
  `PascalCase`.
- Variables, functions, methods, and JSON fields: `camelCase`.
- Constants and environment variables: `UPPER_SNAKE_CASE`.
- PostgreSQL objects: `snake_case`, mapped explicitly from Prisma names.
- REST resources: plural kebab-case nouns.
- UUIDs are exposed as opaque strings and are never given resource-specific
  prefixes.

## Non-Goals for the MVP

- Multiple sports or multiple live data providers.
- Microservices, message brokers, Redis, read replicas, or event sourcing.
- User accounts, saved dashboards, OAuth, or role-based permissions.
- Predictive machine learning or the AI assistant.
- Administrative ingestion endpoints over HTTP.

These may be reconsidered only after the MVP is operating and a documented need
justifies the additional complexity.
