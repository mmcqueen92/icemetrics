# Developer Onboarding Guide

## Before Writing Code

1. Read `AGENTS.md`.
2. Read the required domain documents for the change.
3. Confirm the change belongs to the current implementation pass.
4. Check existing ADRs before proposing another technology or architectural
   pattern.

Documentation is authoritative. If two documents conflict, stop and resolve the
conflict in the same change before implementing either interpretation.

## Setup

1. Install the versions in `docs/11-local-development-guide.md`.
2. Clone the repository.
3. Copy `.env.example` to `.env`.
4. Run `npm ci`.
5. Run `npm run docker:up`.
6. Run `npm run db:migrate` and `npm run db:seed`.
7. Run `npm run dev`.
8. Verify both health endpoints and the Angular home page.
9. Run `npm run test:unit`.

## Where Work Belongs

- HTTP and domain behavior: `apps/api/src/<module>`.
- Prisma schema and migrations: `apps/api/prisma`.
- Provider formats: `apps/api/src/ingestion/providers/nhl`.
- Metrics: `apps/api/src/analytics`.
- UI features: `apps/web/src/app/features`.
- Shared UI/infrastructure: `apps/web/src/app/shared` or `core`.
- Render Blueprint: root `render.yaml`; supporting deployment automation and
  runbooks: `infra/render`.
- Product and engineering decisions: `docs`.

Do not create a new package, service, generic framework, or cross-module helper
without showing two concrete consumers and checking the ADRs.

## Pull Request Expectations

- Keep one coherent outcome per pull request.
- Include tests at the required level.
- Include schema migration and reviewed SQL for database changes.
- Regenerate OpenAPI and client artifacts for contract changes.
- Update documentation and ADRs when decisions change.
- State verification commands and any intentionally deferred work.

## Suggested First Contribution

Choose a small vertical behavior with an existing contract, such as a health
check assertion, DTO validation rule, provider fixture case, or reusable loading
state. Avoid changing architecture during onboarding.
