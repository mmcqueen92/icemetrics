# IceMetrics

IceMetrics is a production-style NHL analytics platform built as a TypeScript
monorepo. The repository currently contains the Pass 3 foundation: a NestJS
modular-monolith API/job runner, an Angular standalone web application,
containerized PostgreSQL, a migration-backed Prisma data model, deterministic
development fixtures, health checks, isolated integration tests, and CI.

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
| `npm run openapi:generate`  | Regenerate the checked OpenAPI document     |
| `npm run openapi:check`     | Fail when OpenAPI output has drifted        |

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

Pass 3 includes workspace tooling, strict TypeScript, formatting, linting,
Vitest, environment validation, OpenAPI drift checking, production builds,
PostgreSQL 17 Compose infrastructure, health endpoints, Testcontainers,
GitHub Actions, Dependabot, dependency auditing, secret scanning, the complete
Prisma schema, reviewed SQL migrations, database constraints and indexes,
deterministic seed data, and migration/constraint integration tests.

It deliberately excludes product API endpoints, authentication, ingestion
behavior, analytics calculations, browser end-to-end tests, and deployment
infrastructure.
