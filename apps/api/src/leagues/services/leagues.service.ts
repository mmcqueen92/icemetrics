import { Inject, Injectable } from '@nestjs/common';

import {
  createPaginationMeta,
  PaginatedResult,
} from '../../common/pagination/pagination.js';
import {
  type LeagueQueryDto,
  type LeagueSummaryDto,
} from '../dto/league.dto.js';
import { LeaguesRepository } from '../repositories/leagues.repository.js';

@Injectable()
export class LeaguesService {
  constructor(
    @Inject(LeaguesRepository) private readonly repository: LeaguesRepository,
  ) {}

  async findMany(
    query: LeagueQueryDto,
  ): Promise<PaginatedResult<LeagueSummaryDto>> {
    const result = await this.repository.findMany(query);
    return new PaginatedResult(
      result.items,
      createPaginationMeta(query, result.total, query.sort),
    );
  }
}
