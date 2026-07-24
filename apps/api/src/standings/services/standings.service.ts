import { Inject, Injectable } from '@nestjs/common';

import {
  createPaginationMeta,
  PaginatedResult,
} from '../../common/pagination/pagination.js';
import { formatDateOnly } from '../../common/serialization/date.js';
import { roundToFour } from '../../common/serialization/number.js';
import {
  type StandingDto,
  type StandingQueryDto,
} from '../dto/standing.dto.js';
import {
  type StandingRecord,
  StandingsRepository,
} from '../repositories/standings.repository.js';

@Injectable()
export class StandingsService {
  constructor(
    @Inject(StandingsRepository)
    private readonly repository: StandingsRepository,
  ) {}

  async findMany(
    query: StandingQueryDto,
  ): Promise<PaginatedResult<StandingDto>> {
    const result = await this.repository.findMany(query);
    return new PaginatedResult(
      result.items.map(mapStanding),
      createPaginationMeta(query, result.total, query.sort),
    );
  }
}

function mapStanding(standing: StandingRecord): StandingDto {
  return {
    asOfDate: formatDateOnly(standing.asOfDate),
    conferenceRank: standing.conferenceRank,
    divisionRank: standing.divisionRank,
    gamesPlayed: standing.gamesPlayed,
    goalsAgainst: standing.goalsAgainst,
    goalsFor: standing.goalsFor,
    leagueRank: standing.leagueRank,
    losses: standing.losses,
    overtimeLosses: standing.overtimeLosses,
    pointPercentage: roundToFour(Number(standing.pointPercentage)),
    points: standing.points,
    seasonId: standing.seasonId,
    sourceCutoff: standing.sourceCutoff.toISOString(),
    team: standing.team,
    wins: standing.wins,
  };
}
