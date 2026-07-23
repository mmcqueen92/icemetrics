# Maintenance and Evolution

## Maintenance Policy

- Keep Node, npm, Angular, NestJS, Prisma, PostgreSQL minor versions, and
  dependencies on supported releases.
- Apply security updates promptly after CI/staging validation.
- Framework or runtime major upgrades are isolated changes with migration notes
  and the full test suite.
- Review operational objectives, dependency health, provider reliability, and
  database growth monthly after launch.
- Archive stale analytics only through a documented retention decision.

## Complexity Gates

Do not add infrastructure because it is common in larger systems. Require
measured evidence and an ADR for:

- Redis or another cache;
- message queue/background worker;
- read replica;
- microservice extraction;
- second live provider;
- cursor pagination;
- server-side rendering; or
- global frontend state library.

## Near-Term Evolution

After `1.0.0`, prioritize:

- reliability and data-quality fixes;
- more documented metrics using existing normalized data;
- improved visualizations and accessibility;
- historical backfill breadth; and
- performance work driven by measurements.

## Authentication Trigger

Accounts begin only when an accepted feature owns user data. Follow
`docs/26-authentication-design.md`; do not use authentication merely to make the
architecture appear more complete.

## Additional Provider Trigger

Use the thresholds in `docs/35-nhl-data-source-research.md`. A new provider must
preserve existing core UUIDs and provenance.

## Long-Term Possibilities

- saved dashboards and alerts;
- additional sports after NHL boundaries are proven;
- machine-learning predictions with documented evaluation;
- AI assistant through controlled analytics API tools; and
- user customization.

Each is a separate product decision. None is an implicit MVP requirement.
