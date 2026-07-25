import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { CacheControl, CachePolicy } from '../../common/http/cache-control.js';
import {
  ApiCollectionResponse,
  ApiSingleResponse,
} from '../../common/openapi/api-response.decorator.js';
import { UuidParamDto } from '../../common/validation/uuid-param.dto.js';
import {
  ValidatedParams,
  ValidatedQuery,
} from '../../common/validation/validated-parameters.js';
import {
  PlayerComparisonDto,
  PlayerComparisonQueryDto,
  PlayerTrendPointDto,
  PlayerTrendQueryDto,
  TeamRankingDto,
  TeamRankingQueryDto,
  TeamTrendPointDto,
  TeamTrendQueryDto,
} from '../dto/analytics.dto.js';
import { AnalyticsService } from '../services/analytics.service.js';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
  ) {}

  @Get('players/:id/trends')
  @CacheControl(CachePolicy.Standard)
  @ApiOperation({
    operationId: 'listPlayerTrends',
    summary: 'List player rolling trend points',
  })
  @ApiParam({ format: 'uuid', name: 'id' })
  @ApiCollectionResponse(PlayerTrendPointDto, 'Player trend points.', true)
  playerTrends(
    @ValidatedParams(UuidParamDto) params: UuidParamDto,
    @ValidatedQuery(PlayerTrendQueryDto) query: PlayerTrendQueryDto,
  ): Promise<PlayerTrendPointDto[]> {
    return this.analytics.playerTrends(params.id, query);
  }

  @Get('player-comparisons')
  @CacheControl(CachePolicy.Standard)
  @ApiOperation({
    operationId: 'comparePlayers',
    summary: 'Compare two to five players',
  })
  @ApiSingleResponse(PlayerComparisonDto, 'A player comparison.')
  comparePlayers(
    @ValidatedQuery(PlayerComparisonQueryDto)
    query: PlayerComparisonQueryDto,
  ): Promise<PlayerComparisonDto> {
    return this.analytics.comparePlayers(query);
  }

  @Get('teams/rankings')
  @CacheControl(CachePolicy.Standard)
  @ApiOperation({
    operationId: 'listTeamRankings',
    summary: 'List dated team power rankings',
  })
  @ApiCollectionResponse(TeamRankingDto, 'Team power rankings.')
  teamRankings(
    @ValidatedQuery(TeamRankingQueryDto) query: TeamRankingQueryDto,
  ): Promise<TeamRankingDto[]> {
    return this.analytics.teamRankings(query);
  }

  @Get('teams/:id/trends')
  @CacheControl(CachePolicy.Standard)
  @ApiOperation({
    operationId: 'listTeamTrends',
    summary: 'List team rolling trend points',
  })
  @ApiParam({ format: 'uuid', name: 'id' })
  @ApiCollectionResponse(TeamTrendPointDto, 'Team trend points.', true)
  teamTrends(
    @ValidatedParams(UuidParamDto) params: UuidParamDto,
    @ValidatedQuery(TeamTrendQueryDto) query: TeamTrendQueryDto,
  ): Promise<TeamTrendPointDto[]> {
    return this.analytics.teamTrends(params.id, query);
  }
}
