# Release and Deployment Strategy

## Platform

Render is the selected managed platform. All services run in the Oregon region
and are described by the committed root `render.yaml` Blueprint. Supporting
deployment scripts and runbooks live under `infra/render`.

Each long-lived environment contains:

| Component | Render type | Purpose |
| --- | --- | --- |
| `icemetrics-<env>-web` | Static Site | Angular assets and SPA rewrite |
| `icemetrics-<env>-api` | Web Service | NestJS HTTP API |
| `icemetrics-<env>-jobs` | Cron Job | Hourly dispatcher using API build/image |
| `icemetrics-<env>-db` | PostgreSQL | Environment-isolated application data |

There is no long-running worker, Redis instance, or persistent application disk.

Production uses paid PostgreSQL with point-in-time recovery and on-demand
logical exports. Staging may use a lower paid tier but must not use an expiring
database. All components use private database connectivity where available.

## Infrastructure as Code

The Render Blueprint defines:

- service type and region;
- build/start commands;
- health-check path;
- cron schedule;
- safe environment variables and secret references;
- database linkage; and
- SPA rewrite rules.

Secrets and plan sizes are not committed. Manual platform changes must be
backported to the Blueprint or reverted.

## Build and Runtime

- API and job runner use the same multi-stage, non-root production Docker image.
- API binds to `0.0.0.0:$PORT`.
- Static web build receives only public configuration.
- Job command runs once and exits.
- Runtime filesystems are treated as ephemeral.

## Environments and Promotion

- Pull requests run CI and may use static preview builds; they do not receive a
  database by default.
- Merge to `main` auto-deploys staging after CI.
- Staging deploy applies migrations, deploys API/web/jobs, and runs smoke tests.
- Production deployment is a manual GitHub environment promotion of the exact
  commit verified in staging.
- Production is protected and requires explicit approval.
- Auto-deploy directly from `main` to production is disabled.

## Migration Sequence

1. CI applies migrations to a fresh PostgreSQL database.
2. Staging applies `prisma migrate deploy`.
3. Staging API and smoke tests verify compatibility.
4. Production pre-deploy applies the same migration set once.
5. API and cron deploy from the same release.

Use expand-and-contract migrations for incompatible changes. Applied production
migrations are never edited or rolled back with `migrate reset`; recovery is a
forward migration or database restore.

## Versioning

- Use semantic versioning.
- Pre-1.0 releases may evolve quickly but still document breaking API changes.
- `1.0.0` is the first stable MVP satisfying `docs/34-mvp-feature-specification.md`.
- Git tag format: `vMAJOR.MINOR.PATCH`.
- Build metadata records tag and Git SHA.

## Release Gate

Before production:

- all CI suites pass;
- OpenAPI and generated client have no drift;
- migrations are reviewed and tested on staging;
- data backup/recovery status is healthy;
- staging smoke tests pass;
- security and dependency scans have no unresolved critical findings;
- documentation and changelog are current; and
- rollback/forward-fix notes identify database implications.

## Smoke Tests

After deployment verify:

- liveness and readiness;
- Angular application load and API connectivity;
- one players query and player detail;
- one teams/standings query;
- one games query;
- one analytics ranking query; and
- job runner can query due jobs without executing a duplicate.

## Recovery

- Application regression: redeploy the previous compatible image.
- Migration-compatible defect: redeploy code, then issue a forward fix.
- Data corruption: stop jobs, restore paid PostgreSQL to a new instance using
  point-in-time recovery, validate it, and repoint services.
- Provider incident: stop or skip imports while continuing to serve stored data.

A production restore is considered incomplete until API, analytics, and job
freshness checks pass.
