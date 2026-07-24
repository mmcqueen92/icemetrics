import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  PaginationQueryDto,
  SortOrder,
} from '../../common/pagination/pagination.dto.js';
import { IsDateOnly } from '../../common/validation/is-date-only.decorator.js';
import { RosterPlayerDto, TeamSummaryDto } from '../../teams/dto/team.dto.js';

export enum GameStatusFilter {
  Cancelled = 'CANCELLED',
  Final = 'FINAL',
  Live = 'LIVE',
  Postponed = 'POSTPONED',
  PreGame = 'PRE_GAME',
  Scheduled = 'SCHEDULED',
}

export enum GameTypeFilter {
  AllStar = 'ALL_STAR',
  Playoff = 'PLAYOFF',
  Preseason = 'PRESEASON',
  RegularSeason = 'REGULAR_SEASON',
}

export enum GameSort {
  StartsAt = 'startsAt',
  Status = 'status',
}

export enum PlayerBoxScoreSort {
  LastName = 'lastName',
  Points = 'points',
  Shots = 'shots',
  TimeOnIceSeconds = 'timeOnIceSeconds',
}

export class GameQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  seasonId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  teamId?: string;

  @ApiPropertyOptional({ enum: GameStatusFilter })
  @IsOptional()
  @IsEnum(GameStatusFilter)
  status?: GameStatusFilter;

  @ApiPropertyOptional({ enum: GameTypeFilter })
  @IsOptional()
  @IsEnum(GameTypeFilter)
  gameType?: GameTypeFilter;

  @ApiPropertyOptional({ example: '2025-10-01', format: 'date' })
  @IsOptional()
  @IsDateOnly()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2025-10-31', format: 'date' })
  @IsOptional()
  @IsDateOnly()
  dateTo?: string;

  @ApiPropertyOptional({ default: GameSort.StartsAt, enum: GameSort })
  @IsEnum(GameSort)
  sort = GameSort.StartsAt;

  @ApiPropertyOptional({ default: SortOrder.Desc, enum: SortOrder })
  @IsEnum(SortOrder)
  override order = SortOrder.Desc;
}

export class PlayerBoxScoreQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  teamId?: string;

  @ApiPropertyOptional({
    default: PlayerBoxScoreSort.Points,
    enum: PlayerBoxScoreSort,
  })
  @IsEnum(PlayerBoxScoreSort)
  sort = PlayerBoxScoreSort.Points;

  @ApiPropertyOptional({ default: SortOrder.Desc, enum: SortOrder })
  @IsEnum(SortOrder)
  override order = SortOrder.Desc;
}

export class GameTeamDto {
  @ApiProperty({ type: TeamSummaryDto })
  team!: TeamSummaryDto;

  @ApiProperty({ nullable: true, type: Number })
  score!: number | null;
}

export class GameSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  seasonId!: string;

  @ApiProperty({ example: '2025-10-11T02:00:00.000Z', format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ enum: GameTypeFilter })
  gameType!: string;

  @ApiProperty({ enum: GameStatusFilter })
  status!: string;

  @ApiProperty({ nullable: true, type: String })
  venue!: string | null;

  @ApiProperty({ type: GameTeamDto })
  home!: GameTeamDto;

  @ApiProperty({ type: GameTeamDto })
  away!: GameTeamDto;

  @ApiProperty({
    enum: ['REGULATION', 'OVERTIME', 'SHOOTOUT'],
    nullable: true,
  })
  decisionType!: string | null;
}

export class TeamGameStatDto {
  @ApiProperty({ type: TeamSummaryDto })
  team!: TeamSummaryDto;

  @ApiProperty()
  goalsFor!: number;

  @ApiProperty()
  goalsAgainst!: number;

  @ApiProperty()
  shotsFor!: number;

  @ApiProperty()
  shotsAgainst!: number;

  @ApiProperty()
  powerPlayGoals!: number;

  @ApiProperty()
  powerPlayOpportunities!: number;

  @ApiProperty({ nullable: true, type: Number })
  powerPlayPercentage!: number | null;

  @ApiProperty()
  penaltyMinutes!: number;
}

export class GameDetailDto extends GameSummaryDto {
  @ApiProperty({ isArray: true, type: TeamGameStatDto })
  teamStats!: TeamGameStatDto[];
}

export class PlayerBoxScoreDto {
  @ApiProperty({ type: RosterPlayerDto })
  player!: RosterPlayerDto;

  @ApiProperty({ type: TeamSummaryDto })
  team!: TeamSummaryDto;

  @ApiProperty()
  goals!: number;

  @ApiProperty()
  assists!: number;

  @ApiProperty()
  points!: number;

  @ApiProperty()
  shots!: number;

  @ApiProperty({ nullable: true, type: Number })
  shootingPercentage!: number | null;

  @ApiProperty()
  penaltyMinutes!: number;

  @ApiProperty()
  plusMinus!: number;

  @ApiProperty()
  powerPlayGoals!: number;

  @ApiProperty()
  shortHandedGoals!: number;

  @ApiProperty()
  timeOnIceSeconds!: number;
}
