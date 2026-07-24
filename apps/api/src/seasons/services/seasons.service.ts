import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundError } from '../../common/errors/api-error.js';
import {
  createPaginationMeta,
  PaginatedResult,
} from '../../common/pagination/pagination.js';
import { formatDateOnly } from '../../common/serialization/date.js';
import {
  type SeasonQueryDto,
  type SeasonSummaryDto,
} from '../dto/season.dto.js';
import {
  type SeasonRecord,
  SeasonsRepository,
} from '../repositories/seasons.repository.js';

@Injectable()
export class SeasonsService {
  constructor(
    @Inject(SeasonsRepository) private readonly repository: SeasonsRepository,
  ) {}

  async findMany(
    query: SeasonQueryDto,
  ): Promise<PaginatedResult<SeasonSummaryDto>> {
    const result = await this.repository.findMany(query);
    return new PaginatedResult(
      result.items.map(mapSeason),
      createPaginationMeta(query, result.total, query.sort),
    );
  }

  async findById(id: string): Promise<SeasonSummaryDto> {
    const season = await this.repository.findById(id);
    if (season === null) {
      throw new ResourceNotFoundError('Season');
    }

    return mapSeason(season);
  }
}

function mapSeason(season: SeasonRecord): SeasonSummaryDto {
  return {
    endDate: formatDateOnly(season.endDate),
    id: season.id,
    label: season.label,
    leagueId: season.leagueId,
    startDate: formatDateOnly(season.startDate),
  };
}
