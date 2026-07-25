import { HttpErrorResponse } from '@angular/common/http';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ExplorerApiService } from '../core/api/explorer-api.service';
import { AnalyticsPageComponent } from './analytics/analytics-page';
import { GameDetailPageComponent } from './games/game-detail-page';
import { GameListPageComponent } from './games/game-list-page';
import { PlayerDetailPageComponent } from './players/player-detail-page';
import { PlayerListPageComponent } from './players/player-list-page';
import { TeamDetailPageComponent } from './teams/team-detail-page';
import { TeamListPageComponent } from './teams/team-list-page';

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
  position: 'C' as const,
};
const game = {
  away: { score: 2, team: opponent },
  decisionType: 'REGULATION' as const,
  gameType: 'REGULAR_SEASON' as const,
  home: { score: 4, team },
  id: 'game-1',
  seasonId: season.id,
  startsAt: '2025-10-11T02:00:00.000Z',
  status: 'FINAL' as const,
  venue: 'Pacific Coliseum',
};
const meta = {
  order: 'asc' as const,
  page: 1,
  pageSize: 25,
  sort: 'name',
  totalItems: 1,
  totalPages: 1,
};

function apiFixture() {
  return {
    comparePlayers: vi.fn(() =>
      of({
        data: {
          dataCutoff: game.startsAt,
          formulaVersion: '1',
          players: [
            {
              metrics: {
                assistsPerGame: 1,
                consistencyScore: null,
                goalsPerGame: 2,
                pointsPerGame: 3,
                shootingPercentage: 25,
              },
              player,
              sampleSize: 1,
            },
            {
              metrics: {
                assistsPerGame: 0,
                consistencyScore: null,
                goalsPerGame: 1,
                pointsPerGame: 1,
                shootingPercentage: 10,
              },
              player: { ...player, id: 'player-2', lastName: 'Riley' },
              sampleSize: 1,
            },
          ],
          season,
          window: 'season' as const,
        },
      }),
    ),
    getGame: vi.fn(() =>
      of({
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
      }),
    ),
    getPlayer: vi.fn(() =>
      of({
        data: {
          ...player,
          birthDate: '1998-03-11',
          shootsCatches: 'L' as const,
        },
      }),
    ),
    getPlayerSeasonSummary: vi.fn(() =>
      of({
        data: {
          dataCutoff: game.startsAt,
          formulaVersion: '1',
          metrics: {
            assistsPerGame: 1,
            consistencyScore: null,
            goalsPerGame: 2,
            pointsPerGame: 3,
            shootingPercentage: 25,
          },
          player,
          sampleSize: 1,
          season,
        },
      }),
    ),
    getTeam: vi.fn(() =>
      of({
        data: {
          ...team,
          league: {
            code: 'NHL',
            id: 'league-1',
            name: 'National Hockey League',
          },
        },
      }),
    ),
    listGamePlayerStats: vi.fn(() =>
      of({
        data: [
          {
            assists: 1,
            goals: 2,
            penaltyMinutes: 0,
            player: { ...player, shootsCatches: 'L' as const },
            plusMinus: 2,
            points: 3,
            powerPlayGoals: 1,
            shootingPercentage: 25,
            shortHandedGoals: 0,
            shots: 8,
            team,
            timeOnIceSeconds: 1234,
          },
        ],
        meta,
      }),
    ),
    listGames: vi.fn(() => of({ data: [game], meta })),
    listPlayerStats: vi.fn(() =>
      of({
        data: [
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
        ],
        meta,
      }),
    ),
    listPlayerTrends: vi.fn((_id: string, _seasonId: string, window: number) =>
      of({
        data: [
          {
            asOfDate: '2025-10-11',
            asOfGameId: game.id,
            computedAt: '2025-10-11T05:00:00.000Z',
            formulaVersion: '1',
            metrics: {
              assistsPerGame: 1,
              consistencyScore: window >= 5 ? 100 : null,
              goalsPerGame: 2,
              pointsPerGame: 3,
              shootingPercentage: 25,
            },
            sampleSize: 1,
            window,
          },
        ],
      }),
    ),
    listPlayers: vi.fn(() => of({ data: [player], meta })),
    listSeasons: vi.fn(() => of({ data: [season], meta })),
    listStandings: vi.fn(() =>
      of({
        data: [
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
        ],
        meta,
      }),
    ),
    listTeamRankings: vi.fn(() =>
      of({
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
      }),
    ),
    listTeamRoster: vi.fn(() =>
      of({
        data: [
          {
            active: true,
            firstName: player.firstName,
            id: player.id,
            lastName: player.lastName,
            position: player.position,
            shootsCatches: 'L' as const,
          },
        ],
        meta,
      }),
    ),
    listTeams: vi.fn(() => of({ data: [team, opponent], meta })),
    listTeamTrends: vi.fn(() =>
      of({
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
            window: 10 as const,
          },
        ],
      }),
    ),
  };
}

