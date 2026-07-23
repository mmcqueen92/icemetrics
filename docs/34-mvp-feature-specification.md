# MVP Feature Specification

## Goal

Release a complete, public NHL exploration and analytics experience that
demonstrates production-quality application, data, and cloud engineering.

## Personas

- A hockey fan exploring current teams, players, and games.
- An analyst comparing recent performance with season results.
- A hiring reviewer evaluating engineering quality and operational completeness.

No MVP persona has an account or modifies source data.

## Team Explorer

Users can:

- browse active NHL teams;
- view official standings for a selected season/date;
- inspect a team's current roster;
- inspect recent games and scoring differential; and
- see last-10 trend and current power rank.

Acceptance:

- filters and selected season are URL-addressable;
- official standings expose their as-of time;
- postponed/cancelled games are not counted as completed;
- roster, standings, trends, and rank have explicit empty/stale states; and
- team list/detail flow has API, component, and browser tests.

## Player Explorer

Users can:

- search by partial first, last, or full name;
- filter by team, position, and active status;
- view profile and current team;
- inspect paginated historical game statistics;
- inspect season and 5/10/20-game metrics; and
- add a player to comparison.

Acceptance:

- search begins at 2 characters and can be cancelled/superseded;
- pagination/filter/sort state is URL-addressable;
- derived points/shooting values follow the metric catalog;
- missing and zero-denominator data is displayed as unavailable, not zero; and
- player list/detail flow has API, component, and browser tests.

## Game Explorer

Users can:

- browse a season or bounded date range;
- filter by team, status, and game type;
- distinguish scheduled, live, final, postponed, and cancelled games;
- inspect score and team statistics; and
- inspect a sortable player box score.

Acceptance:

- queries cannot request unbounded history;
- status is conveyed without relying only on color;
- final data reconciles with imported box-score fixtures;
- future games do not show fabricated statistics; and
- game list/detail flow has API, component, and browser tests.

## Analytics Dashboard

Users can:

- compare 2-5 players for a season or rolling window;
- view player rolling trends;
- explore dated team power rankings;
- inspect team recent-performance trends; and
- understand formula, sample size, and data cutoff.

Acceptance:

- metrics exactly follow versioned catalog formulas;
- comparison state is shareable through the URL;
- every chart has an equivalent table/text summary;
- corrected source data causes deterministic recalculation; and
- analytics API, metric, component, and browser tests pass.

## Cross-Cutting Acceptance

- All product endpoints are public, GET-only, and versioned.
- API responses and errors match OpenAPI.
- UI meets WCAG 2.2 AA target and works at 320 px width.
- Data freshness is visible, and stale data remains distinguishable from current
  data.
- Provider failures do not prevent reads of stored data.
- Production deploy, migrations, monitoring, alerts, and recovery procedures are
  operational.
- Documentation matches the released implementation.

## Explicitly Outside MVP

- Accounts, saved preferences, alerts, comments, or administrator UI.
- Live play-by-play, shifts, contracts/salaries, predictions, or fantasy tools.
- Multiple sports/providers, provider failover, or data resale.
- NHL logos, photos, and media without confirmed rights.
- AI assistant.
