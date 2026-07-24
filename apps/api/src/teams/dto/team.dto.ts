import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { LeagueSummaryDto } from '../../leagues/dto/league.dto.js';
import {
  PaginationQueryDto,
  SortOrder,
} from '../../common/pagination/pagination.dto.js';
import { toStrictBoolean } from '../../common/validation/query-transformers.js';

export enum TeamSort {
  Abbreviation = 'abbreviation',
  City = 'city',
  Name = 'name',
}

export enum RosterSort {
  LastName = 'lastName',
  Position = 'position',
}

export class TeamQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  leagueId?: string;

  @ApiPropertyOptional({ type: Boolean })
  @Transform(toStrictBoolean)
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: TeamSort.Name, enum: TeamSort })
  @IsEnum(TeamSort)
  sort = TeamSort.Name;

  override order = SortOrder.Asc;
}

export class RosterQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ default: true, type: Boolean })
  @Transform(toStrictBoolean)
  @IsBoolean()
  active = true;

  @ApiPropertyOptional({ default: RosterSort.LastName, enum: RosterSort })
  @IsEnum(RosterSort)
  sort = RosterSort.LastName;

  override order = SortOrder.Asc;
}

export class TeamSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Canucks' })
  name!: string;

  @ApiProperty({ example: 'VAN' })
  abbreviation!: string;

  @ApiProperty({ example: 'Vancouver' })
  city!: string;

  @ApiProperty()
  active!: boolean;
}

export class TeamDetailDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: LeagueSummaryDto })
  league!: LeagueSummaryDto;

  @ApiProperty({ example: 'Canucks' })
  name!: string;

  @ApiProperty({ example: 'VAN' })
  abbreviation!: string;

  @ApiProperty({ example: 'Vancouver' })
  city!: string;

  @ApiProperty()
  active!: boolean;
}

export class RosterPlayerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Alex' })
  firstName!: string;

  @ApiProperty({ example: 'Mercer' })
  lastName!: string;

  @ApiProperty({ enum: ['C', 'L', 'R', 'D', 'G'], nullable: true })
  position!: string | null;

  @ApiProperty({ enum: ['L', 'R'], nullable: true })
  shootsCatches!: string | null;

  @ApiProperty()
  active!: boolean;
}
