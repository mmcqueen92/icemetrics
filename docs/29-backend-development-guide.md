# Backend Development Guide

## Adding an Endpoint

1. Add or update the endpoint contract in `docs/14-api-endpoints.md`.
2. Define request and response DTOs with runtime validation and OpenAPI
   annotations.
3. Add a repository query with explicit selection, stable ordering, and bounded
   pagination where applicable.
4. Add service behavior and domain errors.
5. Add the thin controller method.
6. Add unit and API integration tests.
7. Regenerate OpenAPI and the Angular client.
8. Verify the contract drift check.

## Controller Rules

Controllers may:

- bind and validate HTTP inputs;
- call one application service operation; and
- return DTOs.

Controllers may not:

- access Prisma;
- implement filtering or calculation rules;
- catch unexpected exceptions;
- map provider responses; or
- construct logs already handled by global infrastructure.

## Service Rules

Services:

- implement use cases and business validation;
- define transaction boundaries;
- orchestrate repositories and approved cross-module services; and
- return domain results that map cleanly to DTOs.

Services do not depend on Express request or response objects.

## Repository Rules

Repositories:

- encapsulate Prisma and SQL;
- use explicit `select` clauses;
- require deterministic ordering for lists;
- avoid business decisions; and
- expose intent-revealing methods rather than Prisma's generic API.

Mock repositories in service unit tests. Use real PostgreSQL for repository and
API integration tests.

## Logging

Log use-case outcomes at module boundaries, not every method call. Include
`requestId` or `jobExecutionId`, entity IDs, duration, and result counts. Never
log entire provider payloads, database URLs, secrets, or personal access tokens.

Controllers inherit the global validation, response envelope, error mapping,
request correlation, rate limiting, and security behavior. Product read
controllers must explicitly select the documented live, standard, or historical
cache policy rather than setting ad hoc cache headers.

The implemented core read modules follow the controller-service-repository
boundary. Cross-resource response summaries are imported from the module that
owns the resource contract; repositories still query their own use case
directly and never call another module's repository. Parent-scoped collection
services verify the parent before querying children, while top-level filters
return empty collections for unknown but valid identifiers.

## Ingestion Boundaries

Provider operations return exact response bytes and a lazy validator. Job
orchestration persists the raw response before invoking that validator. NHL
field shapes remain inside `ingestion/providers/nhl`; raw persistence and issue
recording remain inside `ingestion/raw`; job coordination owns execution
records, advisory locks, dispatch policy, replay, and exit semantics.

Session-level advisory locks use dedicated PostgreSQL connections and stable
keys. The dispatcher key never includes its scheduled timestamp. A contended
job records `SKIPPED` immediately, and replay references its immutable source
payload in job parameters without reassigning original provenance.

## Completion Checklist

- Contract and DTO agree.
- Validation covers all inputs.
- Success, empty, validation, and not-found behavior are tested.
- Query plan is reasonable for the documented indexes.
- OpenAPI and generated client are current.
- No persistence or provider model escapes its layer.
