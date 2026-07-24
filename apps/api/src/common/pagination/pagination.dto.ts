import { Type } from 'class-transformer';
import { IsEnum, IsInt, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    default: 25,
    maximum: 100,
    minimum: 1,
    type: Number,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @ApiPropertyOptional({
    default: SortOrder.Asc,
    enum: SortOrder,
  })
  @IsEnum(SortOrder)
  order = SortOrder.Asc;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1, minimum: 1 })
  page!: number;

  @ApiProperty({ example: 25, maximum: 100, minimum: 1 })
  pageSize!: number;

  @ApiProperty({ example: 0, minimum: 0 })
  totalItems!: number;

  @ApiProperty({ example: 0, minimum: 0 })
  totalPages!: number;

  @ApiProperty({ example: 'lastName' })
  sort!: string;

  @ApiProperty({ enum: SortOrder })
  order!: SortOrder;
}
