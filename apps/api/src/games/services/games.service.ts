import { Inject, Injectable } from '@nestjs/common';

import {
  RequestValidationError,
  ResourceNotFoundError,
} from '../../common/errors/api-error.js';
import {
  createPaginationMeta,
  PaginatedResult,
} from '../../common/pagination/pagination.js';
import { percentage } from '../../common/serialization/number.js';
import { validateDateRange } from '../../common/validation/date-range.js';
import {
  type GameDetailDto,
  type GameQueryDto,
  type GameSummaryDto,
  type PlayerBoxScoreDto,
  type PlayerBoxScoreQueryDto,
  type TeamGameStatDto,
} from '../dto/game.dto.js';
import {
  type GameDetailRecord,
  GamesRepository,
  type PlayerBoxScoreRecord,
  type TeamGameStatRecord,
} from '../repositories/games.repository.js';
import { mapGameSummary } from './game-mapper.js';

@Injectable()
export class GamesService {
  constructor(
    @Inject(GamesRepository) private readonly repository: GamesRepository,
  ) {}

  async findMany(
    query: GameQueryDto,
  ): Promise<PaginatedResult<GameSummaryDto>> {
    validateGameQuery(query);
    const result = await this.repository.findMany(query);
    return new PaginatedResult(
      result.items.map(mapGameSummary),
      createPaginationMeta(query, result.total, query.sort),
    );
  }

  async findById(id: string): Promise<GameDetailDto> {
    const game = await this.repository.findById(id);
    if (game === null) {
      throw new ResourceNotFoundError('Game');
    }

    return mapGameDetail(game);
  }

  async findPlayerStats(
    gameId: string,
    query: PlayerBoxScoreQueryDto,
  ): Promise<PaginatedResult<PlayerBoxScoreDto>> {
    if (!(await this.repository.exists(gameId))) {
      throw new ResourceNotFoundError('Game');
    }

    const result = await this.repository.findPlayerStats(gameId, query);
    return new PaginatedResult(
      result.items.map(mapPlayerBoxScore),
      createPaginationMeta(query, result.total, query.sort),
    );
  }
}

function validateGameQuery(query: GameQueryDto): void {
  if (
    query.seasonId === undefined &&
    query.dateFrom === undefined &&
    query.dateTo === undefined
  ) {
    throw new RequestValidationError([
      {
        code: 'REQUIRED_FILTER',
        field: 'seasonId',
        message: 'seasonId or at least one date bound is required',
      },
    ]);
  }

  validateDateRange(query.dateFrom, query.dateTo);
}

function mapGameDetail(game: GameDetailRecord): GameDetailDto {
  return {
    ...mapGameSummary(game),
    teamStats: game.teamStats.map(mapTeamGameStat),
  };
}

function mapTeamGameStat(stat: TeamGameStatRecord): TeamGameStatDto {
  return {
    goalsAgainst: stat.goalsAgainst,
    goalsFor: stat.goalsFor,
    penaltyMinutes: stat.penaltyMinutes,
    powerPlayGoals: stat.powerPlayGoals,
    powerPlayOpportunities: stat.powerPlayOpportunities,
    powerPlayPercentage: percentage(
      stat.powerPlayGoals,
      stat.powerPlayOpportunities,
    ),
    shotsAgainst: stat.shotsAgainst,
    shotsFor: stat.shotsFor,
    team: stat.team,
  };
}

function mapPlayerBoxScore(stat: PlayerBoxScoreRecord): PlayerBoxScoreDto {
  return {
    assists: stat.assists,
    goals: stat.goals,
    penaltyMinutes: stat.penaltyMinutes,
    player: {
      active: stat.playerActive,
      firstName: stat.firstName,
      id: stat.playerId,
      lastName: stat.lastName,
      position: stat.position,
      shootsCatches: stat.shootsCatches,
    },
    plusMinus: stat.plusMinus,
    points: stat.points,
    powerPlayGoals: stat.powerPlayGoals,
    shootingPercentage: percentage(stat.goals, stat.shots),
    shortHandedGoals: stat.shortHandedGoals,
    shots: stat.shots,
    team: {
      abbreviation: stat.teamAbbreviation,
      active: stat.teamActive,
      city: stat.teamCity,
      id: stat.teamId,
      name: stat.teamName,
    },
    timeOnIceSeconds: stat.timeOnIceSeconds,
  };
}
