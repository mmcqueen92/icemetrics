import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  type RosterQueryDto,
  RosterSort,
  type TeamQueryDto,
  TeamSort,
} from '../dto/team.dto.js';

export interface TeamSummaryRecord {
  id: string;
  name: string;
  abbreviation: string;
  city: string;
  active: boolean;
}

export interface TeamDetailRecord extends TeamSummaryRecord {
  league: {
    id: string;
    code: string;
    name: string;
  };
}

export interface RosterPlayerRecord {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  shootsCatches: string | null;
  active: boolean;
}

const TEAM_SORT_FIELDS = {
  [TeamSort.Abbreviation]: 'abbreviation',
  [TeamSort.City]: 'city',
  [TeamSort.Name]: 'name',
} as const;

const ROSTER_SORT_FIELDS = {
  [RosterSort.LastName]: 'lastName',
  [RosterSort.Position]: 'position',
} as const;

@Injectable()
export class TeamsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findMany(query: TeamQueryDto): Promise<{
    items: TeamSummaryRecord[];
    total: number;
  }> {
    const where: Prisma.TeamWhereInput = {
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.leagueId === undefined ? {} : { leagueId: query.leagueId }),
    };
    const sortField = TEAM_SORT_FIELDS[query.sort];
    const orderBy: Prisma.TeamOrderByWithRelationInput[] = [
      { [sortField]: query.order },
      { id: query.order },
    ];
    const total = await this.prisma.team.count({ where });
    const items = await this.prisma.team.findMany({
      orderBy,
      select: {
        abbreviation: true,
        active: true,
        city: true,
        id: true,
        name: true,
      },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where,
    });
    return { items, total };
  }

  findById(id: string): Promise<TeamDetailRecord | null> {
    return this.prisma.team.findUnique({
      select: {
        abbreviation: true,
        active: true,
        city: true,
        id: true,
        league: {
          select: {
            code: true,
            id: true,
            name: true,
          },
        },
        name: true,
      },
      where: { id },
    });
  }

  async findRoster(
    teamId: string,
    query: RosterQueryDto,
  ): Promise<{ items: RosterPlayerRecord[]; total: number }> {
    const where: Prisma.PlayerWhereInput = {
      active: query.active,
      currentTeamId: teamId,
    };
    const sortField = ROSTER_SORT_FIELDS[query.sort];
    const orderBy: Prisma.PlayerOrderByWithRelationInput[] = [
      { [sortField]: query.order },
      { id: query.order },
    ];
    const total = await this.prisma.player.count({ where });
    const items = await this.prisma.player.findMany({
      orderBy,
      select: {
        active: true,
        firstName: true,
        id: true,
        lastName: true,
        position: true,
        shootsCatches: true,
      },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where,
    });
    return { items, total };
  }

  async exists(id: string): Promise<boolean> {
    return (await this.prisma.team.count({ where: { id } })) > 0;
  }
}
