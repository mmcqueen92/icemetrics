import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsDateOnly } from '../../common/validation/is-date-only.decorator.js';
import { PlayerSummaryDto } from '../../players/dto/player.dto.js';
import { SeasonSummaryDto } from '../../seasons/dto/season.dto.js';
import { TeamSummaryDto } from '../../teams/dto/team.dto.js';

export enum ComparisonWindow {
  Last10 = '10',
  Last20 = '20',
  Last5 = '5',
  Season = 'season',
}

export class PlayerTrendQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  seasonId!: string;

  @ApiPropertyOptional({ default: 10, enum: [5, 10, 20] })
  @Type(() => Number)
  @IsInt()
  @IsIn([5, 10, 20])
  window = 10;
}

export class PlayerSeasonSummaryQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  seasonId!: string;
}

export class PlayerComparisonQueryDto {
  @ApiProperty({
    description: 'Two to five distinct comma-separated player UUIDs.',
    type: [String],
  })
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  playerIds!: string[];

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  seasonId!: string;

  @ApiPropertyOptional({
    default: ComparisonWindow.Season,
    enum: ComparisonWindow,
  })
  @IsEnum(ComparisonWindow)
  window = ComparisonWindow.Season;
}

export class TeamTrendQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  seasonId!: string;

  @ApiPropertyOptional({ default: 10, enum: [10] })
  @Type(() => Number)
  @IsInt()
  @IsIn([10])
  window = 10;
}

export class TeamRankingQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  seasonId!: string;

  @ApiPropertyOptional({ example: '2025-10-11', format: 'date' })
  @IsOptional()
  @IsDateOnly()
  asOfDate?: string;
}

export class MetricValuesDto {
  @ApiProperty({ nullable: true, type: Number })
  pointsPerGame!: number | null;
  @ApiProperty({ nullable: true, type: Number })
  goalsPerGame!: number | null;
  @ApiProperty({ nullable: true, type: Number })
  assistsPerGame!: number | null;
  @ApiProperty({ nullable: true, type: Number })
  shootingPercentage!: number | null;
  @ApiProperty({ nullable: true, type: Number })
  consistencyScore!: number | null;
}

export class PlayerTrendPointDto {
  @ApiProperty({ format: 'uuid' })
  asOfGameId!: string;
  @ApiProperty({ format: 'date' })
  asOfDate!: string;
  @ApiProperty({ enum: [5, 10, 20] })
  window!: number;
  @ApiProperty()
  sampleSize!: number;
  @ApiProperty({ type: MetricValuesDto })
  metrics!: MetricValuesDto;
  @ApiProperty()
  formulaVersion!: string;
  @ApiProperty({ format: 'date-time' })
  computedAt!: string;
}

export class PlayerComparisonItemDto {
  @ApiProperty({ type: PlayerSummaryDto })
  player!: PlayerSummaryDto;
  @ApiProperty()
  sampleSize!: number;
  @ApiProperty({ type: MetricValuesDto })
  metrics!: MetricValuesDto;
}

export class PlayerSeasonSummaryDto {
  @ApiProperty({ type: PlayerSummaryDto })
  player!: PlayerSummaryDto;
  @ApiProperty({ type: SeasonSummaryDto })
  season!: SeasonSummaryDto;
  @ApiProperty()
  sampleSize!: number;
  @ApiProperty({ type: MetricValuesDto })
  metrics!: MetricValuesDto;
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  dataCutoff!: string | null;
  @ApiProperty()
  formulaVersion!: string;
}

export class PlayerComparisonDto {
  @ApiProperty({ type: SeasonSummaryDto })
  season!: SeasonSummaryDto;
  @ApiProperty({ enum: ComparisonWindow })
  window!: ComparisonWindow;
  @ApiProperty({ type: [PlayerComparisonItemDto] })
  players!: PlayerComparisonItemDto[];
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  dataCutoff!: string | null;
  @ApiProperty()
  formulaVersion!: string;
}

export class TeamTrendPointDto {
  @ApiProperty({ type: TeamSummaryDto })
  team!: TeamSummaryDto;
  @ApiProperty({ format: 'uuid' })
  seasonId!: string;
  @ApiProperty({ format: 'uuid' })
  asOfGameId!: string;
  @ApiProperty({ format: 'date' })
  asOfDate!: string;
  @ApiProperty({ enum: [10] })
  window!: number;
  @ApiProperty()
  sampleSize!: number;
  @ApiProperty()
  pointPercentage!: number;
  @ApiProperty()
  scoringDifferentialPerGame!: number;
  @ApiProperty()
  recentPerformanceTrend!: number;
  @ApiProperty()
  formulaVersion!: string;
  @ApiProperty({ format: 'date-time' })
  computedAt!: string;
}

export class TeamRankingDto {
  @ApiProperty()
  rank!: number;
  @ApiProperty({ type: TeamSummaryDto })
  team!: TeamSummaryDto;
  @ApiProperty({ format: 'uuid' })
  seasonId!: string;
  @ApiProperty({ format: 'date' })
  asOfDate!: string;
  @ApiProperty()
  score!: number;
  @ApiProperty()
  sampleSize!: number;
  @ApiProperty()
  seasonPointPercentage!: number;
  @ApiProperty()
  last10PointPercentage!: number;
  @ApiProperty()
  scoringDifferentialPerGame!: number;
  @ApiProperty()
  formulaVersion!: string;
  @ApiProperty({ format: 'date-time' })
  computedAt!: string;
}
