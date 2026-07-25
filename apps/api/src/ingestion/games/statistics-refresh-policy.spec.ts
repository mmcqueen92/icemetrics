import { describe, expect, it } from 'vitest';

import type { StatisticsCandidate } from './game-import.types.js';
import { statisticsDue } from './statistics-refresh-policy.js';

const finalAt = new Date('2026-01-15T03:00:00.000Z');

function candidate(
  overrides: Partial<StatisticsCandidate> = {},
): StatisticsCandidate {
  return {
    awayTeamExternalId: '10',
    awayTeamId: 'away',
    externalId: 'game-1',
    firstFinalAt: finalAt,
    gameId: 'game',
    hasCompleteStatistics: true,
    homeTeamExternalId: '23',
    homeTeamId: 'home',
    latestCheckedAt: new Date('2026-01-15T04:05:00.000Z'),
    seasonExternalId: '20252026',
    seasonId: 'season',
    ...overrides,
  };
}

describe('statisticsDue', () => {
  it('immediately selects games with missing statistics or no prior payload', () => {
    expect(
      statisticsDue(
        candidate({ hasCompleteStatistics: false }),
        new Date('2026-01-15T03:05:00.000Z'),
      ),
    ).toBe(true);
    expect(
      statisticsDue(
        candidate({ latestCheckedAt: null }),
        new Date('2026-01-15T03:05:00.000Z'),
      ),
    ).toBe(true);
  });

  it('rechecks at six and twenty-four hours and then daily', () => {
    expect(
      statisticsDue(candidate(), new Date('2026-01-15T08:59:00.000Z')),
    ).toBe(false);
    expect(
      statisticsDue(candidate(), new Date('2026-01-15T09:00:00.000Z')),
    ).toBe(true);
    expect(
      statisticsDue(
        candidate({
          latestCheckedAt: new Date('2026-01-16T03:05:00.000Z'),
        }),
        new Date('2026-01-16T04:00:00.000Z'),
      ),
    ).toBe(false);
    expect(
      statisticsDue(
        candidate({
          latestCheckedAt: new Date('2026-01-16T03:05:00.000Z'),
        }),
        new Date('2026-01-17T03:05:00.000Z'),
      ),
    ).toBe(true);
  });
});
