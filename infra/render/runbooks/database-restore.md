# PostgreSQL Restore

Use this for confirmed corruption or destructive data loss, not ordinary
application failures.

1. Declare the incident, suspend both cron jobs, restrict production changes,
   preserve logs, and identify the last known-good UTC time.
2. In the production database Recovery page, confirm the paid-plan PITR window
   covers that time. Restore to a **new** database; never overwrite the source.
3. Keep the recovery instance isolated. Validate migration history, row-count
   fingerprints, referential integrity, recent games/standings, analytics
   snapshots, and the latest successful job executions.
4. Update staging-equivalent services first when practical and run all
   deployment smoke checks against the recovery database.
5. Repoint the production API and jobs `DATABASE_URL` together through the
   protected environment, deploy the current compatible SHA, and smoke test.
6. Run `jobs:health`, then one bounded dispatcher. Resume the hourly cron only
   when no duplicate or corrupt work appears.
7. Retain the former database until the incident owner signs off. Record the
   restore point, new database ID, validation queries, workflow URLs, and data
   loss window.

Quarterly, run `npm run ops:rehearse-restore`. It creates an isolated temporary
PostgreSQL 17 container, migrates and seeds it, takes a custom-format backup,
restores into a second database, compares fingerprints, and removes only that
temporary container. A hosted PITR rehearsal remains required before launch
and at least annually because local `pg_dump` does not prove Render recovery.
