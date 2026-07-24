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
import {
  RosterPlayerDto,
  RosterQueryDto,
  TeamDetailDto,
  TeamQueryDto,
  TeamSummaryDto,
} from '../dto/team.dto.js';
import { TeamsService } from '../services/teams.service.js';

@ApiTags('Teams')
@Controller('teams')
export class TeamsController {
  constructor(@Inject(TeamsService) private readonly teams: TeamsService) {}

  @Get()
  @CacheControl(CachePolicy.Standard)
  @ApiOperation({
    operationId: 'listTeams',
    summary: 'List teams',
    description: 'Returns a paginated team collection. Cached for 300 seconds.',
  })
  @ApiPaginatedResponse(TeamSummaryDto, 'A paginated team collection.')
  findMany(
    @ValidatedQuery(TeamQueryDto) query: TeamQueryDto,
  ): Promise<PaginatedResult<TeamSummaryDto>> {
    return this.teams.findMany(query);
  }

  @Get(':id')
  @CacheControl(CachePolicy.Standard)
  @ApiOperation({
    operationId: 'getTeam',
    summary: 'Get a team',
    description: 'Returns one team with its league. Cached for 300 seconds.',
  })
  @ApiParam({ format: 'uuid', name: 'id' })
  @ApiSingleResponse(TeamDetailDto, 'The requested team.')
  findById(
    @ValidatedParams(UuidParamDto) params: UuidParamDto,
  ): Promise<TeamDetailDto> {
    return this.teams.findById(params.id);
  }

  @Get(':id/roster')
  @CacheControl(CachePolicy.Standard)
  @ApiOperation({
    operationId: 'listTeamRoster',
    summary: 'List a team roster',
    description:
      'Returns a paginated current-roster collection. Cached for 300 seconds.',
  })
  @ApiParam({ format: 'uuid', name: 'id' })
  @ApiPaginatedResponse(RosterPlayerDto, 'A paginated roster collection.', true)
  findRoster(
    @ValidatedParams(UuidParamDto) params: UuidParamDto,
    @ValidatedQuery(RosterQueryDto) query: RosterQueryDto,
  ): Promise<PaginatedResult<RosterPlayerDto>> {
    return this.teams.findRoster(params.id, query);
  }
}
