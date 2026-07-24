import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  PaginationQueryDto,
  SortOrder,
} from '../../common/pagination/pagination.dto.js';
import { IsDateOnly } from '../../common/validation/is-date-only.decorator.js';
import { TeamSummaryDto } from '../../teams/dto/team.dto.js';

export enum StandingSort {
  LeagueRank = 'leagueRank',
  Name = 'name',
  PointPercentage = 'pointPercentage',
  Points = 'points',
}

export class StandingQueryDto extends PaginationQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  seasonId!: string;

  @ApiPropertyOptional({ example: '2025-10-11', format: 'date' })
  @IsOptional()
  @IsDateOnly()
  asOfDate?: string;

  @ApiPropertyOptional({
    default: StandingSort.LeagueRank,
    enum: StandingSort,
  })
  @IsEnum(StandingSort)
  sort = StandingSort.LeagueRank;

  override order = SortOrder.Asc;
}

export class StandingDto {
  @ApiProperty({ type: TeamSummaryDto })
  team!: TeamSummaryDto;

  @ApiProperty({ format: 'uuid' })
  seasonId!: string;

  @ApiProperty({ example: '2025-10-11', format: 'date' })
  asOfDate!: string;

  @ApiProperty()
  gamesPlayed!: number;

  @ApiProperty()
  wins!: number;

  @ApiProperty()
  losses!: number;

  @ApiProperty()
  overtimeLosses!: number;

  @ApiProperty()
  points!: number;

  @ApiProperty()
  goalsFor!: number;

  @ApiProperty()
  goalsAgainst!: number;

  @ApiProperty()
  leagueRank!: number;

  @ApiProperty({ nullable: true, type: Number })
  conferenceRank!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  divisionRank!: number | null;

  @ApiProperty()
  pointPercentage!: number;

  @ApiProperty({ format: 'date-time' })
  sourceCutoff!: string;
}
