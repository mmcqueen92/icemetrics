# Alert Configuration

Configure these alerts in Render and Sentry after Blueprint provisioning. Every
notification must include the environment and the linked runbook.

| Signal               | Trigger                                                 | Route                                                                               |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| API readiness        | `/health/ready` unavailable for 5 minutes               | `provider-outage.md` only if PostgreSQL is healthy; otherwise `database-restore.md` |
| API server errors    | sustained 5xx increase or Sentry regression             | `rollback.md`                                                                       |
| Scheduled dispatcher | any failed cron invocation                              | `provider-outage.md`                                                                |
| Data freshness       | nonzero `jobs:health` exit                              | `provider-outage.md`                                                                |
| Database             | unavailable, connection saturation, or storage pressure | `database-restore.md`                                                               |
| Migration/deploy     | failed pre-deploy command                               | `forward-fix.md`                                                                    |

Send staging alerts to a non-paging engineering channel. Production
availability, database, failed cron, and Sentry regression alerts page the
on-call owner. Test each route during provisioning and quarterly thereafter.
