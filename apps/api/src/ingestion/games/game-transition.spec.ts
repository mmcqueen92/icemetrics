import { describe, expect, it } from 'vitest';

import type { ProviderGame } from '../providers/provider.types.js';
import { preserveTerminalFinal } from './game-transition.js';

const scheduled: ProviderGame = {
  awayScore: null,
  awayTeamExternalId: '10',
  decisionType: null,
  externalId: 'game-1',
  gameType: 'REGULAR_SEASON',
  homeScore: null,
  homeTeamExternalId: '23',
  seasonExternalId: '20252026',
  startsAt: '2026-01-15T03:00:00.000Z',
  status: 'SCHEDULED',
  venue: null,
};

describe('preserveTerminalFinal', () => {
  it('prevents a stale schedule response from regressing a final game', () => {
    expect(
      preserveTerminalFinal(scheduled, {
        awayScore: 2,
        awayTeamId: 'away',
        decisionType: 'OVERTIME',
        gameType: 'REGULAR_SEASON',
        homeScore: 3,
        homeTeamId: 'home',
        id: 'game',
        seasonId: 'season',
        startsAt: new Date(scheduled.startsAt),
        status: 'FINAL',
        venue: 'Arena',
      }),
    ).toMatchObject({
      awayScore: 2,
      decisionType: 'OVERTIME',
      homeScore: 3,
      status: 'FINAL',
    });
  });

  it('accepts normal progression and final corrections', () => {
    expect(
      preserveTerminalFinal({ ...scheduled, status: 'LIVE' }, undefined),
    ).toMatchObject({ status: 'LIVE' });
    expect(
      preserveTerminalFinal(
        {
          ...scheduled,
          awayScore: 2,
          decisionType: 'REGULATION',
          homeScore: 4,
          status: 'FINAL',
        },
        {
          awayScore: 2,
          awayTeamId: 'away',
          decisionType: 'OVERTIME',
          gameType: 'REGULAR_SEASON',
          homeScore: 3,
          homeTeamId: 'home',
          id: 'game',
          seasonId: 'season',
          startsAt: new Date(scheduled.startsAt),
          status: 'FINAL',
          venue: 'Arena',
        },
      ),
    ).toMatchObject({ homeScore: 4, status: 'FINAL' });
  });
});
