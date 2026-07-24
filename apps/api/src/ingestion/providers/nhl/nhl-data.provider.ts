import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../../common/config/environment.js';
import {
  ProviderHttpError,
  ProviderValidationError,
} from '../provider.errors.js';
import { ProviderHttpClient } from '../provider-http.client.js';
import type {
  HockeyDataProvider,
  ProviderFetch,
  ProviderGame,
  ProviderGameBoxscore,
  ProviderPlayer,
  ProviderRequestDescriptor,
  ProviderStanding,
  ProviderTeam,
  ProviderResourceType,
  ProviderTeamGameSummary,
} from '../provider.types.js';
import {
  parseDailySchedule,
  parseGameBoxscore,
  parseGameTeamStats,
  parsePlayer,
  parseRoster,
  parseSeasonSchedule,
  parseStandings,
  parseTeams,
} from './nhl.schemas.js';

const PATHS = {
  boxscore: (gameId: string) => `/gamecenter/${segment(gameId)}/boxscore`,
  gameTeamStats: (gameId: string) =>
    `/gamecenter/${segment(gameId)}/right-rail`,
  player: (playerId: string) => `/player/${segment(playerId)}/landing`,
  roster: (team: string, season: string) =>
    `/roster/${segment(team)}/${segment(season)}`,
  schedule: (date: string) => `/schedule/${segment(date)}`,
  seasonSchedule: (team: string, season: string) =>
    `/club-schedule-season/${segment(team)}/${segment(season)}`,
  standings: (date: string) => `/standings/${segment(date)}`,
  teams: '/team',
} as const;

@Injectable()
export class NhlDataProvider implements HockeyDataProvider {
  private readonly statsBaseUrl: URL;
  private readonly webBaseUrl: URL;

  constructor(
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Inject(ProviderHttpClient)
    private readonly http: ProviderHttpClient,
  ) {
    this.statsBaseUrl = new URL(
      withTrailingSlash(config.get('NHL_STATS_API_BASE_URL', { infer: true })),
    );
    this.webBaseUrl = new URL(
      withTrailingSlash(config.get('NHL_WEB_API_BASE_URL', { infer: true })),
    );
  }

  getTeams(): Promise<ProviderFetch<ProviderTeam[]>> {
    return this.fetch(
      this.statsBaseUrl,
      {
        externalKey: 'nhl',
        parameters: {},
        path: PATHS.teams,
        resourceType: 'teams',
      },
      parseTeams,
    );
  }

  getRoster(
    teamAbbreviation: string,
    seasonExternalId: string,
  ): Promise<ProviderFetch<ProviderPlayer[]>> {
    const team = normalizeTeam(teamAbbreviation);
    const season = normalizeIdentifier(seasonExternalId);
    return this.fetch(
      this.webBaseUrl,
      {
        externalKey: `${team}:${season}`,
        parameters: { season, team },
        path: PATHS.roster(team, season),
        resourceType: 'roster',
      },
      (value) => parseRoster(value, team),
    );
  }

  getSchedule(date: string): Promise<ProviderFetch<ProviderGame[]>> {
    return this.fetch(
      this.webBaseUrl,
      {
        externalKey: date,
        parameters: { date },
        path: PATHS.schedule(date),
        resourceType: 'schedule',
      },
      parseDailySchedule,
    );
  }

  getTeamSeasonSchedule(
    teamAbbreviation: string,
    seasonExternalId: string,
  ): Promise<ProviderFetch<ProviderGame[]>> {
    const team = normalizeTeam(teamAbbreviation);
    const season = normalizeIdentifier(seasonExternalId);
    return this.fetch(
      this.webBaseUrl,
      {
        externalKey: `${team}:${season}`,
        parameters: { season, team },
        path: PATHS.seasonSchedule(team, season),
        resourceType: 'team-season-schedule',
      },
      parseSeasonSchedule,
    );
  }

