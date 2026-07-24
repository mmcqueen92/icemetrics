import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Environment } from '../../../common/config/environment.js';
import {
  ProviderHttpError,
  ProviderValidationError,
} from '../provider.errors.js';
import { ProviderHttpClient } from '../provider-http.client.js';
import { NhlDataProvider } from './nhl-data.provider.js';

const FIXTURE_DIRECTORY = fileURLToPath(
  new URL('../../../../test/fixtures/nhl/', import.meta.url),
);

function config(): ConfigService<Environment, true> {
  return new ConfigService({
    APP_ENV: 'test',
    APP_VERSION: 'test',
    NHL_STATS_API_BASE_URL: 'https://stats.test/',
    NHL_WEB_API_BASE_URL: 'https://web.test/v1/',
    PROVIDER_MAX_CONCURRENCY: 4,
    PROVIDER_TIMEOUT_MS: 100,
  });
}

describe('NhlDataProvider fixture contracts', () => {
  let requestedPaths: string[];
  let provider: NhlDataProvider;

  beforeEach(() => {
    requestedPaths = [];
    const fixtureByPath: Record<string, string> = {
      '/team': 'teams.json',
      '/v1/club-schedule-season/VAN/20252026': 'team-season-schedule.json',
      '/v1/gamecenter/2025020700/boxscore': 'game-boxscore.json',
      '/v1/gamecenter/2025020700/right-rail': 'game-team-stats.json',
      '/v1/player/1001/landing': 'player.json',
      '/v1/roster/VAN/20252026': 'roster.json',
      '/v1/schedule/2026-01-15': 'schedule.json',
      '/v1/standings/2026-01-15': 'standings.json',
    };
    const providerFetch = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        const url = input instanceof Request ? input.url : input;
        const path = new URL(url).pathname;
        requestedPaths.push(path);
        const fixture = fixtureByPath[path];
        if (!fixture) {
          return new Response('not found', { status: 404 });
        }
        return new Response(
          await readFile(`${FIXTURE_DIRECTORY}${fixture}`, 'utf8'),
          {
            headers: { 'content-type': 'application/json' },
            status: 200,
          },
        );
      });
    provider = new NhlDataProvider(
      config(),
      new ProviderHttpClient(config(), { fetch: providerFetch }),
    );
  });

  it('validates and maps every approved endpoint family', async () => {
    const teams = (await provider.getTeams()).validate();
    const roster = (await provider.getRoster('van', '20252026')).validate();
    const schedule = (await provider.getSchedule('2026-01-15')).validate();
    const seasonSchedule = (
      await provider.getTeamSeasonSchedule('VAN', '20252026')
    ).validate();
    const boxscore = (await provider.getGameBoxscore('2025020700')).validate();
    const teamStats = (
      await provider.getGameTeamStats('2025020700', '10', '23')
    ).validate();
    const player = (await provider.getPlayer('1001')).validate();
    const standings = (await provider.getStandings('2026-01-15')).validate();

    expect(teams[0]).toMatchObject({
      abbreviation: 'TOR',
      externalId: '10',
      fullName: 'Toronto Maple Leafs',
    });
    expect(roster.map((entry) => entry.position)).toEqual(['C', 'D', 'G']);
    expect(schedule.map((game) => game.status)).toEqual(['LIVE', 'POSTPONED']);
    expect(seasonSchedule).toEqual([]);
    expect(boxscore.game).toMatchObject({
      decisionType: 'OVERTIME',
      homeScore: 3,
      status: 'FINAL',
    });
    expect(
      boxscore.players.find((entry) => entry.playerExternalId === '1001')
        ?.timeOnIceSeconds,
    ).toBe(1_205);
    expect(teamStats.home).toMatchObject({
      powerPlayGoals: 1,
      powerPlayOpportunities: 3,
      shotsFor: 31,
      teamExternalId: '23',
    });
    expect(player.currentTeamExternalId).toBe('23');
    expect(standings[0]).toMatchObject({
      pointPercentage: 0.611111,
      teamAbbreviation: 'VAN',
    });
    expect(requestedPaths).toHaveLength(8);
  });

  it('preserves raw bytes until validation is explicitly requested', async () => {
    const response = await provider.getTeams();

    expect(new TextDecoder().decode(response.body)).toContain('"data"');
    expect(response.descriptor).toEqual({
      externalKey: 'nhl',
      parameters: {},
      path: '/team',
      resourceType: 'teams',
    });
    expect(response.validate()).toHaveLength(2);
  });

  it('routes stored payloads through current validators for replay', async () => {
    const cases = [
      ['teams', 'teams.json', {}],
      ['roster', 'roster.json', { team: 'VAN' }],
      ['schedule', 'schedule.json', {}],
      ['team-season-schedule', 'team-season-schedule.json', {}],
      ['game-boxscore', 'game-boxscore.json', {}],
      [
        'game-team-stats',
        'game-team-stats.json',
        { awayTeamId: '10', homeTeamId: '23' },
      ],
      ['player', 'player.json', {}],
      ['standings', 'standings.json', {}],
    ] as const;

    for (const [resourceType, fixture, parameters] of cases) {
      const value = JSON.parse(
        await readFile(`${FIXTURE_DIRECTORY}${fixture}`, 'utf8'),
      ) as unknown;
      expect(() =>
        provider.validateStoredPayload(
          resourceType,
          value,
          parameters,
          new Date('2026-07-22T12:00:00Z'),
        ),
      ).not.toThrow();
    }
  });

  it('rejects a malformed fixture', async () => {
    const body = await readFile(
      `${FIXTURE_DIRECTORY}malformed-roster.json`,
      'utf8',
    );
    const malformed = new NhlDataProvider(
      config(),
      new ProviderHttpClient(config(), {
        fetch: vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response(body, { status: 200 })),
      }),
    );

    await expect(async () =>
      (await malformed.getRoster('VAN', '20252026')).validate(),
    ).rejects.toBeInstanceOf(ProviderValidationError);
  });

  it('rejects incomplete official team game statistics', () => {
    expect(() =>
      provider.validateStoredPayload(
        'game-team-stats',
        { teamGameStats: [] },
        { awayTeamId: '10', homeTeamId: '23' },
        new Date('2026-07-22T12:00:00Z'),
      ),
    ).toThrow(ProviderValidationError);
  });

  it('exposes terminal HTTP responses for raw storage before failing validation', async () => {
    const missing = new NhlDataProvider(
      config(),
      new ProviderHttpClient(config(), {
        fetch: vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response('not found', { status: 404 })),
      }),
    );

    const response = await missing.getPlayer('9999');
    expect(new TextDecoder().decode(response.body)).toBe('not found');
    expect(response.validate).toThrow(ProviderHttpError);
  });
});
