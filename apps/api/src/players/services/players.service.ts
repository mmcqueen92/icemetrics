import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundError } from '../../common/errors/api-error.js';
import {
  createPaginationMeta,
  PaginatedResult,
} from '../../common/pagination/pagination.js';
import { formatDateOnly } from '../../common/serialization/date.js';
import { percentage } from '../../common/serialization/number.js';
import { validateDateRange } from '../../common/validation/date-range.js';
import { mapGameSummary } from '../../games/services/game-mapper.js';
import {
  type PlayerDetailDto,
  type PlayerGameStatDto,
  type PlayerGameStatsQueryDto,
  type PlayerQueryDto,
  type PlayerSummaryDto,
} from '../dto/player.dto.js';
import {
  type PlayerDetailRecord,
  type PlayerGameStatRecord,
  PlayersRepository,
} from '../repositories/players.repository.js';

@Injectable()
export class PlayersService {
  constructor(
    @Inject(PlayersRepository) private readonly repository: PlayersRepository,
  ) {}

  async findMany(
    query: PlayerQueryDto,
  ): Promise<PaginatedResult<PlayerSummaryDto>> {
    const result = await this.repository.findMany(query);
    return new PaginatedResult(
      result.items,
      createPaginationMeta(query, result.total, query.sort),
    );
  }

  async findById(id: string): Promise<PlayerDetailDto> {
    const player = await this.repository.findById(id);
    if (player === null) {
      throw new ResourceNotFoundError('Player');
    }

    return mapPlayerDetail(player);
  }

  async findGameStats(
    playerId: string,
    query: PlayerGameStatsQueryDto,
  ): Promise<PaginatedResult<PlayerGameStatDto>> {
    validateDateRange(query.dateFrom, query.dateTo);
    if (!(await this.repository.exists(playerId))) {
      throw new ResourceNotFoundError('Player');
    }

    const result = await this.repository.findGameStats(playerId, query);
    return new PaginatedResult(
      result.items.map(mapPlayerGameStat),
      createPaginationMeta(query, result.total, query.sort),
    );
  }
}

function mapPlayerDetail(player: PlayerDetailRecord): PlayerDetailDto {
  return {
    active: player.active,
    birthDate:
      player.birthDate === null ? null : formatDateOnly(player.birthDate),
    currentTeam: player.currentTeam,
    firstName: player.firstName,
    id: player.id,
    lastName: player.lastName,
    position: player.position,
    shootsCatches: player.shootsCatches,
  };
}

function mapPlayerGameStat(stat: PlayerGameStatRecord): PlayerGameStatDto {
  const isHome = stat.game.homeTeam.id === stat.teamId;
  return {
    assists: stat.assists,
    game: mapGameSummary(stat.game),
    goals: stat.goals,
    isHome,
    opponent: isHome ? stat.game.awayTeam : stat.game.homeTeam,
    penaltyMinutes: stat.penaltyMinutes,
    plusMinus: stat.plusMinus,
    points: stat.goals + stat.assists,
    powerPlayGoals: stat.powerPlayGoals,
    shootingPercentage: percentage(stat.goals, stat.shots),
    shortHandedGoals: stat.shortHandedGoals,
    shots: stat.shots,
    team: stat.team,
    timeOnIceSeconds: stat.timeOnIceSeconds,
  };
}
