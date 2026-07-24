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
  PlayerDetailDto,
  PlayerGameStatDto,
  PlayerGameStatsQueryDto,
  PlayerQueryDto,
  PlayerSummaryDto,
} from '../dto/player.dto.js';
import { PlayersService } from '../services/players.service.js';

@ApiTags('Players')
@Controller('players')
export class PlayersController {
  constructor(
    @Inject(PlayersService) private readonly players: PlayersService,
  ) {}

  @Get()
  @CacheControl(CachePolicy.Standard)
  @ApiOperation({
    operationId: 'listPlayers',
    summary: 'List and search players',
    description:
      'Returns a filtered, paginated player collection. Cached for 300 seconds.',
  })
  @ApiPaginatedResponse(PlayerSummaryDto, 'A paginated player collection.')
  findMany(
    @ValidatedQuery(PlayerQueryDto) query: PlayerQueryDto,
  ): Promise<PaginatedResult<PlayerSummaryDto>> {
    return this.players.findMany(query);
  }

  @Get(':id')
  @CacheControl(CachePolicy.Standard)
  @ApiOperation({
    operationId: 'getPlayer',
    summary: 'Get a player',
    description: 'Returns one player profile. Cached for 300 seconds.',
  })
  @ApiParam({ format: 'uuid', name: 'id' })
  @ApiSingleResponse(PlayerDetailDto, 'The requested player.')
  findById(
    @ValidatedParams(UuidParamDto) params: UuidParamDto,
  ): Promise<PlayerDetailDto> {
    return this.players.findById(params.id);
  }

  @Get(':id/stats')
  @CacheControl(CachePolicy.Historical)
  @ApiOperation({
    operationId: 'listPlayerGameStats',
    summary: 'List player game statistics',
    description:
      'Returns paginated game-by-game player statistics. Cached for 3600 seconds.',
  })
  @ApiParam({ format: 'uuid', name: 'id' })
  @ApiPaginatedResponse(
    PlayerGameStatDto,
    'A paginated player game-statistics collection.',
    true,
  )
  findGameStats(
    @ValidatedParams(UuidParamDto) params: UuidParamDto,
    @ValidatedQuery(PlayerGameStatsQueryDto) query: PlayerGameStatsQueryDto,
  ): Promise<PaginatedResult<PlayerGameStatDto>> {
    return this.players.findGameStats(params.id, query);
  }
}
