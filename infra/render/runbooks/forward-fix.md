# Migration Forward Fix

Use this when an applied migration or data change makes application rollback
unsafe.

1. Pause jobs and preserve logs, job execution IDs, and the failing SHA.
2. Reproduce on staging or a restored isolated database.
3. Add a new expand/contract Prisma migration; never alter an applied
   production migration.
4. Add a regression test and validate `prisma migrate deploy` against both a
   fresh database and the reproduced state.
5. Merge through CI, allow staging deployment, and inspect migration and smoke
   evidence.
6. Promote the exact staging SHA through the protected production environment.
7. Verify API, analytics, job freshness, and affected data before resuming jobs.
