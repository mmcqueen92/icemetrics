import { Injectable, inject } from '@angular/core';

import { AnalyticsService } from './generated/api/analytics.service';
import { GamesService } from './generated/api/games.service';
import { PlayersService } from './generated/api/players.service';
import { SeasonsService } from './generated/api/seasons.service';
import { StandingsService } from './generated/api/standings.service';
import { TeamsService } from './generated/api/teams.service';

export interface PlayerQuery {
  active?: boolean | undefined;
  order?: 'asc' | 'desc' | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
  position?: 'C' | 'D' | 'G' | 'L' | 'R' | undefined;
  search?: string | undefined;
  sort?: 'firstName' | 'lastName' | 'position' | undefined;
  teamId?: string | undefined;
}

export interface GameQuery {
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  gameType?:
    'ALL_STAR' | 'PLAYOFF' | 'PRESEASON' | 'REGULAR_SEASON' | undefined;
  order?: 'asc' | 'desc' | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
  seasonId?: string | undefined;
  sort?: 'startsAt' | 'status' | undefined;
  status?:
    | 'CANCELLED'
    | 'FINAL'
    | 'LIVE'
    | 'POSTPONED'
    | 'PRE_GAME'
    | 'SCHEDULED'
    | undefined;
  teamId?: string | undefined;
}

@Injectable({ providedIn: 'root' })
export class ExplorerApiService {
  private readonly analytics = inject(AnalyticsService);
  private readonly games = inject(GamesService);
  private readonly players = inject(PlayersService);
  private readonly seasons = inject(SeasonsService);
  private readonly standings = inject(StandingsService);
  private readonly teams = inject(TeamsService);

  listSeasons() {
    return this.seasons.listSeasons(
      1,
      100,
      'desc',
      undefined,
      undefined,
      'startDate',
    );
  }

  listTeams(active = true) {
    return this.teams.listTeams(1, 100, 'asc', undefined, active, 'name');
  }

  getTeam(id: string) {
    return this.teams.getTeam(id);
  }

  listTeamRoster(id: string) {
    return this.teams.listTeamRoster(id, 1, 100, 'asc', true, 'lastName');
  }

  listStandings(seasonId: string, asOfDate?: string) {
    return this.standings.listStandings(
      seasonId,
      1,
      100,
      'asc',
      asOfDate,
      'leagueRank',
    );
  }

  listTeamRankings(seasonId: string, asOfDate?: string) {
    return this.analytics.listTeamRankings(seasonId, asOfDate);
  }

  listTeamTrends(id: string, seasonId: string) {
    return this.analytics.listTeamTrends(id, seasonId, 10);
  }

  listPlayers(query: PlayerQuery) {
    return this.players.listPlayers(
      query.page,
      query.pageSize,
      query.order,
      query.search,
      query.teamId,
      query.position,
      query.active,
      query.sort,
    );
  }

  getPlayer(id: string) {
    return this.players.getPlayer(id);
  }

  listPlayerStats(id: string, seasonId: string, page = 1) {
    return this.players.listPlayerGameStats(
      id,
      seasonId,
      page,
      25,
      'desc',
      undefined,
      undefined,
      'gameDate',
    );
  }

  listPlayerTrends(id: string, seasonId: string, window: 5 | 10 | 20) {
    return this.analytics.listPlayerTrends(id, seasonId, window);
  }

  listGames(query: GameQuery) {
    return this.games.listGames(
      query.page,
      query.pageSize,
      query.order,
      query.seasonId,
      query.teamId,
      query.status,
      query.gameType,
      query.dateFrom,
      query.dateTo,
      query.sort,
    );
  }

  getGame(id: string) {
    return this.games.getGame(id);
  }

  listGamePlayerStats(
    id: string,
    page = 1,
    sort: 'lastName' | 'points' | 'shots' | 'timeOnIceSeconds' = 'points',
    order: 'asc' | 'desc' = 'desc',
  ) {
    return this.games.listGamePlayerStats(id, page, 50, order, undefined, sort);
  }
}