async function render<T>(
  component: Type<T>,
  api: ReturnType<typeof apiFixture>,
  pathParams: Record<string, string> = {},
  queryParams: Record<string, string> = {},
) {
  const queryParamMap = convertToParamMap(queryParams);
  await TestBed.configureTestingModule({
    imports: [component],
    providers: [
      { provide: ExplorerApiService, useValue: api },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap(pathParams)),
          queryParamMap: of(queryParamMap),
          snapshot: { queryParamMap },
        },
      },
      {
        provide: Router,
        useValue: { navigate: vi.fn().mockResolvedValue(true) },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('explorer pages', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders URL-filtered player results and a complete player detail', async () => {
    const api = apiFixture();
    const list = await render(PlayerListPageComponent, api, {}, { q: 'alex' });
    expect(list.textContent).toContain('Alex Mercer');
    expect(api.listPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'alex' }),
    );

    TestBed.resetTestingModule();
    const detail = await render(
      PlayerDetailPageComponent,
      api,
      { id: player.id },
      { season: season.id },
    );
    expect(detail.textContent).toContain('Rolling performance');
    expect(detail.textContent).toContain('3.00 P/GP');
    expect(detail.textContent).toContain('Game log');
  });

  it('renders player comparisons and team rankings from URL state', async () => {
    const api = apiFixture();
    const comparison = await render(
      AnalyticsPageComponent,
      api,
      {},
      {
        playerIds: 'player-1,player-2',
        season: season.id,
        tab: 'players',
      },
    );
    expect(comparison.textContent).toContain('Player metric comparison');
    expect(comparison.textContent).toContain('Equivalent player metric data');
    expect(api.comparePlayers).toHaveBeenCalledWith(
      ['player-1', 'player-2'],
      season.id,
      'season',
    );

    TestBed.resetTestingModule();
    const rankings = await render(
      AnalyticsPageComponent,
      api,
      {},
      { season: season.id, tab: 'rankings', team: team.id },
    );
    expect(rankings.textContent).toContain('Team power rankings');
    expect(rankings.textContent).toContain('Selected team trend');
  });

  it('renders standings and the team roster/performance detail', async () => {
    const api = apiFixture();
    const list = await render(
      TeamListPageComponent,
      api,
      {},
      { season: season.id },
    );
    expect(list.textContent).toContain('Official standings');
    expect(list.textContent).toContain('Vancouver Orcas');

    TestBed.resetTestingModule();
    const detail = await render(
      TeamDetailPageComponent,
      api,
      { id: team.id },
      { season: season.id },
    );
    expect(detail.textContent).toContain('Power rank');
    expect(detail.textContent).toContain('Current roster');
    expect(detail.textContent).toContain('Alex Mercer');
  });

  it('renders text statuses and final-game box scores', async () => {
    const api = apiFixture();
    const list = await render(
      GameListPageComponent,
      api,
      {},
      { season: season.id, status: 'FINAL' },
    );
    expect(list.textContent).toContain('Final');
    expect(list.textContent).toContain('VAN');

    TestBed.resetTestingModule();
    const detail = await render(GameDetailPageComponent, api, { id: game.id });
    expect(detail.textContent).toContain('Team statistics');
    expect(detail.textContent).toContain('Player box score');
    expect(detail.textContent).toContain('Alex Mercer');
  });

  it('renders a resource-specific not-found state', async () => {
    const api = apiFixture();
    api.getPlayer.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            error: { error: { message: 'Player does not exist.' } },
            status: 404,
          }),
      ) as never,
    );
    const element = await render(
      PlayerDetailPageComponent,
      api,
      { id: 'missing' },
      { season: season.id },
    );
    expect(element.textContent).toContain('Player not found');
  });

  it('renders recoverable feature errors without discarding filters', async () => {
    const api = apiFixture();
    api.listPlayers.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 503 })) as never,
    );
    const element = await render(
      PlayerListPageComponent,
      api,
      {},
      { position: 'C' },
    );
    expect(element.querySelector('[role="alert"]')).toBeTruthy();
    expect(element.textContent).toContain('Try again');
  });

  it('does not send a one-character player search to the API', async () => {
    const api = apiFixture();
    await render(PlayerListPageComponent, api, {}, { q: 'a' });
    expect(api.listPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined }),
    );
  });
});
