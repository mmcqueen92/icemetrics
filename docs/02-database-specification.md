# Database Specification

## Database and Ownership

IceMetrics uses PostgreSQL 17 through Prisma. The API and job runner use the
same schema and migration history. Application code must not create or alter
tables at runtime.

The database is divided into four PostgreSQL schemas:

| Schema | Purpose | Write owner |
| --- | --- | --- |
| `raw` | Immutable upstream responses and fetch metadata | ingestion |
| `core` | Canonical hockey entities and normalized game statistics | ingestion |
| `analytics` | Materialized standings, rolling metrics, trends, and rankings | analytics |
| `ops` | Job executions and import issues | job runner |

Prisma's migration table remains in `public`. No application data belongs in
`public`.

## Data Flow and Transaction Boundaries

1. An upstream response is inserted into `raw.provider_payload`.
2. Runtime validation and data-quality checks run against that stored payload.
3. Core entities and their provider identities are upserted in one transaction
   per bounded unit, such as a roster or game.
4. The raw payload is marked processed only after the core transaction commits.
5. Analytics refreshes run after a completed statistics import and commit
   independently.
6. Failures are recorded in `ops.import_issue`; raw payloads are never deleted
   because transformation failed.

A network call must never occur inside a database transaction.

## Identifier Policy

- Internal identifiers are UUIDs and are the only identifiers exposed by the
  IceMetrics API.
- NHL identifiers remain strings even when they currently contain digits.
- Provider identities use dedicated, foreign-keyed tables for leagues, seasons,
  teams, players, and games.
- A provider identity is unique by `(provider, external_id)`.
- Import logic resolves provider identity before updating a core entity.

## Time, Date, and Numeric Policy

- Store instants as `timestamptz` in UTC and serialize them as ISO 8601 strings
  ending in `Z`.
- Store calendar dates as PostgreSQL `date`.
- Store NHL season labels as strings such as `2025-2026` and provider season
  codes as external identities such as `20252026`.
- Store time on ice as integer seconds, not formatted text.
- Store percentages and metric results as `numeric(12,6)`, never floating point.
- Counts are non-negative integers enforced by database checks.

## Retention

- Raw payloads and job history are retained indefinitely for the MVP.
- Secrets, authorization headers, and refresh tokens must never be stored in raw
  request metadata.
- A future retention policy requires an ADR and must preserve enough source data
  to reproduce published analytics.

## Required Constraints

- Explicit foreign keys and delete behavior.
- Unique natural keys where the domain has one.
- Check constraints for non-negative statistics, team inequality, valid date
  ranges, percentage ranges, and completed-job timestamps.
- Optimized indexes for documented API filters and job queries.
- `created_at` and `updated_at` on mutable entities.

The exact model contract is in `docs/13-database-schema.md`.
