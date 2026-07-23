# Backend Module Design

## Application Entry Points

```text
apps/api/src/
  main.ts                 HTTP application
  job-runner.ts           scheduled/manual CLI application context
  app.module.ts
```

Both entry points compose the same modules. `job-runner.ts` does not bind an
HTTP port and exits non-zero when dispatch fails.

## Module Layout

```text
src/
  common/
    config/
    errors/
    health/
    logging/
    pagination/
    validation/
  database/
  leagues/
  seasons/
  teams/
  players/
  games/
  statistics/
  ingestion/
    providers/
      nhl/
    raw/
    transforms/
  jobs/
  analytics/
```

Authentication and users are not MVP modules.

Each feature module uses this shape where needed:

```text
<feature>/
  controllers/
  dto/
  repositories/
  services/
  <feature>.module.ts
```

Do not create empty `entities`, `interfaces`, or `utils` directories to satisfy
a template.

## Dependency Rules

- Controllers depend on application services and DTOs.
- Services implement business rules and orchestrate repositories.
- Repositories own Prisma queries and DTO-independent persistence mapping.
- Repositories do not call other repositories across module boundaries.
- A module uses another module through an exported service.
- The provider adapter depends on provider DTOs and an HTTP client, never on
  controllers.
- Analytics depends on normalized core queries, not raw provider shapes.
- `common` contains genuinely cross-cutting infrastructure and no hockey
  business rules.

Circular NestJS module references and `forwardRef` are prohibited. A circular
dependency must be resolved by changing ownership or extracting a narrow
application service.

## Request Flow

```text
HTTP request
  -> global validation
  -> controller
  -> application service
  -> repository/query object
  -> PostgreSQL
  -> explicit response DTO
  -> response envelope
```

Prisma models are never returned from controllers.

## Transaction Ownership

The service that defines the consistency boundary owns the transaction.
Repositories accept a transaction-scoped Prisma client when needed. Network
calls and analytics recalculation do not occur inside core write transactions.

## Errors

Services throw typed application errors such as `ResourceNotFoundError`.
Controllers do not translate errors individually. A global exception filter
maps expected errors to the contract and logs unexpected errors once with the
request ID.
