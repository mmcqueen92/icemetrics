import { describe, expect, it, vi } from 'vitest';

import {
  RequestValidationError,
  ResourceNotFoundError,
} from './common/errors/api-error.js';
import { GameQueryDto, PlayerBoxScoreQueryDto } from './games/dto/game.dto.js';
import type { GamesRepository } from './games/repositories/games.repository.js';
import { GamesService } from './games/services/games.service.js';
import { LeagueQueryDto } from './leagues/dto/league.dto.js';
import type { LeaguesRepository } from './leagues/repositories/leagues.repository.js';
import { LeaguesService } from './leagues/services/leagues.service.js';
import {
  PlayerGameStatsQueryDto,
  PlayerQueryDto,
} from './players/dto/player.dto.js';
import type { PlayersRepository } from './players/repositories/players.repository.js';
import { PlayersService } from './players/services/players.service.js';
import { SeasonQueryDto } from './seasons/dto/season.dto.js';
import type { SeasonsRepository } from './seasons/repositories/seasons.repository.js';
import { SeasonsService } from './seasons/services/seasons.service.js';
import { StandingQueryDto } from './standings/dto/standing.dto.js';
import type { StandingsRepository } from './standings/repositories/standings.repository.js';
import { StandingsService } from './standings/services/standings.service.js';
import { RosterQueryDto, TeamQueryDto } from './teams/dto/team.dto.js';
import type { TeamsRepository } from './teams/repositories/teams.repository.js';
import { TeamsService } from './teams/services/teams.service.js';

const TEAM = {
  abbreviation: 'VAN',
  active: true,
  city: 'Vancouver',
  id: '00000000-0000-4000-8000-000000000201',
  name: 'Canucks',
};
const OPPONENT = {
  abbreviation: 'EDM',
  active: true,
  city: 'Edmonton',
  id: '00000000-0000-4000-8000-000000000202',
  name: 'Oilers',
};
const GAME = {
  awayScore: 1,
  awayTeam: OPPONENT,
  decisionType: 'REGULATION',
  gameType: 'REGULAR_SEASON',
  homeScore: 2,
  homeTeam: TEAM,
  id: '00000000-0000-4000-8000-000000000401',
  seasonId: '00000000-0000-4000-8000-000000000101',
  startsAt: new Date('2025-10-11T02:00:00.000Z'),
  status: 'FINAL',
  venue: null,
};

