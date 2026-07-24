import { Inject, Injectable } from '@nestjs/common';

import { startOfUtcDate } from '../../common/serialization/date.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { type SeasonQueryDto, SeasonSort } from '../dto/season.dto.js';

export interface SeasonRecord {
  id: string;
  leagueId: string;
  label: string;
  startDate: Date;
  endDate: Date;
}

const SORT_FIELDS = {
  [SeasonSort.Label]: 'label',
  [SeasonSort.StartDate]: 'startDate',
} as const;

@Injectable()
export class SeasonsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findMany(query: SeasonQueryDto): Promise<{
    items: SeasonRecord[];
    total: number;
  }> {
    const activeOn =
      query.activeOn === undefined ? undefined : startOfUtcDate(query.activeOn);
    const where: Prisma.SeasonWhereInput = {
      ...(activeOn === undefined
        ? {}
        : {
            endDate: { gte: activeOn },
            startDate: { lte: activeOn },
          }),
      ...(query.leagueId === undefined ? {} : { leagueId: query.leagueId }),
    };
    const sortField = SORT_FIELDS[query.sort];
    const orderBy: Prisma.SeasonOrderByWithRelationInput[] = [
      { [sortField]: query.order },
      { id: query.order },
    ];
    const total = await this.prisma.season.count({ where });
    const items = await this.prisma.season.findMany({
      orderBy,
      select: {
        endDate: true,
        id: true,
        label: true,
        leagueId: true,
        startDate: true,
      },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where,
    });
    return { items, total };
  }

  findById(id: string): Promise<SeasonRecord | null> {
    return this.prisma.season.findUnique({
      select: {
        endDate: true,
        id: true,
        label: true,
        leagueId: true,
        startDate: true,
      },
      where: { id },
    });
  }
}
