import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { CacheControl, CachePolicy } from '../../common/http/cache-control.js';
import {
  ApiPaginatedResponse,
  ApiSingleResponse,
} from '../../common/openapi/api-response.decorator.js';
import { PaginatedResult } from '../../common/pagination/pagination.js';
import { UuidParamDto } from '../../common/validation/uuid-param.dto.js';
import {
  ValidatedParams,
  ValidatedQuery,
} from '../../common/validation/validated-parameters.js';
import { SeasonQueryDto, SeasonSummaryDto } from '../dto/season.dto.js';
import { SeasonsService } from '../services/seasons.service.js';

@ApiTags('Seasons')
@Controller('seasons')
export class SeasonsController {
  constructor(
    @Inject(SeasonsService) private readonly seasons: SeasonsService,
  ) {}

  @Get()
  @CacheControl(CachePolicy.Historical)
  @ApiOperation({
    operationId: 'listSeasons',
    summary: 'List seasons',
    description:
      'Returns a filtered, paginated season collection. Cached for 3600 seconds.',
  })
  @ApiPaginatedResponse(SeasonSummaryDto, 'A paginated season collection.')
  findMany(
    @ValidatedQuery(SeasonQueryDto) query: SeasonQueryDto,
  ): Promise<PaginatedResult<SeasonSummaryDto>> {
    return this.seasons.findMany(query);
  }

  @Get(':id')
  @CacheControl(CachePolicy.Historical)
  @ApiOperation({
    operationId: 'getSeason',
    summary: 'Get a season',
    description: 'Returns one season. Cached for 3600 seconds.',
  })
  @ApiParam({ format: 'uuid', name: 'id' })
  @ApiSingleResponse(SeasonSummaryDto, 'The requested season.')
  findById(
    @ValidatedParams(UuidParamDto) params: UuidParamDto,
  ): Promise<SeasonSummaryDto> {
    return this.seasons.findById(params.id);
  }
}
