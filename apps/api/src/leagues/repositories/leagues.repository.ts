import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { type LeagueQueryDto, LeagueSort } from '../dto/league.dto.js';

export interface LeagueSummaryRecord {
  id: string;
  code: string;
  name: string;
}

const SORT_FIELDS = {
  [LeagueSort.Code]: 'code',
  [LeagueSort.Name]: 'name',
} as const;

@Injectable()
export class LeaguesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findMany(query: LeagueQueryDto): Promise<{
    items: LeagueSummaryRecord[];
    total: number;
  }> {
    const sortField = SORT_FIELDS[query.sort];
    const orderBy: Prisma.LeagueOrderByWithRelationInput[] = [
      { [sortField]: query.order },
      { id: query.order },
    ];
    const total = await this.prisma.league.count();
    const items = await this.prisma.league.findMany({
      orderBy,
      select: { code: true, id: true, name: true },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return { items, total };
  }
}
