import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundError } from '../../common/errors/api-error.js';
import {
  createPaginationMeta,
  PaginatedResult,
} from '../../common/pagination/pagination.js';
import {
  type RosterPlayerDto,
  type RosterQueryDto,
  type TeamDetailDto,
  type TeamQueryDto,
  type TeamSummaryDto,
} from '../dto/team.dto.js';
import { TeamsRepository } from '../repositories/teams.repository.js';

@Injectable()
export class TeamsService {
  constructor(
    @Inject(TeamsRepository) private readonly repository: TeamsRepository,
  ) {}

  async findMany(
    query: TeamQueryDto,
  ): Promise<PaginatedResult<TeamSummaryDto>> {
    const result = await this.repository.findMany(query);
    return new PaginatedResult(
      result.items,
      createPaginationMeta(query, result.total, query.sort),
    );
  }

  async findById(id: string): Promise<TeamDetailDto> {
    const team = await this.repository.findById(id);
    if (team === null) {
      throw new ResourceNotFoundError('Team');
    }

    return team;
  }

  async findRoster(
    teamId: string,
    query: RosterQueryDto,
  ): Promise<PaginatedResult<RosterPlayerDto>> {
    if (!(await this.repository.exists(teamId))) {
      throw new ResourceNotFoundError('Team');
    }

    const result = await this.repository.findRoster(teamId, query);
    return new PaginatedResult(
      result.items,
      createPaginationMeta(query, result.total, query.sort),
    );
  }
}
