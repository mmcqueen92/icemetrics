import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  PaginationQueryDto,
  SortOrder,
} from '../../common/pagination/pagination.dto.js';
import { IsDateOnly } from '../../common/validation/is-date-only.decorator.js';

export enum SeasonSort {
  Label = 'label',
  StartDate = 'startDate',
}

export class SeasonQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  leagueId?: string;

  @ApiPropertyOptional({ example: '2026-01-15', format: 'date' })
  @IsOptional()
  @IsDateOnly()
  activeOn?: string;

  @ApiPropertyOptional({
    default: SeasonSort.StartDate,
    enum: SeasonSort,
  })
  @IsEnum(SeasonSort)
  sort = SeasonSort.StartDate;

  @ApiPropertyOptional({ default: SortOrder.Desc, enum: SortOrder })
  @IsEnum(SortOrder)
  override order = SortOrder.Desc;
}

export class SeasonSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  leagueId!: string;

  @ApiProperty({ example: '2025-2026' })
  label!: string;

  @ApiProperty({ example: '2025-10-07', format: 'date' })
  startDate!: string;

  @ApiProperty({ example: '2026-06-30', format: 'date' })
  endDate!: string;
}
