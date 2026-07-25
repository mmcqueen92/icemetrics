import type { Page, Route } from '@playwright/test';

const season = {
  endDate: '2026-06-30',
  id: 'season-1',
  label: '2025–26',
  leagueId: 'league-1',
  startDate: '2025-10-01',
};
const team = {
  abbreviation: 'VAN',
  active: true,
  city: 'Vancouver',
  id: 'team-1',
  name: 'Orcas',
};
const opponent = {
  abbreviation: 'SEA',
  active: true,
  city: 'Seattle',
  id: 'team-2',
  name: 'Metropolitans',
};
const player = {
  active: true,
  currentTeam: team,
  firstName: 'Alex',
  id: 'player-1',
  lastName: 'Mercer',
  position: 'C',
};
const game = {
  away: { score: 2, team: opponent },
  decisionType: 'REGULATION',
  gameType: 'REGULAR_SEASON',
  home: { score: 4, team },
  id: 'game-1',
  seasonId: season.id,
  startsAt: '2025-10-11T02:00:00.000Z',
  status: 'FINAL',
  venue: 'Pacific Coliseum',
};

function collection(data: unknown[]) {
  return {
    data,
    meta: {
      order: 'asc',
      page: 1,
      pageSize: 25,
      sort: 'name',
      totalItems: data.length,
      totalPages: data.length ? 1 : 0,
    },
  };
}

async function respond(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
  });
}

export async function mockExplorerApi(page: Page): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');

    if (path === '/seasons') {
      return respond(route, collection([season]));
    }
    if (path === '/teams') {
      return respond(route, collection([team, opponent]));
    }
    if (path === `/teams/${team.id}`) {
      return respond(route, {
        data: {
          ...team,
          league: {
            code: 'NHL',
            id: 'league-1',
            name: 'National Hockey League',
          },
        },
      });
    }
    if (path === `/teams/${team.id}/roster`) {
      return respond(
        route,
        collection([
          {
            active: true,
            firstName: player.firstName,
            id: player.id,
            lastName: player.lastName,
            position: player.position,
            shootsCatches: 'L',
          },
        ]),
      );
    }
    if (path === '/players') {
      return respond(route, collection([player]));
    }
    if (path === `/players/${player.id}`) {
      return respond(route, {
        data: {
          ...player,
          birthDate: '1998-03-11',
          shootsCatches: 'L',
        },
      });
    }
    if (path === `/players/${player.id}/stats`) {
      return respond(
        route,
        collection([
          {
            assists: 1,
            game,
            goals: 2,
            isHome: true,
            opponent,
            penaltyMinutes: 0,
            plusMinus: 2,
            points: 3,
            powerPlayGoals: 1,
            shootingPercentage: 25,
            shortHandedGoals: 0,
            shots: 8,
            team,
            timeOnIceSeconds: 1234,
          },
        ]),
      );
    }
    if (path === `/analytics/players/${player.id}/trends`) {
      const window = Number(url.searchParams.get('window') ?? 10);
      return respond(route, {
        data: [
          {
            asOfDate: '2025-10-11',
            asOfGameId: game.id,
            computedAt: '2025-10-11T05:05:00.000Z',
            formulaVersion: '1',
            metrics: {
              assistsPerGame: 1,
              consistencyScore: 100,
              goalsPerGame: 2,
              pointsPerGame: 3,
              shootingPercentage: 25,
            },
            sampleSize: 1,
            window,
          },
        ],
      });
    }
    if (path === '/standings') {
      return respond(
        route,
        collection([
          {
            asOfDate: '2025-10-11',
            conferenceRank: 1,
            divisionRank: 1,
            gamesPlayed: 1,
            goalsAgainst: 2,
            goalsFor: 4,
            leagueRank: 1,
            losses: 0,
            overtimeLosses: 0,
            pointPercentage: 1,
            points: 2,
            seasonId: season.id,
            sourceCutoff: '2025-10-11T05:00:00.000Z',
            team,
            wins: 1,
          },
        ]),
      );
    }
    if (path === '/analytics/teams/rankings') {
      return respond(route, {
        data: [
          {
            asOfDate: '2025-10-11',
            computedAt: '2025-10-11T05:05:00.000Z',
            formulaVersion: '1',
            last10PointPercentage: 1,
            rank: 1,
            sampleSize: 1,
            score: 100,
            scoringDifferentialPerGame: 2,
            seasonId: season.id,
            seasonPointPercentage: 1,
            team,
          },
        ],
      });
    }
    if (path === `/analytics/teams/${team.id}/trends`) {
      return respond(route, {
        data: [
          {
            asOfDate: '2025-10-11',
            asOfGameId: game.id,
            computedAt: '2025-10-11T05:05:00.000Z',
            formulaVersion: '1',
            pointPercentage: 1,
            recentPerformanceTrend: 0,
            sampleSize: 1,
            scoringDifferentialPerGame: 2,
            seasonId: season.id,
            team,
            window: 10,
          },
        ],
      });
    }
    if (path === '/games') {
      return respond(route, collection([game]));
    }
    if (path === `/games/${game.id}`) {
      return respond(route, {
        data: {
          ...game,
          teamStats: [
            {
              goalsAgainst: 2,
              goalsFor: 4,
              penaltyMinutes: 8,
              powerPlayGoals: 1,
              powerPlayOpportunities: 3,
              powerPlayPercentage: 33.3333,
              shotsAgainst: 28,
              shotsFor: 31,
              team,
            },
          ],
        },
      });
    }
    if (path === `/games/${game.id}/player-stats`) {
      return respond(
        route,
        collection([
          {
            assists: 1,
            goals: 2,
            penaltyMinutes: 0,
            player: {
              active: true,
              firstName: player.firstName,
              id: player.id,
              lastName: player.lastName,
              position: player.position,
              shootsCatches: 'L',
            },
            plusMinus: 2,
            points: 3,
            powerPlayGoals: 1,
            shootingPercentage: 25,
            shortHandedGoals: 0,
            shots: 8,
            team,
            timeOnIceSeconds: 1234,
          },
        ]),
      );
    }

    await route.fulfill({ status: 404 });
  });
}
