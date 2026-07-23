# Environment Configuration

Configuration is validated once during process startup. Missing, unknown, or
invalid production variables fail startup. Tests may provide an explicit test
configuration object.

## API and Job Runner

| Variable | Required | Rule |
| --- | --- | --- |
| `NODE_ENV` | yes | `development`, `test`, or `production` |
| `APP_ENV` | yes | `local`, `test`, `staging`, or `production` |
| `PORT` | API only | integer; Render supplies production value |
| `DATABASE_URL` | yes | PostgreSQL connection URL; secret |
| `LOG_LEVEL` | yes | `debug`, `info`, `warn`, or `error` |
| `CORS_ALLOWED_ORIGINS` | API only | comma-separated exact HTTPS origins |
| `PUBLIC_API_BASE_URL` | production | canonical external API URL |
| `NHL_WEB_API_BASE_URL` | yes | defaults locally to `https://api-web.nhle.com/v1` |
| `NHL_STATS_API_BASE_URL` | yes | defaults locally to `https://api.nhle.com/stats/rest/en` |
| `PROVIDER_TIMEOUT_MS` | yes | default `10000`, range 1000-30000 |
| `PROVIDER_MAX_CONCURRENCY` | yes | default `4`, range 1-8 |
| `RATE_LIMIT_PER_MINUTE` | API only | default `120`, range 10-1000 |
| `APP_VERSION` | production | immutable release SHA or version |
| `SENTRY_DSN` | no | secret; enables error reporting when set |
| `SENTRY_ENVIRONMENT` | with DSN | `staging` or `production` |

No `JWT_SECRET` or NHL `API_KEY` is required for the MVP.

## Web Application

Angular compile-time configuration contains:

- `apiBaseUrl`
- `environmentName`
- `releaseVersion`
- optional public Sentry DSN

Browser configuration must never contain a secret. Production and staging
values are supplied by their respective build/deployment environment.

## Files

- `.env.example`: committed API/local placeholders.
- `.env`: ignored developer values.
- `.env.test`: ignored only if it contains machine-specific values; CI supplies
  test configuration directly.
- Angular environment source contains safe defaults only.

`POSTGRES_PORT` configures only the local Docker Compose host binding and
defaults to `5433`; PostgreSQL continues to listen on `5432` inside its
container. `DATABASE_URL` must use the selected host port.

The repository `.gitignore` must ignore `.env`, `.env.*`, and then explicitly
allow `.env.example`.

## Environment Separation

- Local development uses Docker Compose PostgreSQL.
- CI creates an isolated PostgreSQL container.
- Render staging and production use separate services, databases, environment
  groups, URLs, and Sentry environments.
- No environment may reference another environment's database.
- Production secrets are stored only in the protected production environment.
