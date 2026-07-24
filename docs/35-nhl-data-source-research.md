# NHL Data Source Research

## Decision

Use the NHL-owned web API at `api-web.nhle.com` together with the NHL-owned
stats API at `api.nhle.com` as one logical provider named `nhl`.

This decision was verified again on 2026-07-24 against live JSON field
inventories for the team directory, standings, box-score, landing, and
right-rail endpoint families. The provider adapter contract and approved paths are recorded in
`docs/25-data-provider-design.md`.

## Capability Assessment

| Requirement | Source | Assessment |
| --- | --- | --- |
| Teams and stable external IDs | Stats `/team` | Meets |
| Current rosters and player IDs | Web `/roster/...` | Meets |
| Player profile details | Web `/player/.../landing` | Meets |
| Upcoming and historical schedules | Web schedule endpoints | Meets |
| Game status and score | Web gamecenter/schedule | Meets |
| Game and player box-score statistics | Web boxscore | Meets |
| Official team game totals | Web gamecenter right-rail | Meets |
| Official standings | Web standings | Meets |
| Authentication/API key | None currently | Meets |
| Published developer SLA | None found | Risk |
| Published versioned schema | None found | Risk |

## Alternatives Considered

### Community NHL API wrappers

Rejected as the primary source. They add another failure and maintenance layer
without improving data ownership. Community projects may be consulted during
development but are not runtime dependencies or authoritative documentation.

### Commercial sports-data provider

Deferred. A commercial provider may offer support and contractual stability,
but cost and account dependency are not justified before the public NHL source
shows a measured reliability or coverage gap.

### Scraping NHL web pages

Rejected. HTML is a less stable machine interface and increases legal,
operational, and parsing risk.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Endpoint changes without notice | One adapter, runtime schemas, fixture contracts |
| Temporary outage or throttling | Timeouts, bounded retry, due-job replay |
| Incomplete response | Reject affected entity and record visible import issue |
| Identifier changes | Explicit provider-identity tables |
| Historical corrections | Immutable raw payloads and idempotent upserts |
| Media or trademark misuse | Do not ingest/display protected media without review |

## Re-evaluation Triggers

Evaluate another provider when any of the following persists for seven days:

- less than 99% successful scheduled fetches excluding local failures;
- an endpoint required by the MVP is removed;
- correctness cannot be reconciled from stored responses;
- provider terms prohibit the intended public use; or
- recovery from upstream change exceeds two working days.

Adding a provider requires a new ADR.
