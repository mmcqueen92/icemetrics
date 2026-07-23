# Analytics Metric Catalog

## General Rules

- Include only final regular-season or playoff games for the requested season.
  Preseason and all-star games are excluded.
- A player game is a `PlayerGameStat` row; a team game is a
  `TeamGameStat` row.
- Rolling windows use the most recent `N` eligible games ordered by
  `(game.startsAt, game.id)`.
- Rates are null when their denominator is zero.
- Values are calculated at full database precision and rounded to four decimal
  places only in API DTOs.
- Persisted metrics record `formulaVersion = "1"`, sample size, cutoff game/date,
  and computation time.
- Fewer than the requested rolling games is allowed; the actual sample size is
  returned. Consistency score requires at least 5 games.

## Computation Policy

Calculated on demand:

- season points, goals, and assists per game;
- season shooting percentage;
- season win percentage; and
- season scoring differential.

Materialized after statistics imports:

- player rolling metrics for 5, 10, and 20 games;
- team last-10 metrics and recent-performance trend;
- dated standings snapshots; and
- dated power rankings.

## Player Metrics

Let `G` be eligible player games, `g` goals, `a` assists, `s` shots, and
`p = g + a`.

### Points per Game (`player.pointsPerGame`)

```text
sum(p) / count(G)
```

### Goals per Game (`player.goalsPerGame`)

```text
sum(g) / count(G)
```

### Assists per Game (`player.assistsPerGame`)

```text
sum(a) / count(G)
```

### Shooting Percentage (`player.shootingPercentage`)

```text
100 * sum(g) / sum(s)
```

Returns null when total shots are zero.

### Rolling Averages

Apply the formulas above to the last 5, 10, or 20 eligible games ending at the
snapshot's `asOfGameId`.

### Consistency Score (`player.consistencyScore`)

For the rolling game's point totals `p_i`:

```text
100 / (1 + populationStandardDeviation(p_i))
```

The result is `(0, 100]` and measures consistency, not quality. A player who
consistently records zero points can have a high consistency score, so the UI
must display it beside points per game. Return null with fewer than 5 games.

## Team Metrics

Let `GP` be games played, `W` wins, `L` regulation losses, `OTL` overtime or
shootout losses, `PTS = 2W + OTL`, `GF` goals for, and `GA` goals against.

### Win Percentage (`team.winPercentage`)

```text
W / GP
```

### Point Percentage (`team.pointPercentage`)

```text
PTS / (2 * GP)
```

### Scoring Differential (`team.scoringDifferential`)

```text
GF - GA
```

The rate form used by rankings is:

```text
(GF - GA) / GP
```

### Recent Performance Trend (`team.recentPerformanceTrend`)

```text
last10PointPercentage - seasonPointPercentage
```

If fewer than 10 games exist, use all completed games and report sample size.

### Power Ranking (`team.powerRanking`)

For every team with at least one completed game:

```text
goalComponent = clamp(0.5 + scoringDifferentialPerGame / 10, 0, 1)

score = 100 * (
  0.50 * seasonPointPercentage +
  0.30 * last10PointPercentage +
  0.20 * goalComponent
)
```

Sort descending by unrounded score. Ties are resolved by:

1. season points descending;
2. scoring differential descending;
3. team name ascending; and
4. team UUID ascending.

Ranks are ordinal positions after tie-breaking; ranks are not shared.

## Standings

Display provider-published NHL standings snapshots because official tie-breaking
rules include details outside the MVP game model. Store the provider values in
the analytics schema with source cutoff and retrieval time. Power ranking still
uses normalized statistics plus the stored official season point percentage.

## Refresh and Correction

- Refresh affected rolling snapshots and rankings after a final box score is
  first imported or corrected.
- Run a full current-season reconciliation nightly.
- A formula change increments `formulaVersion`, recalculates the current season,
  updates this catalog, and requires metric regression tests.

## Required Tests

Every metric includes:

- a hand-calculated fixture;
- zero-denominator behavior;
- minimum and partial rolling windows;
- ordering when games share a date;
- postseason/regular-season separation; and
- corrected-game recalculation.
