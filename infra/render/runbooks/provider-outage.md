# NHL Provider Outage

Provider failure must not remove read access to stored data.

1. Confirm `/health/ready` is healthy and distinguish provider errors from
   database or application failures.
2. Inspect the cron event, Sentry event, `ops.job_execution`, and
   `ops.import_issue` codes. Preserve request correlation IDs; do not capture
   provider bodies in tickets or Sentry.
3. If retries are increasing provider load or bad data is being accepted,
   suspend the environment's cron job in Render. Keep API and web online.
4. Do not manually edit raw payloads or normalized rows. Bound any diagnostic
   import by date/game and use dry-run where supported.
5. After recovery, run one dispatcher invocation. Confirm Schedule and Game
   Statistics freshness, analytics refresh, and no duplicate logical work.
6. Resume the cron schedule and record duration, data gap, provider behavior,
   and any required backfill.
