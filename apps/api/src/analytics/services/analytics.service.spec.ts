import { Prisma } from '../../generated/prisma/client.js';
import { describe, expect, it, vi } from 'vitest';

import { ResourceNotFoundError } from '../../common/errors/api-error.js';
import {
  ComparisonWindow,
  type PlayerComparisonQueryDto,
} from '../dto/analytics.dto.js';
import { AnalyticsService } from './analytics.service.js';

const team = {
  abbreviation: 'ALP',
  active: true,
  city: 'Alpha City',
  id: 'team-a',
  name: 'Alpha',
};
const player = {
  active: true,
  currentTeam: team,
  firstName: 'Ada',
  id: 'player-a',
  lastName: 'One',
  position: 'C',
};
const metricRows = [
  {
    asOfGame: { startsAt: new Date('2025-10-01T02:00:00Z') },
    asOfGameId: 'game-a',
    computedAt: new Date('2025-10-01T03:00:00Z'),
    formulaVersion: '1',
    metricCode: 'player.pointsPerGame',
    sampleSize: 1,
    value: new Prisma.Decimal(2),
  },
  {
    asOfGame: { startsAt: new Date('2025-10-01T02:00:00Z') },
    asOfGameId: 'game-a',
    computedAt: new Date('2025-10-01T03:00:00Z'),
    formulaVersion: '1',
    metricCode: 'player.shootingPercentage',
    sampleSize: 1,
    value: new Prisma.Decimal(50),
  },
];

function repository(overrides: Record<string, unknown> = {}) {
  return {
    findOfficialStandings: vi.fn().mockResolvedValue([
      {
        asOfDate: new Date('2025-10-01T00:00:00Z'),
        pointPercentage: new Prisma.Decimal(1),
        points: 2,
        teamId: team.id,
      },
    ]),
    findPlayer: vi.fn().mockResolvedValue(player),
    findPlayerRollingSnapshots: vi
      .fn()
      .mockResolvedValue(
        metricRows.map((row) => ({ ...row, playerId: player.id })),
      ),
    findPlayerSeasonStats: vi.fn().mockResolvedValue([
      {
        assists: 1,
        game: { id: 'game-a', startsAt: new Date('2025-10-01T02:00:00Z') },
        goals: 1,
        playerId: player.id,
        shots: 2,
      },
    ]),
    findPlayerTrend: vi.fn().mockResolvedValue(metricRows),
    findPlayers: vi.fn().mockResolvedValue([player]),
    findRankings: vi.fn().mockResolvedValue({
      date: new Date('2025-10-01T00:00:00Z'),
      rows: [
        {
          asOfDate: new Date('2025-10-01T00:00:00Z'),
          computedAt: new Date('2025-10-01T03:00:00Z'),
          formulaVersion: '1',
          rank: 1,
          sampleSize: 1,
          score: new Prisma.Decimal(83),
          team,
          teamId: team.id,
        },
      ],
    }),
    findSeason: vi.fn().mockResolvedValue({
      endDate: new Date('2026-06-30T00:00:00Z'),
      id: 'season-a',
      label: '2025-2026',
      leagueId: 'league-a',
      startDate: new Date('2025-10-01T00:00:00Z'),
    }),
    findTeam: vi.fn().mockResolvedValue(team),
    findTeamSeasonStats: vi.fn().mockResolvedValue([
      {
        game: {
          decisionType: 'REGULATION',
          id: 'game-a',
          startsAt: new Date('2025-10-01T02:00:00Z'),
        },
        goalsAgainst: 1,
        goalsFor: 3,
        teamId: team.id,
      },
    ]),
    findTeamTrend: vi.fn().mockResolvedValue([
      {
        ...metricRows[0],
        metricCode: 'team.pointPercentage',
        value: new Prisma.Decimal(1),
      },
      {
        ...metricRows[0],
        metricCode: 'team.scoringDifferentialPerGame',
        value: new Prisma.Decimal(2),
      },
      {
        ...metricRows[0],
        metricCode: 'team.recentPerformanceTrend',
        value: new Prisma.Decimal(0),
      },
    ]),
    ...overrides,
  };
}

describe('AnalyticsService', () => {
  it('maps player and team trend snapshots', async () => {
    const service = new AnalyticsService(repository() as never);

    const playerTrends = await service.playerTrends(player.id, {
      seasonId: 'season-a',
      window: 5,
    });
    expect(playerTrends).toHaveLength(1);
    expect(playerTrends[0]?.metrics).toMatchObject({
      consistencyScore: null,
      pointsPerGame: 2,
      shootingPercentage: 50,
    });
    expect(playerTrends[0]?.sampleSize).toBe(1);
    await expect(
      service.teamTrends(team.id, { seasonId: 'season-a', window: 10 }),
    ).resolves.toEqual([
      expect.objectContaining({
        pointPercentage: 1,
        recentPerformanceTrend: 0,
        scoringDifferentialPerGame: 2,
      }),
    ]);
  });

  it('maps season and latest rolling comparisons in requested order', async () => {
    const service = new AnalyticsService(repository() as never);
    const base = {
      playerIds: [player.id],
      seasonId: 'season-a',
    } as PlayerComparisonQueryDto;

    await expect(
      service.comparePlayers({ ...base, window: ComparisonWindow.Season }),
    ).resolves.toMatchObject({
      players: [
        {
          metrics: {
            assistsPerGame: 1,
            consistencyScore: null,
            goalsPerGame: 1,
            pointsPerGame: 2,
            shootingPercentage: 50,
          },
          sampleSize: 1,
        },
      ],
    });
    await expect(
      service.comparePlayers({ ...base, window: ComparisonWindow.Last5 }),
    ).resolves.toMatchObject({
      players: [
        {
          metrics: { pointsPerGame: 2, shootingPercentage: 50 },
          sampleSize: 1,
        },
      ],
    });
  });

  it('maps ranking formula inputs and handles no snapshot', async () => {
    const service = new AnalyticsService(repository() as never);
    await expect(
      service.teamRankings({ seasonId: 'season-a' }),
    ).resolves.toEqual([
      expect.objectContaining({
        last10PointPercentage: 1,
        rank: 1,
        scoringDifferentialPerGame: 2,
        seasonPointPercentage: 1,
      }),
    ]);

    const empty = new AnalyticsService(
      repository({
        findRankings: vi.fn().mockResolvedValue({ date: null, rows: [] }),
      }) as never,
    );
    await expect(empty.teamRankings({ seasonId: 'season-a' })).resolves.toEqual(
      [],
    );
  });

  it('rejects missing comparison and trend resources', async () => {
    const service = new AnalyticsService(
      repository({
        findPlayer: vi.fn().mockResolvedValue(null),
        findPlayers: vi.fn().mockResolvedValue([]),
      }) as never,
    );
    await expect(
      service.playerTrends('missing', { seasonId: 'season-a', window: 10 }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(
      service.comparePlayers({
        playerIds: ['missing'],
        seasonId: 'season-a',
        window: ComparisonWindow.Season,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    const missingSeason = new AnalyticsService(
      repository({ findSeason: vi.fn().mockResolvedValue(null) }) as never,
    );
    await expect(
      missingSeason.comparePlayers({
        playerIds: [player.id],
        seasonId: 'missing',
        window: ComparisonWindow.Season,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    const missingTeam = new AnalyticsService(
      repository({ findTeam: vi.fn().mockResolvedValue(null) }) as never,
    );
    await expect(
      missingTeam.teamTrends('missing', {
        seasonId: 'season-a',
        window: 10,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