describe('core read services', () => {
  it('paginates leagues', async () => {
    const findMany = vi.fn().mockResolvedValue({
      items: [{ code: 'NHL', id: TEAM.id, name: 'National Hockey League' }],
      total: 1,
    });
    const service = new LeaguesService({
      findMany,
    } as unknown as LeaguesRepository);
    const query = new LeagueQueryDto();

    const result = await service.findMany(query);

    expect(result.items).toHaveLength(1);
    expect(result.meta).toMatchObject({ sort: 'name', totalItems: 1 });
  });

  it('maps seasons and rejects missing season details', async () => {
    const findMany = vi.fn().mockResolvedValue({
      items: [
        {
          endDate: new Date('2026-06-30T00:00:00.000Z'),
          id: TEAM.id,
          label: '2025-2026',
          leagueId: OPPONENT.id,
          startDate: new Date('2025-10-07T00:00:00.000Z'),
        },
      ],
      total: 1,
    });
    const findById = vi.fn().mockResolvedValue(null);
    const service = new SeasonsService({
      findById,
      findMany,
    } as unknown as SeasonsRepository);

    const result = await service.findMany(new SeasonQueryDto());
    expect(result.items[0]).toMatchObject({
      endDate: '2026-06-30',
      startDate: '2025-10-07',
    });
    await expect(service.findById(TEAM.id)).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
  });

  it('handles team details and parent-aware rosters', async () => {
    const findMany = vi.fn().mockResolvedValue({ items: [TEAM], total: 1 });
    const findById = vi
      .fn()
      .mockResolvedValueOnce({ ...TEAM, league: { code: 'NHL', ...OPPONENT } })
      .mockResolvedValueOnce(null);
    const exists = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const findRoster = vi.fn().mockResolvedValue({
      items: [
        {
          active: true,
          firstName: 'Alex',
          id: TEAM.id,
          lastName: 'Mercer',
          position: 'C',
          shootsCatches: 'L',
        },
      ],
      total: 1,
    });
    const service = new TeamsService({
      exists,
      findById,
      findMany,
      findRoster,
    } as unknown as TeamsRepository);

    expect((await service.findMany(new TeamQueryDto())).meta.totalItems).toBe(
      1,
    );
    expect(await service.findById(TEAM.id)).toMatchObject({ id: TEAM.id });
    await expect(service.findById(OPPONENT.id)).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
    await expect(
      service.findRoster(TEAM.id, new RosterQueryDto()),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(
      (await service.findRoster(TEAM.id, new RosterQueryDto())).items,
    ).toHaveLength(1);
  });

  it('validates, maps, and caches game-facing service results', async () => {
    const findMany = vi.fn().mockResolvedValue({ items: [GAME], total: 1 });
    const findById = vi
      .fn()
      .mockResolvedValueOnce({
        ...GAME,
        teamStats: [
          {
            goalsAgainst: 1,
            goalsFor: 2,
            penaltyMinutes: 4,
            powerPlayGoals: 1,
            powerPlayOpportunities: 3,
            shotsAgainst: 20,
            shotsFor: 25,
            team: TEAM,
          },
        ],
      })
      .mockResolvedValueOnce(null);
    const exists = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const findPlayerStats = vi.fn().mockResolvedValue({
      items: [
        {
          assists: 1,
          firstName: 'Alex',
          goals: 1,
          lastName: 'Mercer',
          penaltyMinutes: 0,
          playerActive: true,
          playerId: TEAM.id,
          plusMinus: 1,
          points: 2,
          position: 'C',
          powerPlayGoals: 0,
          shootsCatches: 'L',
          shortHandedGoals: 0,
          shots: 4,
          teamAbbreviation: TEAM.abbreviation,
          teamActive: true,
          teamCity: TEAM.city,
          teamId: TEAM.id,
          teamName: TEAM.name,
          timeOnIceSeconds: 1200,
        },
      ],
      total: 1,
    });
    const service = new GamesService({
      exists,
      findById,
      findMany,
      findPlayerStats,
    } as unknown as GamesRepository);

    await expect(service.findMany(new GameQueryDto())).rejects.toBeInstanceOf(
      RequestValidationError,
    );
    const query = new GameQueryDto();
    query.seasonId = GAME.seasonId;
    expect((await service.findMany(query)).items[0]).toMatchObject({
      startsAt: '2025-10-11T02:00:00.000Z',
    });
    expect((await service.findById(GAME.id)).teamStats[0]).toMatchObject({
      powerPlayPercentage: 33.3333,
    });
    await expect(service.findById(GAME.id)).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
    await expect(
      service.findPlayerStats(GAME.id, new PlayerBoxScoreQueryDto()),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(
      (await service.findPlayerStats(GAME.id, new PlayerBoxScoreQueryDto()))
        .items[0],
    ).toMatchObject({ points: 2, shootingPercentage: 25 });
  });

  it('maps player details and game statistics with opponent context', async () => {
    const findMany = vi.fn().mockResolvedValue({
      items: [
        {
          active: true,
          currentTeam: TEAM,
          firstName: 'Alex',
          id: TEAM.id,
          lastName: 'Mercer',
          position: 'C',
        },
      ],
      total: 1,
    });
    const findById = vi
      .fn()
      .mockResolvedValueOnce({
        active: true,
        birthDate: new Date('1998-03-11T00:00:00.000Z'),
        currentTeam: TEAM,
        firstName: 'Alex',
        id: TEAM.id,
        lastName: 'Mercer',
        position: 'C',
        shootsCatches: 'L',
      })
      .mockResolvedValueOnce(null);
    const exists = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const findGameStats = vi.fn().mockResolvedValue({
      items: [
        {
          assists: 1,
          game: GAME,
          goals: 1,
          penaltyMinutes: 0,
          plusMinus: 1,
          powerPlayGoals: 0,
          shortHandedGoals: 0,
          shots: 0,
          team: TEAM,
          teamId: TEAM.id,
          timeOnIceSeconds: 1200,
        },
      ],
      total: 1,
    });
    const service = new PlayersService({
      exists,
      findById,
      findGameStats,
      findMany,
    } as unknown as PlayersRepository);

    expect((await service.findMany(new PlayerQueryDto())).items).toHaveLength(
      1,
    );
    expect(await service.findById(TEAM.id)).toMatchObject({
      birthDate: '1998-03-11',
    });
    await expect(service.findById(TEAM.id)).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
    const query = new PlayerGameStatsQueryDto();
    query.seasonId = GAME.seasonId;
    await expect(service.findGameStats(TEAM.id, query)).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
    expect(
      (await service.findGameStats(TEAM.id, query)).items[0],
    ).toMatchObject({
      isHome: true,
      opponent: { id: OPPONENT.id },
      points: 2,
      shootingPercentage: null,
    });
  });

  it('serializes standings decimals, dates, and cutoffs', async () => {
    const findMany = vi.fn().mockResolvedValue({
      items: [
        {
          asOfDate: new Date('2025-10-11T00:00:00.000Z'),
          conferenceRank: null,
          divisionRank: 1,
          gamesPlayed: 1,
          goalsAgainst: 1,
          goalsFor: 2,
          leagueRank: 1,
          losses: 0,
          overtimeLosses: 0,
          pointPercentage: 0.666666,
          points: 2,
          seasonId: GAME.seasonId,
          sourceCutoff: new Date('2025-10-11T05:00:00.000Z'),
          team: TEAM,
          wins: 1,
        },
      ],
      total: 1,
    });
    const service = new StandingsService({
      findMany,
    } as unknown as StandingsRepository);
    const query = new StandingQueryDto();
    query.seasonId = GAME.seasonId;

    expect((await service.findMany(query)).items[0]).toMatchObject({
      asOfDate: '2025-10-11',
      pointPercentage: 0.6667,
      sourceCutoff: '2025-10-11T05:00:00.000Z',
    });
  });
});
