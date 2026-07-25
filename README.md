# IceMetrics

IceMetrics is a production-style NHL analytics platform built as a TypeScript
monorepo. Through Pass 13 it contains a NestJS modular-monolith API/job runner,
an Angular standalone analytics application, PostgreSQL/Prisma data and
analytics pipelines, generated API artifacts, deterministic test suites, and
production deployment/operations infrastructure for Render.

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

The API exposes public, read-only leagues, seasons, teams, rosters, players,
games, game statistics, and standings endpoints under `/api/v1`.

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

| Command                        | Purpose                                     |
| ------------------------------ | ------------------------------------------- |
| `npm run dev`                  | Run API and web development servers         |
| `npm run dev:api`              | Run the NestJS API watcher                  |
| `npm run dev:web`              | Run the Angular development server          |
| `npm run build`                | Build all implemented workspaces            |
| `npm run lint`                 | Lint all implemented workspaces             |
| `npm run typecheck`            | Type-check all implemented workspaces       |
| `npm run test:unit`            | Run unit and component tests                |
| `npm run test:integration`     | Run isolated PostgreSQL/API tests           |
| `npm run db:generate`          | Generate the Prisma client                  |
| `npm run db:migrate`           | Create/apply a development migration        |
| `npm run db:migrate:deploy`    | Apply committed migrations                  |
| `npm run db:seed`              | Apply deterministic development fixtures    |
| `npm run db:reset`             | Confirm and reset a local development DB    |
| `npm run docker:up`            | Start and wait for local PostgreSQL         |
| `npm run docker:down`          | Stop PostgreSQL without deleting its data   |
| `npm run security:audit`       | Fail on critical dependency vulnerabilities |
| `npm run format`               | Format tracked source/configuration files   |
| `npm run format:check`         | Verify formatting                           |
| `npm run jobs:dispatch`        | Dispatch currently due logical jobs         |
| `npm run jobs:health`          | Check active-season pipeline freshness      |
| `npm run jobs:run`             | Run one validated manual logical job        |
| `npm run jobs:replay`          | Replay one preserved raw payload            |
| `npm run openapi:generate`     | Regenerate OpenAPI and the Angular client   |
| `npm run openapi:check`        | Fail when either generated artifact drifts  |
| `npm run deployment:check`     | Validate Render/deployment invariants       |
| `npm run smoke:deployment`     | Smoke-test an exact hosted release          |
| `npm run ops:rehearse-restore` | Exercise an isolated database restore       |

## Repository Layout

```text
apps/
  api/    NestJS API and job-runner entry points
  web/    Angular standalone application
docs/     Product and engineering source of truth
infra/    Render operations guidance and incident runbooks
scripts/  Repository-level automation
render.yaml       Staging/production Render Blueprint
Dockerfile.api    Shared non-root API/job production image
```

## Current Scope

The MVP implementation now includes core NHL explorers, rolling player/team
analytics, comparison and ranking views, accessible chart alternatives,
fixture-backed ingestion with correction history, hourly dispatch/freshness
checks, and isolated staging/production deployment definitions.

Pass 13 is deployment-ready but not account-provisioned by repository code.
Before launch, complete the hosted evidence gates in
[`infra/render/README.md`](infra/render/README.md), including paid PostgreSQL
PITR, environment protection, alerts, Sentry delivery, staging smoke evidence,
and a hosted restore exercise.
