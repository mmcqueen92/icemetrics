# Security Architecture

## MVP Threat Model

The MVP exposes public, read-only hockey and analytics data. Its valuable assets
are database integrity, provider availability, deployment credentials, and
service availability. It stores no account data, passwords, payment data, or
provider API keys.

## Public API Controls

- Accept requests only over HTTPS outside local development.
- Validate and allowlist every path and query value.
- Reject unknown query parameters.
- Apply a default 120-request-per-minute IP rate limit.
- Trust only Render's known proxy hop when resolving client IP; never trust an
  arbitrary forwarded-for chain.
- Bound pagination, date ranges, comparison sizes, and query execution time.
- Set restrictive CORS to the configured Angular origins.
- Use security headers, including HSTS in production,
  `X-Content-Type-Options: nosniff`, a restrictive CSP for the static site, and
  `Referrer-Policy: strict-origin-when-cross-origin`.
- Do not reveal stack traces, SQL, upstream bodies, or configuration in errors.

## Operational Access

- Ingestion and migrations run only from the Render Cron Job, Render shell, or
  approved CI deployment workflow.
- There are no HTTP job-trigger or raw-payload endpoints.
- GitHub and Render accounts must use multi-factor authentication.
- Production is a protected Render environment.
- Production database external access uses an IP allowlist and is disabled when
  not required for an operation.

## Secrets

- Secrets live in local ignored `.env` files, GitHub environment secrets, or
  Render environment groups.
- Commit only `.env.example` with non-secret placeholders.
- Never log database URLs, authorization headers, cookies, full environment
  objects, or provider response bodies.
- Rotate a secret immediately if it appears in source control or logs; deleting
  the file is not sufficient.

The MVP requires no `JWT_SECRET` or NHL API key.

## Supply Chain

- Commit `package-lock.json` and use `npm ci`.
- CI reports all npm audit findings and fails on critical severity. High and
  lower findings remain visible for triage rather than receiving unsafe
  automatic breaking upgrades.
- CI scans repository history for verified secrets and reviews pull-request
  dependency changes, failing on critical findings.
- Dependabot proposes npm and GitHub Actions updates.
- GitHub Actions dependencies are pinned to immutable commit SHAs.
- Production containers run as a non-root user and contain only production
  dependencies and compiled output.

## Database

- API and cron services use separate least-privilege database credentials when
  Render configuration permits it.
- The application role may read/write application schemas but may not create
  databases or roles.
- Migration credentials are available only to the deployment step.
- Raw payload request metadata is allowlisted to prevent secret retention.

## Incident Priorities

1. Disable compromised credentials.
2. Stop unsafe writes or scheduled jobs.
3. Preserve logs and job/payload evidence.
4. Restore service or data from a verified point.
5. document the incident, root cause, and prevention work.

User authentication requirements for a future personalized release are defined
separately in `docs/26-authentication-design.md`.
