# Architecture Decision Records

Decisions are immutable once accepted. If a decision changes, add a superseding
ADR rather than rewriting its history.

## ADR-001: Modular Monolith

**Status:** Accepted

**Decision:** Implement the backend as a NestJS modular monolith. Modules own
their controllers, services, repositories, DTOs, and tests. Cross-module access
goes through exported services, not another module's repository.

**Rationale:** This gives the project enforceable boundaries without the
deployment and consistency costs of microservices.

## ADR-002: PostgreSQL and Prisma

**Status:** Accepted

**Decision:** Use PostgreSQL 17 with Prisma ORM 7, ESM, and
`@prisma/adapter-pg`. Use `raw`, `core`, `analytics`, and `ops` PostgreSQL
schemas and reviewed migrations.

**Rationale:** The domain is relational, requires strong integrity, and benefits
from PostgreSQL aggregation and JSONB support. Prisma provides typed persistence
without replacing SQL constraints.

## ADR-003: NHL-First Domain

**Status:** Accepted

**Decision:** Model the NHL explicitly for the MVP. Retain `League` and provider
boundaries, but do not create generic sport, competition, event, or participant
frameworks.

**Rationale:** NHL-specific names make the first implementation understandable.
Premature multi-sport abstraction would make it harder to finish and validate.

## ADR-004: Managed Deployment

**Status:** Superseded by ADR-010

**Decision:** Prefer managed hosting over self-managed servers.

**Rationale:** Operational effort should focus on the application and data
pipeline rather than host administration.

## ADR-005: npm Workspaces Monorepo

**Status:** Accepted

**Decision:** Place `apps/api` and `apps/web` in one npm-workspace repository.
Use Node.js 24.18.x LTS, npm 11.16.x, and one lockfile. Do not create shared
packages without at least two concrete consumers.

**Rationale:** Atomic changes and one CI pipeline are valuable for a single
product. npm is sufficient and avoids adding a workspace orchestrator before
build scale requires one.

## ADR-006: OpenAPI as the Application Boundary

**Status:** Accepted

**Decision:** The NestJS API generates a checked OpenAPI document. The Angular
API client and transport types are generated from it using OpenAPI Generator's
`typescript-angular` generator in a version-pinned container. Frontend code
never imports backend DTO classes, Prisma types, or backend domain objects.

**Rationale:** A generated protocol boundary prevents drift without coupling
the browser to backend frameworks or persistence.

## ADR-007: NHL-Owned API as the Initial Provider

**Status:** Accepted

**Decision:** Implement a provider named `nhl` using the NHL-owned web and stats
hosts. Store raw responses, validate at runtime, enforce bounded retries and
timeouts, and translate responses through a provider adapter.

**Rationale:** The endpoints cover teams, rosters, players, schedules, games,
standings, and box scores without a paid dependency. They have no published
developer SLA or stable schema guarantee, so direct use outside the adapter is
prohibited.

**Consequences:** Contract fixtures and provider health monitoring are required.
An endpoint change should require only an adapter update and replay of stored
raw payloads.

## ADR-008: Public Read-Only MVP

**Status:** Accepted

**Decision:** All MVP product endpoints are public GET endpoints. Do not include
users, JWT authentication, or HTTP-based job controls in the MVP.

**Rationale:** The specified explorer and analytics features do not persist user
data. Authentication would add attack surface and lifecycle work without
protecting a real product capability. Render and GitHub access control protect
operational actions.

**Revisit when:** A feature stores preferences, comparisons, alerts, or other
user-owned data.

## ADR-009: Hybrid Analytics Computation

**Status:** Accepted

**Decision:** Compute inexpensive season totals and rates on request. Persist
official standings snapshots, rolling-window metrics, recent trends, and power
rankings after statistics ingestion. Every persisted result records its formula
version, sample size, source cutoff, and computation time.

**Rationale:** This keeps basic answers current while avoiding repeated window
and cross-team calculations. PostgreSQL is sufficient at MVP scale.

## ADR-010: Render Deployment

**Status:** Accepted; supersedes ADR-004

**Decision:** Deploy to Render's Oregon region using a Static Site, Web Service,
hourly Cron Job, and paid PostgreSQL, defined by a Render Blueprint. Maintain
separate staging and production project environments. Production is protected
and promoted manually after staging smoke tests.

**Rationale:** Render supplies the required service types, private database
connectivity, managed TLS, logs, health checks, cron single-run behavior, and
paid PostgreSQL recovery with minimal custom infrastructure.

## ADR-011: Database-Backed Job Coordination

**Status:** Accepted

**Decision:** Use one hourly dispatcher process, PostgreSQL advisory locks, and
job execution records. Do not introduce a queue or long-running worker. Each
logical job is idempotent and determines whether it is due before running.

**Rationale:** Import volume and frequency do not justify queue infrastructure.
Database coordination works across local, staging, production, scheduled, and
manual executions.

## ADR-012: Test Tooling

**Status:** Accepted

**Decision:** Use Vitest, Supertest, Testcontainers, and Playwright for their
respective test levels. Tests against persistence use a real PostgreSQL
container rather than mocking Prisma.

**Rationale:** One unit-test runner reduces configuration, HTTP integration
tests exercise the real NestJS pipeline, and PostgreSQL-specific behavior must
be tested against PostgreSQL.