  getGameBoxscore(
    gameExternalId: string,
  ): Promise<ProviderFetch<ProviderGameBoxscore>> {
    const gameId = normalizeIdentifier(gameExternalId);
    return this.fetch(
      this.webBaseUrl,
      {
        externalKey: gameId,
        parameters: { gameId },
        path: PATHS.boxscore(gameId),
        resourceType: 'game-boxscore',
      },
      parseGameBoxscore,
    );
  }

  getGameTeamStats(
    gameExternalId: string,
    awayTeamExternalId: string,
    homeTeamExternalId: string,
  ): Promise<ProviderFetch<ProviderTeamGameSummary>> {
    const gameId = normalizeIdentifier(gameExternalId);
    const awayTeamId = normalizeIdentifier(awayTeamExternalId);
    const homeTeamId = normalizeIdentifier(homeTeamExternalId);
    return this.fetch(
      this.webBaseUrl,
      {
        externalKey: gameId,
        parameters: { awayTeamId, gameId, homeTeamId },
        path: PATHS.gameTeamStats(gameId),
        resourceType: 'game-team-stats',
      },
      (value) => parseGameTeamStats(value, awayTeamId, homeTeamId),
    );
  }

  getPlayer(playerExternalId: string): Promise<ProviderFetch<ProviderPlayer>> {
    const playerId = normalizeIdentifier(playerExternalId);
    return this.fetch(
      this.webBaseUrl,
      {
        externalKey: playerId,
        parameters: { playerId },
        path: PATHS.player(playerId),
        resourceType: 'player',
      },
      parsePlayer,
    );
  }

  getStandings(date: string): Promise<ProviderFetch<ProviderStanding[]>> {
    return this.fetch(
      this.webBaseUrl,
      {
        externalKey: date,
        parameters: { date },
        path: PATHS.standings(date),
        resourceType: 'standings',
      },
      (value, fetchedAt) => parseStandings(value, fetchedAt),
    );
  }

  validateStoredPayload(
    resourceType: ProviderResourceType,
    value: unknown,
    parameters: Readonly<Record<string, string>>,
    fetchedAt: Date,
  ): unknown {
    switch (resourceType) {
      case 'teams':
        return parseTeams(value);
      case 'roster':
        return parseRoster(value, parameters['team'] ?? '');
      case 'schedule':
        return parseDailySchedule(value);
      case 'team-season-schedule':
        return parseSeasonSchedule(value);
      case 'game-boxscore':
        return parseGameBoxscore(value);
      case 'game-team-stats':
        return parseGameTeamStats(
          value,
          parameters['awayTeamId'] ?? '',
          parameters['homeTeamId'] ?? '',
        );
      case 'player':
        return parsePlayer(value);
      case 'standings':
        return parseStandings(value, fetchedAt);
    }
  }

  private async fetch<T>(
    baseUrl: URL,
    descriptor: ProviderRequestDescriptor,
    validate: (value: unknown, fetchedAt: Date) => T,
  ): Promise<ProviderFetch<T>> {
    const response = await this.http.get({
      endpointFamily: descriptor.resourceType,
      url: new URL(descriptor.path.replace(/^\//, ''), baseUrl),
    });
    return {
      ...response,
      descriptor,
      provider: 'nhl',
      validate: () => {
        if (response.httpStatus < 200 || response.httpStatus >= 300) {
          throw new ProviderHttpError(
            `Provider request failed with HTTP ${response.httpStatus}`,
            descriptor.resourceType,
            response.httpStatus,
          );
        }
        return validate(
          parseJson(response.body, descriptor.resourceType),
          response.fetchedAt,
        );
      },
    };
  }
}

function parseJson(body: Uint8Array, resourceType: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    throw new ProviderValidationError(resourceType, [
      'response: body is not valid JSON',
    ]);
  }
}

function normalizeIdentifier(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Provider identifier must not be empty');
  }
  return normalized;
}

function normalizeTeam(value: string): string {
  return normalizeIdentifier(value).toUpperCase();
}

function segment(value: string): string {
  return encodeURIComponent(normalizeIdentifier(value));
}

function withTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
