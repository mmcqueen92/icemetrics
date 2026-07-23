# Entity Relationship Model

## Core Relationships

```text
League 1 ── * Season
League 1 ── * Team

Season 1 ── * Game
Team   1 ── * Game (homeTeam)
Team   1 ── * Game (awayTeam)
Team   1 ── * Player (currentTeam, optional)

Game   1 ── * PlayerGameStat * ── 1 Player
Team   1 ── * PlayerGameStat
Game   1 ── * TeamGameStat   * ── 1 Team
```

## Provider Traceability

```text
Core entity 1 ── * EntityProviderIdentity
JobExecution 1 ── * ProviderPayload
JobExecution 1 ── * ImportIssue
ProviderPayload 0..1 ── * ImportIssue
```

Provider identities are implemented as five concrete tables so every external
identity has a real foreign key. A polymorphic `entity_id` table is prohibited.

## Analytics Relationships

```text
Season 1 ── * TeamStandingSnapshot * ── 1 Team
Season 1 ── * PlayerMetricSnapshot * ── 1 Player
Season 1 ── * TeamMetricSnapshot   * ── 1 Team
Season 1 ── * TeamRankingSnapshot  * ── 1 Team
Game   1 ── * rolling metric snapshots (cutoff)
```

Analytics rows are reproducible outputs, not sources of truth. Each snapshot
identifies its formula version and data cutoff.

## Intentional MVP Simplifications

- `Player.current_team_id` represents current roster membership. Historical
  team participation is preserved in game statistics; contracts and roster
  tenure are outside MVP scope.
- NHL franchises and relocations are represented as historical teams rather
  than a separate franchise hierarchy.
- Play-by-play events, shifts, officials, venues as first-class entities, and
  salary/contract data are not modeled.
