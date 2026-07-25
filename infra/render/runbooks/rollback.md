# Application Rollback

Use this when a release is faulty and its database migrations remain compatible
with the prior application.

1. Declare the incident, preserve the failing release SHA and logs, and pause
   production jobs if writes might amplify the defect.
2. Identify the last production SHA whose smoke checks passed.
3. Review every migration between that SHA and the current release. If any is
   incompatible, use `forward-fix.md`; never run `migrate reset` or edit an
   applied migration.
4. Dispatch the production deployment workflow with the prior SHA. Protected
   approval and staging verification still apply.
5. Confirm liveness reports the prior SHA, then run deployment smoke checks and
   `jobs:health` from a Render shell.
6. Resume jobs only after reads, analytics, and freshness are correct.
7. Record timeline, impact, release SHAs, database conclusion, and follow-up.
