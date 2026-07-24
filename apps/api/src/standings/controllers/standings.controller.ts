import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CacheControl, CachePolicy } from '../../common/http/cache-control.js';
import { ApiPaginatedResponse } from '../../common/openapi/api-response.decorator.js';
import { PaginatedResult } from '../../common/pagination/pagination.js';
import { ValidatedQuery } from '../../common/validation/validated-parameters.js';
import { StandingDto, StandingQueryDto } from '../dto/standing.dto.js';
import { StandingsService } from '../services/standings.service.js';

@ApiTags('Standings')
@Controller('standings')
export class StandingsController {
  constructor(
    @Inject(StandingsService) private readonly standings: StandingsService,
  ) {}

  @Get()
  @CacheControl(CachePolicy.Standard)
  @ApiOperation({
    operationId: 'listStandings',
    summary: 'List standings',
    description:
      'Returns one dated, paginated standings snapshot. Cached for 300 seconds.',
  })
  @ApiPaginatedResponse(StandingDto, 'A paginated standings collection.')
  findMany(
    @ValidatedQuery(StandingQueryDto) query: StandingQueryDto,
  ): Promise<PaginatedResult<StandingDto>> {
    return this.standings.findMany(query);
  }
}
