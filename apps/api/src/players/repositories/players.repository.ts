import { Inject, Injectable } from '@nestjs/common';

import {
  startOfNextUtcDate,
  startOfUtcDate,
} from '../../common/serialization/date.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  type PlayerGameStatsQueryDto,
  type PlayerQueryDto,
  PlayerSort,
} from '../dto/player.dto.js';

interface TeamRecord {
  id: string;
  name: string;
  abbreviation: string;
  city: string;
  active: boolean;
}

export interface PlayerSummaryRecord {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  active: boolean;
  currentTeam: TeamRecord | null;
}

export interface PlayerDetailRecord extends PlayerSummaryRecord {
  shootsCatches: string | null;
  birthDate: Date | null;
}

interface GameRecord {
  id: string;
  seasonId: string;
  startsAt: Date;
  gameType: string;
  status: string;
  venue: string | null;
  homeScore: number | null;
  awayScore: number | null;
  decisionType: string | null;
  homeTeam: TeamRecord;
  awayTeam: TeamRecord;
}

export interface PlayerGameStatRecord {
  teamId: string;
  team: TeamRecord;
  game: GameRecord;
  goals: number;
  assists: number;
  shots: number;
  penaltyMinutes: number;
  plusMinus: number;
  powerPlayGoals: number;
  shortHandedGoals: number;
  timeOnIceSeconds: number;
}

const TEAM_SELECT = {
  abbreviation: true,
  active: true,
  city: true,
  id: true,
  name: true,
} satisfies Prisma.TeamSelect;

const PLAYER_SORT_FIELDS = {
  [PlayerSort.FirstName]: 'firstName',
  [PlayerSort.LastName]: 'lastName',
  [PlayerSort.Position]: 'position',
} as const;

@Injectable()
export class PlayersRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findMany(query: PlayerQueryDto): Promise<{
    items: PlayerSummaryRecord[];
    total: number;
  }> {
    const where: Prisma.PlayerWhereInput = {
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.teamId === undefined ? {} : { currentTeamId: query.teamId }),
      ...(query.position === undefined ? {} : { position: query.position }),
      ...(query.search === undefined
        ? {}
        : {
            AND: query.search.split(/\s+/).map((token) => ({
              OR: [
                {
                  firstName: { contains: token, mode: 'insensitive' as const },
                },
                { lastName: { contains: token, mode: 'insensitive' as const } },
              ],
            })),
          }),
    };
    const sortField = PLAYER_SORT_FIELDS[query.sort];
    const orderBy: Prisma.PlayerOrderByWithRelationInput[] = [
      { [sortField]: query.order },
      { id: query.order },
    ];
    const total = await this.prisma.player.count({ where });
    const items = await this.prisma.player.findMany({
      orderBy,
      select: {
        active: true,
        currentTeam: { select: TEAM_SELECT },
        firstName: true,
        id: true,
        lastName: true,
        position: true,
      },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where,
    });
    return { items, total };
  }

  findById(id: string): Promise<PlayerDetailRecord | null> {
    return this.prisma.player.findUnique({
      select: {
        active: true,
        birthDate: true,
        currentTeam: { select: TEAM_SELECT },
        firstName: true,
        id: true,
        lastName: true,
        position: true,
        shootsCatches: true,
      },
      where: { id },
    });
  }

  async findGameStats(
    playerId: string,
    query: PlayerGameStatsQueryDto,
  ): Promise<{ items: PlayerGameStatRecord[]; total: number }> {
    const startsAt: Prisma.DateTimeFilter = {};
    if (query.dateFrom !== undefined) {
      startsAt.gte = startOfUtcDate(query.dateFrom);
    }
    if (query.dateTo !== undefined) {
      startsAt.lt = startOfNextUtcDate(query.dateTo);
    }
    const where: Prisma.PlayerGameStatWhereInput = {
      game: {
        seasonId: query.seasonId,
        ...(query.dateFrom === undefined && query.dateTo === undefined
          ? {}
          : { startsAt }),
      },
      playerId,
    };
    const orderBy: Prisma.PlayerGameStatOrderByWithRelationInput[] = [
      { game: { startsAt: query.order } },
      { id: query.order },
    ];
    const total = await this.prisma.playerGameStat.count({ where });
    const items = await this.prisma.playerGameStat.findMany({
      orderBy,
      select: {
        assists: true,
        game: {
          select: {
            awayScore: true,
            awayTeam: { select: TEAM_SELECT },
            decisionType: true,
            gameType: true,
            homeScore: true,
            homeTeam: { select: TEAM_SELECT },
            id: true,
            seasonId: true,
            startsAt: true,
            status: true,
            venue: true,
          },
        },
        goals: true,
        penaltyMinutes: true,
        plusMinus: true,
        powerPlayGoals: true,
        shortHandedGoals: true,
        shots: true,
        team: { select: TEAM_SELECT },
        teamId: true,
        timeOnIceSeconds: true,
      },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where,
    });
    return { items, total };
  }

  async exists(id: string): Promise<boolean> {
    return (await this.prisma.player.count({ where: { id } })) > 0;
  }
}
