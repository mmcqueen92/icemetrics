# OpenAPI Examples

Examples in the generated OpenAPI document must use syntactically valid UUIDs,
UTC timestamps, and the exact envelopes below.

## Player Response

`GET /api/v1/players/7d780a0a-5f39-4d29-9f6a-b28ed6ab2fb5`

```json
{
  "data": {
    "id": "7d780a0a-5f39-4d29-9f6a-b28ed6ab2fb5",
    "firstName": "Connor",
    "lastName": "McDavid",
    "position": "C",
    "shootsCatches": "L",
    "birthDate": "1997-01-13",
    "active": true,
    "currentTeam": {
      "id": "a43f39a5-b793-4416-8d0d-7e72095b7141",
      "name": "Edmonton Oilers",
      "abbreviation": "EDM"
    }
  }
}
```

## Paginated Players

`GET /api/v1/players?search=mcd&page=1&pageSize=25&sort=lastName&order=asc`

```json
{
  "data": [
    {
      "id": "7d780a0a-5f39-4d29-9f6a-b28ed6ab2fb5",
      "firstName": "Connor",
      "lastName": "McDavid",
      "position": "C",
      "active": true,
      "currentTeam": {
        "id": "a43f39a5-b793-4416-8d0d-7e72095b7141",
        "name": "Edmonton Oilers",
        "abbreviation": "EDM"
      }
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "totalItems": 1,
    "totalPages": 1,
    "sort": "lastName",
    "order": "asc"
  }
}
```

## Validation Error

`GET /api/v1/players?page=0`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid values.",
    "details": [
      {
        "field": "page",
        "code": "MIN_VALUE",
        "message": "page must be at least 1"
      }
    ],
    "requestId": "0d9de4ac-57b8-4cb4-8895-33bcb4eb3396",
    "timestamp": "2026-07-22T20:00:00.000Z"
  }
}
```

## Not Found Error

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

## Documentation Requirements

Every operation must document:

- operation ID and summary;
- path and query parameter rules;
- success schema and example;
- all applicable standard error responses;
- cache behavior; and
- whether a collection is paginated.
