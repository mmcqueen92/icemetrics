import { Inject, Injectable } from '@nestjs/common';

import { startOfUtcDate } from '../../common/serialization/date.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { type StandingQueryDto, StandingSort } from '../dto/standing.dto.js';

export interface StandingRecord {
  team: {
    id: string;
    name: string;
    abbreviation: string;
    city: string;
    active: boolean;
  };
  seasonId: string;
  asOfDate: Date;
  gamesPlayed: number;
  wins: number;
  losses: number;
  overtimeLosses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  leagueRank: number;
  conferenceRank: number | null;
  divisionRank: number | null;
  pointPercentage: Prisma.Decimal;
  sourceCutoff: Date;
}

const SCALAR_SORT_FIELDS = {
  [StandingSort.LeagueRank]: 'leagueRank',
  [StandingSort.PointPercentage]: 'pointPercentage',
  [StandingSort.Points]: 'points',
} as const;

@Injectable()
export class StandingsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findMany(query: StandingQueryDto): Promise<{
    items: StandingRecord[];
    total: number;
  }> {
    const selectedDate =
      query.asOfDate === undefined
        ? await this.latestDate(query.seasonId)
        : startOfUtcDate(query.asOfDate);

    if (selectedDate === null) {
      return { items: [], total: 0 };
    }

    const where: Prisma.TeamStandingSnapshotWhereInput = {
      asOfDate: selectedDate,
      seasonId: query.seasonId,
    };
    const orderBy: Prisma.TeamStandingSnapshotOrderByWithRelationInput[] =
      query.sort === StandingSort.Name
        ? [{ team: { name: query.order } }, { id: query.order }]
        : [
            { [SCALAR_SORT_FIELDS[query.sort]]: query.order },
            { id: query.order },
          ];
    const total = await this.prisma.teamStandingSnapshot.count({ where });
    const items = await this.prisma.teamStandingSnapshot.findMany({
      orderBy,
      select: {
        asOfDate: true,
        conferenceRank: true,
        divisionRank: true,
        gamesPlayed: true,
        goalsAgainst: true,
        goalsFor: true,
        leagueRank: true,
        losses: true,
        overtimeLosses: true,
        pointPercentage: true,
        points: true,
        seasonId: true,
        sourceCutoff: true,
        team: {
          select: {
            abbreviation: true,
            active: true,
            city: true,
            id: true,
            name: true,
          },
        },
        wins: true,
      },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where,
    });
    return { items, total };
  }

  private async latestDate(seasonId: string): Promise<Date | null> {
    const result = await this.prisma.teamStandingSnapshot.aggregate({
      _max: { asOfDate: true },
      where: { seasonId },
    });
    return result._max.asOfDate;
  }
}
