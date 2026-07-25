# Observability

## Structured Logs

API and job processes emit one-line JSON to stdout/stderr. Production logs
contain:

- timestamp, level, service, environment, and release;
- `requestId` for HTTP or `jobExecutionId` for jobs;
- route template, method, status, and duration for HTTP;
- job type, trigger, status, counts, and duration for jobs; and
- typed error code and stack only for unexpected server errors.

Do not log health-check successes at info level. Do not log full provider
payloads, query text with values, database URLs, headers, secrets, or browser
tokens.

## Correlation

- Accept `X-Request-ID` only when it is a valid UUID; otherwise generate a UUID
  with Node's `crypto.randomUUID()`.
- Return the request ID on every API response.
- Pass the job correlation ID into payload and issue records.
- Include the immutable release SHA in logs and Sentry events.

## Health

- `/health/live` proves the Node process can answer.
- `/health/ready` checks PostgreSQL with a two-second timeout.
- Provider availability is not part of API readiness; its failure degrades
  freshness but should not remove read access to stored data.

## Error Tracking

Sentry is the selected hosted error tracker when `SENTRY_DSN` is configured.
Send unexpected API exceptions, crashed jobs, and unhandled promise
rejections. Expected 4xx responses and data-quality warnings are not Sentry
errors.

Scrub request headers, query values named like secrets, database URLs, and raw
provider bodies before sending events.

Pass 13 implements opt-in Sentry reporting for unexpected API exceptions,
failed job operations, job-runner crashes, and browser global errors. API,
jobs, and browser events carry `APP_VERSION`/the Render commit and the explicit
staging or production environment. Default PII collection and tracing are
disabled; headers, cookies, query strings, database/DSN values, and provider
payload fields are removed before sending.

## Operational Signals

The MVP uses:

- Render service availability, CPU, memory, and database metrics;
- structured Render logs;
- Sentry error events; and
- `ops.job_execution` plus `ops.import_issue` for data-pipeline state.

No Prometheus stack is deployed initially.

Pass 8 freshness checks use `ops.job_execution.finished_at` for job-level
Schedule, Game Statistics, and Standings freshness. Per-game correction checks
use `cursor.checkedExternalIds`; changed games use
`cursor.affectedGameIds`. Data-quality details remain queryable by stable
`ops.import_issue.code`. Checksum-deduplicated raw rows retain their first fetch
time and are never mutated merely to record an unchanged observation.

## Implemented HTTP Logging Baseline

The API emits newline-delimited JSON through Pino. Each request receives a UUID
request ID, preserves a valid client-provided `X-Request-ID`, returns that value
in the response header, and includes it in request and unexpected-error logs.
Request headers and query strings are not logged. Authorization, cookies, API
keys, database credentials, and provider payloads are treated as forbidden log
data and are covered by automated tests.

Successful health probes are silent. Client errors are logged at warning level,
normal requests at information level, and unexpected failures at error level
with a sanitized stack and stable error code.

## Alerts

Configure alerts for:

- API health-check failure for 5 minutes;
- elevated server-error rate;
- any failed scheduled dispatcher;
- data freshness thresholds from `docs/30-data-quality-guide.md`;
- database unavailability or storage pressure; and
- Sentry regression on a resolved issue.

The exact post-provisioning alert matrix and runbook routes are maintained in
`infra/render/alerts.md`. The hourly cron ends with the read-only
`jobs:health` command so active-season Schedule or Game Statistics staleness
causes a failed cron event without starting duplicate ingestion work.

Every alert links to a runbook section and must identify staging versus
production.

## Service Objectives

Initial measured objectives, reviewed after the first 30 production days:

- API availability: 99.5% monthly, excluding planned maintenance.
- p95 API latency: under 500 ms for documented list/detail queries.
- Schedule freshness: successful import within 2 hours during an active season.
- Final-game statistics freshness: within 2 hours of provider final status.

These are operational objectives, not contractual SLAs.

Pass 13 health success responses include `environment`, immutable `release`,
and `status`; smoke tests use the release field to prove the deployed API is
the requested Git SHA.
