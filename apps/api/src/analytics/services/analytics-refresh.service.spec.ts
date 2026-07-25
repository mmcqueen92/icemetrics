import { Prisma } from '../../generated/prisma/client.js';
import { describe, expect, it, vi } from 'vitest';

import type { AnalyticsSeasonData } from '../repositories/analytics-refresh.repository.js';
import {
  AnalyticsRefreshService,
  buildSnapshots,
} from './analytics-refresh.service.js';

const seasonData = {
  games: [
    {
      awayScore: 2,
      decisionType: 'REGULATION',
      homeScore: 3,
      id: 'game-a',
      playerStats: [{ assists: 1, goals: 1, playerId: 'player-a', shots: 4 }],
      startsAt: new Date('2025-10-01T02:00:00Z'),
      teamStats: [
        {
          goalsAgainst: 2,
          goalsFor: 3,
          team: { id: 'team-a', name: 'Alpha' },
          teamId: 'team-a',
        },
        {
          goalsAgainst: 3,
          goalsFor: 2,
          team: { id: 'team-b', name: 'Beta' },
          teamId: 'team-b',
        },
      ],
    },
    {
      awayScore: 1,
      decisionType: 'OVERTIME',
      homeScore: 2,
      id: 'game-b',
      playerStats: [{ assists: 0, goals: 0, playerId: 'player-a', shots: 0 }],
      startsAt: new Date('2025-10-01T04:00:00Z'),
      teamStats: [
        {
          goalsAgainst: 1,
          goalsFor: 2,
          team: { id: 'team-b', name: 'Beta' },
          teamId: 'team-b',
        },
        {
          goalsAgainst: 2,
          goalsFor: 1,
          team: { id: 'team-a', name: 'Alpha' },
          teamId: 'team-a',
        },
      ],
    },
  ],
  seasonId: 'season-a',
  standings: [
    {
      asOfDate: new Date('2025-10-01T00:00:00Z'),
      pointPercentage: new Prisma.Decimal('0.75'),
      points: 3,
      teamId: 'team-a',
    },
    {
      asOfDate: new Date('2025-10-01T00:00:00Z'),
      pointPercentage: new Prisma.Decimal('0.50'),
      points: 2,
      teamId: 'team-b',
    },
  ],
} as unknown as AnalyticsSeasonData;

describe('analytics refresh', () => {
  it('builds ordered partial rolling snapshots and dated rankings', () => {
    const result = buildSnapshots(seasonData);

    expect(result.players).toHaveLength(24);
    expect(
      result.players.find(
        (snapshot) =>
          snapshot.asOfGameId === 'game-b' &&
          snapshot.metricCode === 'player.pointsPerGame' &&
          snapshot.window === 'LAST_5',
      ),
    ).toMatchObject({ sampleSize: 2, value: 1 });
    expect(result.teams).toHaveLength(12);
    expect(
      result.rankings.map(({ rank, teamId }) => ({ rank, teamId })),
    ).toEqual([
      { rank: 1, teamId: 'team-a' },
      { rank: 2, teamId: 'team-b' },
    ]);
  });

  it('changes all downstream cutoffs after an earlier correction', () => {
    const corrected = {
      ...seasonData,
      games: seasonData.games.map((game) => ({
        ...game,
        playerStats: game.playerStats.map((stat) => ({ ...stat })),
        teamStats: game.teamStats.map((stat) => ({
          ...stat,
          team: { ...stat.team },
        })),
      })),
    };
    corrected.games[0]!.playerStats[0]!.goals = 0;

    const original = buildSnapshots(seasonData).players.filter(
      (snapshot) => snapshot.metricCode === 'player.pointsPerGame',
    );
    const recalculated = buildSnapshots(corrected).players.filter(
      (snapshot) => snapshot.metricCode === 'player.pointsPerGame',
    );

    expect(recalculated.map((snapshot) => snapshot.value)).not.toEqual(
      original.map((snapshot) => snapshot.value),
    );
  });

  it('reconciles resolved seasons and reports missing and inactive scopes', async () => {
    const repository = {
      loadSeason: vi
        .fn()
        .mockResolvedValueOnce(seasonData)
        .mockResolvedValueOnce(null),
      reconcile: vi.fn().mockResolvedValue({
        created: 4,
        unchanged: 5,
        updated: 2,
      }),
      resolveSeasonIds: vi
        .fn()
        .mockResolvedValueOnce(['season-a', 'missing'])
        .mockResolvedValueOnce([]),
    };
    const service = new AnalyticsRefreshService(repository as never);
    const outcome = await service.execute('execution', {});

    expect(outcome.status).toBe('PARTIAL');
    expect(outcome.counts).toMatchObject({
      recordsCreated: 4,
      recordsFailed: 1,
      recordsUnchanged: 5,
      recordsUpdated: 2,
    });
    await expect(service.execute('execution', {})).resolves.toMatchObject({
      errorSummary: { code: 'NO_ACTIVE_SEASON' },
      status: 'SKIPPED',
    });
  });
});
