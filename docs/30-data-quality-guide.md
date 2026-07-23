# Data Quality Guide

## Quality Dimensions

- **Completeness:** required identifiers and fields are present.
- **Validity:** values conform to types, ranges, and domain enumerations.
- **Consistency:** related records agree with each other.
- **Uniqueness:** external and core identities do not duplicate.
- **Timeliness:** scheduled data arrives within its expected window.
- **Traceability:** every imported record can be traced to provider payload and
  job execution.

## Blocking Checks

Reject the affected entity for:

- missing provider identifier;
- invalid or impossible date;
- unknown team, season, game status, or required parent;
- home and away team being the same;
- negative count statistics;
- player/team statistics for a team outside the game;
- duplicate provider identity mapping to different core entities; or
- final game without both teams and a score.

## Warning Checks

Import but record a warning for:

- missing optional birth date, position, venue, or localized name;
- an active roster with an unusually small count;
- a final game with no player time-on-ice value;
- a team or player absent for the first or second consecutive daily snapshot;
  or
- totals that differ from provider summary values but remain structurally
  possible.

Warnings must not be silently promoted to defaults that look authoritative.

## Cross-Record Reconciliation

For final games:

- exactly two team-stat rows are expected;
- team goals must agree with the game score;
- the sum of player goals for a team should equal team goals, with discrepancies
  recorded because shootout-deciding goals and provider conventions may differ;
- player and team IDs must resolve through provider identities; and
- duplicate player rows are rejected.

## Monitoring Thresholds

Create an error-level operational alert when:

- a scheduled job fails;
- a job is `PARTIAL` with more than 1% failed entities;
- no successful Schedule job completes within two hours during an active
  season;
- no successful Game Statistics job completes within two hours after final
  games exist; or
- an upstream fixture contract fails in CI.

## Repair

Repairs replay preserved raw payloads or run a bounded refetch. Never edit a raw
payload. Direct production data repair requires a reviewed script or migration,
a recorded job/incident reference, and verification queries.
