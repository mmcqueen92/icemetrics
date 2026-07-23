# IceMetrics

IceMetrics is a production-style NHL analytics platform built as a TypeScript
monorepo. The repository currently contains the Pass 1 workspace foundation:
a NestJS modular-monolith API/job-runner scaffold and an Angular standalone
web application.

The project documentation in [`docs/`](docs/) is the source of truth. Read
[`AGENTS.md`](AGENTS.md) before making implementation or architecture changes.

## Required Toolchain

- Node.js 24.18.0
- npm 11.16.x
- Git

The repository enforces Node `>=24.18.0 <25` and npm `>=11.16.0 <12`.

## Setup

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

The current Pass 1 application does not connect to PostgreSQL. Docker Compose,
database readiness, and integration infrastructure are delivered in Pass 2.

Local development URLs:

- Web application: `http://localhost:4200`
- API base: `http://localhost:3000/api/v1`
- OpenAPI UI: `http://localhost:3000/docs`

The Pass 1 API intentionally has no product endpoints. Health endpoints begin
in Pass 2 and hockey resources begin in Pass 5.

## Verification

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run openapi:check
npm run build
```

Run `npm run verify` to execute the same Pass 1 gate in sequence.

## Root Commands

| Command                    | Purpose                                   |
| -------------------------- | ----------------------------------------- |
| `npm run dev`              | Run API and web development servers       |
| `npm run dev:api`          | Run the NestJS API watcher                |
| `npm run dev:web`          | Run the Angular development server        |
| `npm run build`            | Build all implemented workspaces          |
| `npm run lint`             | Lint all implemented workspaces           |
| `npm run typecheck`        | Type-check all implemented workspaces     |
| `npm run test:unit`        | Run unit and component tests              |
| `npm run format`           | Format tracked source/configuration files |
| `npm run format:check`     | Verify formatting                         |
| `npm run openapi:generate` | Regenerate the checked OpenAPI document   |
| `npm run openapi:check`    | Fail when OpenAPI output has drifted      |

Commands belonging to later passes are reserved in `package.json` and fail with
a message naming the pass that implements them. They must not report false
success before their infrastructure exists.

## Repository Layout

```text
apps/
  api/    NestJS API and job-runner entry points
  web/    Angular standalone application
docs/     Product and engineering source of truth
scripts/  Repository-level automation
```

## Current Scope

Pass 1 includes workspace/tooling configuration, strict TypeScript, formatting,
linting, Vitest, environment validation, OpenAPI drift checking, production
builds, and verified setup documentation.

It deliberately excludes PostgreSQL/Docker, CI, domain models, hockey features,
authentication, ingestion, analytics, and deployment infrastructure.
