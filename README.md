# IceMetrics

IceMetrics is a production-style NHL analytics platform built as a TypeScript
monorepo. The repository currently contains the Pass 4 foundation: a NestJS
modular-monolith API/job runner, an Angular standalone web application,
containerized PostgreSQL, a migration-backed Prisma data model, a
production-style HTTP platform, generated API artifacts, isolated integration
tests, and CI.

The project documentation in [`docs/`](docs/) is the source of truth. Read
[`AGENTS.md`](AGENTS.md) before making implementation or architecture changes.

## Required Toolchain

- Node.js 24.18.0
- npm 11.16.x
- Git
- Docker Desktop or another Docker Engine with Compose v2

The repository enforces Node `>=24.18.0 <25` and npm `>=11.16.0 <12`.

## Setup

```powershell
Copy-Item .env.example .env
npm ci
npm run docker:up
npm run db:migrate
npm run db:seed
npm run dev
```

PostgreSQL runs in Docker and is published only to
`127.0.0.1:5433`. The container itself uses the standard PostgreSQL port
`5432`. A separate PostgreSQL installation is not required.

Local development URLs:

- Web application: `http://localhost:4200`
- API base: `http://localhost:3000/api/v1`
- OpenAPI UI: `http://localhost:3000/docs`
- Liveness: `http://localhost:3000/health/live`
- Readiness: `http://localhost:3000/health/ready`

The API intentionally has no product endpoints yet. Hockey resources begin in
Pass 5.

## Verification

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run openapi:check
npm run build
```

Run `npm run verify` for the deterministic fast gate. Integration tests run
separately because they require Docker and create a unique disposable
PostgreSQL 17 container for each suite.

## Root Commands

| Command                     | Purpose                                     |
| --------------------------- | ------------------------------------------- |
| `npm run dev`               | Run API and web development servers         |
| `npm run dev:api`           | Run the NestJS API watcher                  |
| `npm run dev:web`           | Run the Angular development server          |
| `npm run build`             | Build all implemented workspaces            |
| `npm run lint`              | Lint all implemented workspaces             |
| `npm run typecheck`         | Type-check all implemented workspaces       |
| `npm run test:unit`         | Run unit and component tests                |
| `npm run test:integration`  | Run isolated PostgreSQL/API tests           |
| `npm run db:generate`       | Generate the Prisma client                  |
| `npm run db:migrate`        | Create/apply a development migration        |
| `npm run db:migrate:deploy` | Apply committed migrations                  |
| `npm run db:seed`           | Apply deterministic development fixtures    |
| `npm run db:reset`          | Confirm and reset a local development DB    |
| `npm run docker:up`         | Start and wait for local PostgreSQL         |
| `npm run docker:down`       | Stop PostgreSQL without deleting its data   |
| `npm run security:audit`    | Fail on critical dependency vulnerabilities |
| `npm run format`            | Format tracked source/configuration files   |
| `npm run format:check`      | Verify formatting                           |
| `npm run openapi:generate`  | Regenerate OpenAPI and the Angular client   |
| `npm run openapi:check`     | Fail when either generated artifact drifts  |

Other commands belonging to later passes remain reserved in `package.json` and
fail with a message naming the pass that implements them. They must not report
false success before their infrastructure exists.

## Repository Layout

```text
apps/
  api/    NestJS API and job-runner entry points
  web/    Angular standalone application
docs/     Product and engineering source of truth
scripts/  Repository-level automation
```

## Current Scope

Pass 4 includes the validated environment contract, Prisma client lifecycle,
database-backed readiness, structured JSON logging and request correlation,
strict validation, consistent success and error envelopes, pagination,
rate-limiting, cache and ETag behavior, security headers, OpenAPI 3.1 generation,
an immutable-generator Angular client, and platform integration tests.

It deliberately excludes hockey product endpoints, authentication, ingestion
behavior, analytics calculations, browser end-to-end tests, and deployment
infrastructure. Core read endpoints begin in Pass 5.
