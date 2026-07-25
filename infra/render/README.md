# Render Operations

`render.yaml` is the infrastructure source of truth. It creates the IceMetrics
project with isolated staging and protected production environments. Each
environment owns a static web site, Docker API, hourly Docker cron job, and
PostgreSQL 17 database in Oregon.

## Provisioning

1. Create a Render Blueprint from the repository and review the diff.
2. Confirm both databases use a paid instance type. An omitted Blueprint plan
   currently defaults to Render's paid `basic-256mb` type; do not proceed if
   Render changes that behavior.
3. Supply each service's optional `SENTRY_DSN`/`PUBLIC_SENTRY_DSN` in the
   dashboard. Never put the values in the Blueprint.
4. Confirm database external IP allowlists are empty and both environments have
   private-network isolation. Keep production protection enabled.
5. Disable Blueprint auto-sync. Deployment is owned by the exact-SHA GitHub
   workflow, not by uncoordinated service auto-deploys.
6. Add GitHub `staging` and protected `production` environments. In each, add
   `API_DEPLOY_HOOK_URL`, `WEB_DEPLOY_HOOK_URL`, and `JOBS_DEPLOY_HOOK_URL`
   secrets plus `API_BASE_URL` and `WEB_BASE_URL` variables.
7. Configure the alerts in `alerts.md`.

Deploy hooks are secrets. Rotate a hook immediately if it is printed or
committed.

## Release flow

A successful `CI` run on `main` triggers staging deployment of its exact commit.
The API's pre-deploy command applies committed migrations once, and smoke tests
wait until `/health/live` reports that commit. Production is a manual workflow
dispatch using the same SHA; the protected environment approval occurs only
after staging is rechecked.

The hourly cron runs the dispatcher once and then runs `jobs:health`, a
read-only active-season freshness check. A stale Schedule or Game Statistics
job makes the cron invocation fail and therefore alerts without executing a
duplicate import.

## Required external evidence

Before the first production promotion, record:

- Blueprint validation and sync event URL;
- paid plan and PITR recovery-window screenshot for each database;
- successful staging deployment and smoke workflow URL;
- successful production deployment and smoke workflow URL;
- successful cron event showing the freshness JSON;
- Sentry test-event links for staging API and jobs; and
- a completed restore exercise using `runbooks/database-restore.md`.

Repository tests prove configuration and local recovery mechanics; they cannot
prove a hosted account's plan, alerts, backups, or approval settings.
