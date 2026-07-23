# Prisma Model Guidelines

## Configuration

- The Prisma schema lives at `apps/api/prisma/schema.prisma`.
- Migrations live at `apps/api/prisma/migrations`.
- Prisma CLI configuration lives at `apps/api/prisma.config.ts`.
- The datasource enables the `raw`, `core`, `analytics`, and `ops` schemas.
- Prisma ORM 7 runs in ESM mode with `@prisma/adapter-pg` and `pg`.
- Database URLs are loaded through validated application/Prisma configuration;
  the Prisma schema does not read environment variables directly.
- Generated client code is build output and is not edited manually.

## Model Conventions

- Prisma models and fields use `PascalCase` and `camelCase`.
- Every model and field maps explicitly to `snake_case` database names with
  `@@map` and `@map`.
- Each model declares its PostgreSQL schema with `@@schema`.
- UUID primary keys use `@default(uuid())`.
- Mutable entities include `createdAt @default(now())` and
  `updatedAt @updatedAt`.
- Immutable payloads and snapshots use domain timestamps such as `fetchedAt` or
  `computedAt` instead of misleading update timestamps.
- Relations name both sides and declare explicit `onDelete` and `onUpdate`
  behavior.
- Many-to-many relationships use explicit join models.

## Delete Behavior

- Core hockey records referenced by games or statistics use `Restrict`.
- A parent may cascade only to records that have no meaning without it, such as
  provider identities, refreshable metric snapshots, or import issues belonging
  to a job execution.
- Imported history is never cascade-deleted as a convenience.

## Database Features

Prisma schema syntax does not replace database correctness. Migrations must add
and test constraints Prisma cannot express, including:

- non-negative statistic checks;
- home and away teams must differ;
- valid start/end date ranges;
- exactly one current analytics cutoff where applicable; and
- case-insensitive player search indexes.

Custom SQL in a generated migration is permitted and expected for these
constraints and indexes. It must be described in the pull request.

## Query Rules

- Repositories select only fields required by their DTOs.
- List queries always use bounded pagination and a deterministic UUID
  tie-breaker.
- Raw SQL is allowed only in repositories or analytics query objects, must use
  parameter binding, and requires an integration test.
- Application code must not use `prisma.$executeRawUnsafe`.

## Migration Workflow

1. Update `schema.prisma`.
2. Generate a named development migration.
3. Review generated SQL and add required checks or indexes.
4. Apply it to a fresh test database.
5. Run integration and migration tests.
6. Commit schema and migration together.

Production uses `prisma migrate deploy`. `db push` is prohibited outside
disposable local experiments and must never appear in repository scripts.
