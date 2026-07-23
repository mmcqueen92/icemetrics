# API Specification

## Protocol

- REST over HTTPS.
- JSON request and response bodies.
- Product base path: `/api/v1`.
- OpenAPI 3.1 document generated from the NestJS application.
- UTF-8 encoding and camelCase JSON fields.
- All timestamps are UTC ISO 8601 strings.
- All internal identifiers are UUID strings.

The API is public and read-only for the MVP. There are no product mutation,
authentication, user, or HTTP ingestion endpoints.

## Success Envelopes

Single-resource response:

```json
{
  "data": {}
}
```

Collection response:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "totalItems": 0,
    "totalPages": 0,
    "sort": "lastName",
    "order": "asc"
  }
}
```

`meta` is present only on paginated collections. Empty collections return HTTP
200 with an empty `data` array. A missing individual resource returns HTTP 404.

## Pagination

- Query parameters: `page` and `pageSize`.
- `page` defaults to `1` and must be an integer from `1` upward.
- `pageSize` defaults to `25` and must be between `1` and `100`.
- Each endpoint allowlists its `sort` values and defines a default.
- `order` is `asc` or `desc`.
- Every database query appends `id` as a stable tie-breaker.
- Invalid pagination or sort values return `VALIDATION_ERROR`; they are not
  silently coerced.

Page-number pagination is accepted for the MVP data volume. Cursor pagination
requires an ADR if measured deep-page performance becomes a problem.

## Filtering

- Unrecognized query parameters are rejected.
- UUID filters are validated before reaching a service.
- `dateFrom` and `dateTo` are inclusive `YYYY-MM-DD` values and may span at
  most 366 days.
- Player `search` is trimmed, case-insensitive, 2 to 100 characters, and
  searches first name, last name, and full name.
- Comma-separated identifiers are permitted only for the documented player
  comparison endpoint.

## Error Envelope

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Player does not exist.",
    "details": [],
    "requestId": "0d9de4ac-57b8-4cb4-8895-33bcb4eb3396",
    "timestamp": "2026-07-22T20:00:00.000Z"
  }
}
```

`message` is safe for end users. `details` is an array of structured validation
or conflict details and is empty when no safe details exist. Stack traces,
database errors, and upstream response bodies are never returned.

Validation detail shape is `{ field, code, message }`. `field` is the external
path/query name, `code` is a stable uppercase machine code, and `message` is a
safe explanation.

Standard error codes:

| HTTP | Code | Use |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid path, query, or request value |
| 404 | `RESOURCE_NOT_FOUND` | Requested UUID does not exist |
| 409 | `RESOURCE_CONFLICT` | Reserved for future mutation conflicts |
| 429 | `RATE_LIMIT_EXCEEDED` | Public rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected application failure |
| 503 | `DEPENDENCY_UNAVAILABLE` | Required database unavailable |

Future authenticated endpoints reserve `AUTHENTICATION_REQUIRED` (401) and
`PERMISSION_DENIED` (403).

## Caching and Rate Limits

- Public data responses send an `ETag`.
- Clients may send `If-None-Match` and receive HTTP 304.
- Games and live-adjacent data use `Cache-Control: public, max-age=60`.
- Rosters, profiles, and standings use `max-age=300`.
- Historical final-game responses use `max-age=3600`.
- Apply a default limit of 120 requests per minute per client IP, with standard
  `RateLimit-*` response headers.
- Liveness and readiness endpoints are not rate-limited.

No shared cache is used. Conditional requests and cache headers are computed by
the web service.

## OpenAPI Contract

- The generated file is committed at `apps/api/openapi/openapi.json`.
- Every operation documents parameters, success schema, standard errors, and
  examples.
- Operation IDs are stable and drive Angular client generation.
- CI starts the API metadata generator and fails if the committed contract or
  generated web client differs.
- A breaking response or endpoint change requires a new API version or an
  explicitly approved pre-1.0 migration.

## Health Endpoints

- `GET /health/live`: process is running; never queries dependencies.
- `GET /health/ready`: verifies database connectivity with a short timeout.

Health responses are not wrapped in the product envelope and must not expose
environment values or connection details.
