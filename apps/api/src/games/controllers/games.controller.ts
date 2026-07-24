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
  GameDetailDto,
  GameQueryDto,
  GameSummaryDto,
  PlayerBoxScoreDto,
  PlayerBoxScoreQueryDto,
} from '../dto/game.dto.js';
import { GamesService } from '../services/games.service.js';

@ApiTags('Games')
@Controller('games')
export class GamesController {
  constructor(@Inject(GamesService) private readonly games: GamesService) {}

  @Get()
  @CacheControl(CachePolicy.Live)
  @ApiOperation({
    operationId: 'listGames',
    summary: 'List games',
    description:
      'Returns a bounded, paginated game collection. Cached for 60 seconds.',
  })
  @ApiPaginatedResponse(GameSummaryDto, 'A paginated game collection.')
  findMany(
    @ValidatedQuery(GameQueryDto) query: GameQueryDto,
  ): Promise<PaginatedResult<GameSummaryDto>> {
    return this.games.findMany(query);
  }

  @Get(':id')
  @CacheControl(CachePolicy.Game)
  @ApiOperation({
    operationId: 'getGame',
    summary: 'Get a game',
    description:
      'Returns a game and team statistics. Final games are cached for 3600 seconds; other games for 60 seconds.',
  })
  @ApiParam({ format: 'uuid', name: 'id' })
  @ApiSingleResponse(GameDetailDto, 'The requested game.')
  findById(
    @ValidatedParams(UuidParamDto) params: UuidParamDto,
  ): Promise<GameDetailDto> {
    return this.games.findById(params.id);
  }

  @Get(':id/player-stats')
  @CacheControl(CachePolicy.Historical)
  @ApiOperation({
    operationId: 'listGamePlayerStats',
    summary: 'List game player statistics',
    description:
      'Returns a paginated player box score. Cached for 3600 seconds.',
  })
  @ApiParam({ format: 'uuid', name: 'id' })
  @ApiPaginatedResponse(
    PlayerBoxScoreDto,
    'A paginated player box-score collection.',
    true,
  )
  findPlayerStats(
    @ValidatedParams(UuidParamDto) params: UuidParamDto,
    @ValidatedQuery(PlayerBoxScoreQueryDto) query: PlayerBoxScoreQueryDto,
  ): Promise<PaginatedResult<PlayerBoxScoreDto>> {
    return this.games.findPlayerStats(params.id, query);
  }
}
