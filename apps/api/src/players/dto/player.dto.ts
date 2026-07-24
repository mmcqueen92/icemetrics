import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { GameSummaryDto } from '../../games/dto/game.dto.js';
import {
  PaginationQueryDto,
  SortOrder,
} from '../../common/pagination/pagination.dto.js';
import { IsDateOnly } from '../../common/validation/is-date-only.decorator.js';
import {
  toStrictBoolean,
  trimString,
} from '../../common/validation/query-transformers.js';
import { TeamSummaryDto } from '../../teams/dto/team.dto.js';

export enum PlayerPosition {
  Center = 'C',
  Defense = 'D',
  Goaltender = 'G',
  LeftWing = 'L',
  RightWing = 'R',
}

export enum PlayerSort {
  FirstName = 'firstName',
  LastName = 'lastName',
  Position = 'position',
}

export enum PlayerGameStatSort {
  GameDate = 'gameDate',
}

export class PlayerQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 100, minLength: 2 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  teamId?: string;

  @ApiPropertyOptional({ enum: PlayerPosition })
  @IsOptional()
  @IsEnum(PlayerPosition)
  position?: PlayerPosition;

  @ApiPropertyOptional({ type: Boolean })
  @Transform(toStrictBoolean)
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: PlayerSort.LastName, enum: PlayerSort })
  @IsEnum(PlayerSort)
  sort = PlayerSort.LastName;

  override order = SortOrder.Asc;
}

export class PlayerGameStatsQueryDto extends PaginationQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  seasonId!: string;

  @ApiPropertyOptional({ example: '2025-10-01', format: 'date' })
  @IsOptional()
  @IsDateOnly()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2025-10-31', format: 'date' })
  @IsOptional()
  @IsDateOnly()
  dateTo?: string;

  @ApiPropertyOptional({ default: 50, maximum: 100, minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  override pageSize = 50;

  @ApiPropertyOptional({
    default: PlayerGameStatSort.GameDate,
    enum: PlayerGameStatSort,
  })
  @IsEnum(PlayerGameStatSort)
  sort = PlayerGameStatSort.GameDate;

  @ApiPropertyOptional({ default: SortOrder.Desc, enum: SortOrder })
  @IsEnum(SortOrder)
  override order = SortOrder.Desc;
}

export class PlayerSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Alex' })
  firstName!: string;

  @ApiProperty({ example: 'Mercer' })
  lastName!: string;

  @ApiProperty({ enum: PlayerPosition, nullable: true })
  position!: string | null;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({ nullable: true, type: TeamSummaryDto })
  currentTeam!: TeamSummaryDto | null;
}

export class PlayerDetailDto extends PlayerSummaryDto {
  @ApiProperty({ enum: ['L', 'R'], nullable: true })
  shootsCatches!: string | null;

  @ApiProperty({ example: '1998-03-11', format: 'date', nullable: true })
  birthDate!: string | null;
}

export class PlayerGameStatDto {
  @ApiProperty({ type: GameSummaryDto })
  game!: GameSummaryDto;

  @ApiProperty({ type: TeamSummaryDto })
  team!: TeamSummaryDto;

  @ApiProperty({ type: TeamSummaryDto })
  opponent!: TeamSummaryDto;

  @ApiProperty()
  isHome!: boolean;

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
