# Local Development Guide

## Required Tools

- Git
- Node.js 24.18.x LTS
- npm 11.16.x
- Docker Desktop or another Docker Engine with Compose v2

A separately installed PostgreSQL server is not required.

## Bootstrap

```text
npm ci
npm run docker:up
npm run db:migrate
npm run db:seed
npm run dev
```

`npm run dev` runs API and Angular development servers concurrently and stops
both when the command exits.

Before the first local browser-suite run, install its pinned Chromium runtime:

```text
npx playwright install chromium
npm run test:e2e
```

The browser command builds and tests production web assets. CI installs the
browser and its operating-system dependencies automatically.

`db:migrate` is the development migration command. Clean environments and
deployments may use `db:migrate:deploy` when they only need to apply committed
migrations. Prisma CLI commands load the root `.env`; production still requires
an explicitly supplied `DATABASE_URL`.

## Root Command Contract

The root `package.json` must provide:

| Command | Behavior |
| --- | --- |
| `npm run dev` | API and web watchers |
| `npm run dev:api` | NestJS watcher |
| `npm run dev:web` | Angular development server |
| `npm run build` | Production builds for all workspaces |
| `npm run lint` | All lint checks |
| `npm run typecheck` | TypeScript checks without emit |
| `npm test` | Unit/component tests |
| `npm run test:unit` | Unit and component tests |
| `npm run test:integration` | PostgreSQL and API integration tests |
| `npm run test:e2e` | Production web build and Playwright tests |
| `npm run format` | Write formatting changes |
| `npm run format:check` | Verify formatting |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Create/apply development migration |
| `npm run db:migrate:deploy` | Apply committed migrations |
| `npm run db:seed` | Deterministic development seed |
| `npm run db:reset` | Destructive local-only reset with confirmation |
| `npm run openapi:generate` | Generate OpenAPI and web client |
| `npm run openapi:check` | Fail on generated contract/client drift |
| `npm run jobs:dispatch` | Run due logical jobs once |
| `npm run jobs:run` | Run one explicitly selected job |
| `npm run jobs:replay` | Replay a stored raw payload |
| `npm run docker:up` | Start local dependencies |
| `npm run docker:down` | Stop local dependencies without deleting volumes |
| `npm run security:audit` | Report vulnerabilities and fail on critical severity |

Workspace package names are `@icemetrics/api` and `@icemetrics/web`.

Implemented job-runner examples:

```text
npm run jobs:dispatch
npm run jobs:run -- --job schedule --date 2026-01-15 --dry-run
npm run jobs:replay -- --payload-id <uuid>
```

The runner validates UUIDs, real dates, paired inclusive date ranges of at most
366 days, known job types, and safe fixture names before creating work.
Pass 8 provides operational Teams, Players, Schedule, Game Statistics, and
Standings transformations. Schedule and standings commands accept `--date`;
Schedule additionally accepts a paired date range or `--season-id`, and Game
Statistics accepts an internal `--game-id`. Analytics remains explicitly
skipped until Pass 9 rather than reporting false import success.

The OpenAPI commands generate and verify both the API document and the Angular
client. Client generation runs OpenAPI Generator 7.22.0 from the immutable
container image pinned in `scripts/generate-openapi-client.mjs`, so Docker must
be running. The generated client includes the Pass 5 leagues, seasons, teams,
rosters, players, games, game-statistics, and standings operations.

## Local URLs

- Angular: `http://localhost:4200`
- API: `http://localhost:3000/api/v1`
- OpenAPI UI: `http://localhost:3000/docs`
- Liveness: `http://localhost:3000/health/live`
- Readiness: `http://localhost:3000/health/ready`
- PostgreSQL: `localhost:5433` (container port `5432`)

## Safety

- `db:reset` refuses to run unless `NODE_ENV=development` and the database host
  is local, and requires the developer to type `RESET`.
- `db:seed` refuses to run when either `NODE_ENV` or `APP_ENV` is production.
- Docker volume removal is never part of `docker:down`.
- Integration suites create disposable PostgreSQL 17 containers with unique
  credentials and do not use the persistent Compose database.
- Live-provider imports are opt-in; normal tests use fixtures.
- Never point local scripts at staging or production URLs.
