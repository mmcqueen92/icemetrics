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
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm run dev
```

`npm run dev` runs API and Angular development servers concurrently and stops
both when the command exits.

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
| `npm run test:e2e` | Playwright tests |
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

Workspace package names are `@icemetrics/api` and `@icemetrics/web`.

During Pass 1, the OpenAPI commands generate and verify the endpoint-free API
scaffold document. Pass 4 activates Angular client generation and extends the
same drift check to that generated client when the first product contract is
introduced.

## Local URLs

- Angular: `http://localhost:4200`
- API: `http://localhost:3000/api/v1`
- OpenAPI UI: `http://localhost:3000/docs`
- Liveness: `http://localhost:3000/health/live`
- Readiness: `http://localhost:3000/health/ready`
- PostgreSQL: `localhost:5432`

## Safety

- `db:reset` refuses to run unless `NODE_ENV=development` and the database host
  is local.
- Docker volume removal is never part of `docker:down`.
- Live-provider imports are opt-in; normal tests use fixtures.
- Never point local scripts at staging or production URLs.
