import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CacheControl, CachePolicy } from '../../common/http/cache-control.js';
import { ApiPaginatedResponse } from '../../common/openapi/api-response.decorator.js';
import { PaginatedResult } from '../../common/pagination/pagination.js';
import { ValidatedQuery } from '../../common/validation/validated-parameters.js';
import { LeagueQueryDto, LeagueSummaryDto } from '../dto/league.dto.js';
import { LeaguesService } from '../services/leagues.service.js';

@ApiTags('Leagues')
@Controller('leagues')
export class LeaguesController {
  constructor(
    @Inject(LeaguesService) private readonly leagues: LeaguesService,
  ) {}

  @Get()
  @CacheControl(CachePolicy.Historical)
  @ApiOperation({
    operationId: 'listLeagues',
    summary: 'List leagues',
    description:
      'Returns the paginated active league catalog. Cached for 3600 seconds.',
  })
  @ApiPaginatedResponse(LeagueSummaryDto, 'A paginated league collection.')
  findMany(
    @ValidatedQuery(LeagueQueryDto) query: LeagueQueryDto,
  ): Promise<PaginatedResult<LeagueSummaryDto>> {
    return this.leagues.findMany(query);
  }
}
