# Frontend Page Specifications

## Global Shell

The shell provides:

- product header and primary navigation;
- current data-freshness indicator;
- responsive content container;
- route-level loading progress;
- skip link and main landmark; and
- non-blocking global error notification.

Primary routes:

```text
/
/players
/players/:id
/teams
/teams/:id
/games
/games/:id
/analytics
/about
```

Unknown routes render an in-app not-found page.

## Dashboard (`/`)

Purpose: summarize current NHL activity.

Sections:

- latest completed and next scheduled games;
- current standings top five with link to full standings;
- current power-ranking top five;
- data `asOf` timestamp; and
- navigation into each explorer.

The dashboard never invents live data. If no current-season data exists, show a
clear empty state and retain navigation.

## Player Explorer (`/players`)

- Search, team, position, and active filters.
- Paginated/sortable results.
- Query parameters preserve all state.
- Selecting a player navigates to `/players/:id`.

## Player Detail (`/players/:id`)

- Profile and current-team summary.
- Season selector.
- Paginated game log.
- Season metric summary.
- Rolling-window chart with 5/10/20 selection.
- Add-to-comparison action that navigates to Analytics with URL state.

Missing player renders the resource-not-found view, not a generic failure.

## Team Explorer (`/teams`)

- Season selector and full standings table.
- Active team list.
- Selecting a team navigates to `/teams/:id`.

## Team Detail (`/teams/:id`)

- Team summary.
- Current roster.
- Recent games.
- Last-10 trend and scoring differential.
- Current standing and power rank.

## Game Explorer (`/games`)

- Season, team, status, and bounded date filters.
- Paginated chronological schedule/results.
- Clear visual difference between scheduled, live, final, postponed, and
  cancelled statuses using text as well as color.

## Game Detail (`/games/:id`)

- Teams, start time, status, venue, and score.
- Team statistics.
- Sortable player box score.
- Scheduled games show that statistics are not yet available.

## Analytics (`/analytics`)

Two tabs whose state is URL-addressable:

- **Player comparison:** 2 to 5 players, season, season/5/10/20 window, metric
  summary, chart, and equivalent table.
- **Team rankings:** season, optional as-of date, formula explanation, ranked
  table, and selected-team trend.

Every metric links to or reveals its definition, sample size, and data cutoff.

## Standard States

Every data region implements:

- skeleton or progress state;
- empty result with filter-reset action;
- recoverable error with retry;
- not-found state for missing resources; and
- stale-data notice when freshness thresholds are exceeded.
