import { IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  PaginationQueryDto,
  SortOrder,
} from '../../common/pagination/pagination.dto.js';

export enum LeagueSort {
  Code = 'code',
  Name = 'name',
}

export class LeagueQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ default: LeagueSort.Name, enum: LeagueSort })
  @IsEnum(LeagueSort)
  sort = LeagueSort.Name;

  override order = SortOrder.Asc;
}

export class LeagueSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'NHL' })
  code!: string;

  @ApiProperty({ example: 'National Hockey League' })
  name!: string;
}
