# First Implementation Sprint

## Goal

Complete Passes 1 and 2 from `docs/18-implementation-phases.md`: a reproducible
workspace foundation with local PostgreSQL and enforced CI.

## Ordered Work

1. Create the root npm workspace and enforce Node/npm versions.
2. Scaffold `@icemetrics/api` with NestJS 11.
3. Scaffold `@icemetrics/web` with Angular 22 and standalone routing.
4. Enable strict TypeScript, formatting, linting, and Vitest.
5. Implement the root command contract.
6. Add `.env.example` and startup configuration validation.
7. Add PostgreSQL 17 Docker Compose with health check and persistent volume.
8. Add liveness/readiness endpoints.
9. Add Testcontainers integration harness.
10. Add GitHub Actions checks, caching, dependency updates, and secret scanning.
11. Replace the empty README with verified setup and command instructions.

Do not implement hockey features, Prisma domain models, authentication, or live
provider calls in this sprint.

## Definition of Done

- A clean clone succeeds with the documented bootstrap.
- `npm ci` is deterministic and uses one lockfile.
- Root format, lint, typecheck, unit, integration, OpenAPI check, and build
  commands exist and pass for the scaffold.
- PostgreSQL starts/stops without deleting its volume.
- Readiness accurately reflects database availability.
- Pull-request CI enforces the same commands.
- Documentation matches the commands actually delivered.
