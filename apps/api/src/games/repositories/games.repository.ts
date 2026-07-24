import { Inject, Injectable } from '@nestjs/common';

import {
  startOfNextUtcDate,
  startOfUtcDate,
} from '../../common/serialization/date.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { Prisma as PrismaNamespace } from '../../generated/prisma/client.js';
import {
  type GameQueryDto,
  GameSort,
  type PlayerBoxScoreQueryDto,
  PlayerBoxScoreSort,
} from '../dto/game.dto.js';

interface TeamRecord {
  id: string;
  name: string;
  abbreviation: string;
  city: string;
  active: boolean;
}

export interface GameRecord {
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

export interface TeamGameStatRecord {
  goalsFor: number;
  goalsAgainst: number;
  shotsFor: number;
  shotsAgainst: number;
  powerPlayGoals: number;
  powerPlayOpportunities: number;
  penaltyMinutes: number;
  team: TeamRecord;
}

export interface GameDetailRecord extends GameRecord {
  teamStats: TeamGameStatRecord[];
}

export interface PlayerBoxScoreRecord {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string | null;
  shootsCatches: string | null;
  playerActive: boolean;
  teamId: string;
  teamName: string;
  teamAbbreviation: string;
  teamCity: string;
  teamActive: boolean;
  goals: number;
  assists: number;
  points: number;
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

const GAME_SORT_FIELDS = {
  [GameSort.StartsAt]: 'startsAt',
  [GameSort.Status]: 'status',
} as const;

const BOX_SCORE_SORT_EXPRESSIONS = {
  [PlayerBoxScoreSort.LastName]: PrismaNamespace.sql`p.last_name`,
  [PlayerBoxScoreSort.Points]: PrismaNamespace.sql`(pgs.goals + pgs.assists)`,
  [PlayerBoxScoreSort.Shots]: PrismaNamespace.sql`pgs.shots`,
  [PlayerBoxScoreSort.TimeOnIceSeconds]: PrismaNamespace.sql`pgs.time_on_ice_seconds`,
} as const;

@Injectable()
export class GamesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findMany(query: GameQueryDto): Promise<{
    items: GameRecord[];
    total: number;
  }> {
    const startsAt: Prisma.DateTimeFilter = {};
    if (query.dateFrom !== undefined) {
      startsAt.gte = startOfUtcDate(query.dateFrom);
    }
    if (query.dateTo !== undefined) {
      startsAt.lt = startOfNextUtcDate(query.dateTo);
    }
    const where: Prisma.GameWhereInput = {
      ...(query.gameType === undefined ? {} : { gameType: query.gameType }),
      ...(query.seasonId === undefined ? {} : { seasonId: query.seasonId }),
      ...(query.dateFrom === undefined && query.dateTo === undefined
        ? {}
        : { startsAt }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.teamId === undefined
        ? {}
        : {
            OR: [{ awayTeamId: query.teamId }, { homeTeamId: query.teamId }],
          }),
    };
    const sortField = GAME_SORT_FIELDS[query.sort];
    const orderBy: Prisma.GameOrderByWithRelationInput[] = [
      { [sortField]: query.order },
      { id: query.order },
    ];
    const total = await this.prisma.game.count({ where });
    const items = await this.prisma.game.findMany({
      orderBy,
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
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where,
    });
    return { items, total };
  }

  findById(id: string): Promise<GameDetailRecord | null> {
    return this.prisma.game.findUnique({
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
        teamStats: {
          orderBy: { teamId: 'asc' },
          select: {
            goalsAgainst: true,
            goalsFor: true,
            penaltyMinutes: true,
            powerPlayGoals: true,
            powerPlayOpportunities: true,
            shotsAgainst: true,
            shotsFor: true,
            team: { select: TEAM_SELECT },
          },
        },
        venue: true,
      },
      where: { id },
    });
  }

  async findPlayerStats(
    gameId: string,
    query: PlayerBoxScoreQueryDto,
  ): Promise<{ items: PlayerBoxScoreRecord[]; total: number }> {
    const teamId = query.teamId ?? null;
    const direction = PrismaNamespace.raw(query.order.toUpperCase());
    const orderExpression = BOX_SCORE_SORT_EXPRESSIONS[query.sort];
    const offset = (query.page - 1) * query.pageSize;
    const countRows = await this.prisma.$queryRaw<[{ total: bigint }]>(
      PrismaNamespace.sql`
          SELECT count(*)::bigint AS total
          FROM core.player_game_stat pgs
          WHERE pgs.game_id = ${gameId}::uuid
            AND (${teamId}::uuid IS NULL OR pgs.team_id = ${teamId}::uuid)
        `,
    );
    const items = await this.prisma.$queryRaw<PlayerBoxScoreRecord[]>(
      PrismaNamespace.sql`
          SELECT
            p.id AS "playerId",
            p.first_name AS "firstName",
            p.last_name AS "lastName",
            p.position,
            p.shoots_catches AS "shootsCatches",
            p.active AS "playerActive",
            t.id AS "teamId",
            t.name AS "teamName",
            t.abbreviation AS "teamAbbreviation",
            t.city AS "teamCity",
            t.active AS "teamActive",
            pgs.goals,
            pgs.assists,
            (pgs.goals + pgs.assists) AS points,
            pgs.shots,
            pgs.penalty_minutes AS "penaltyMinutes",
            pgs.plus_minus AS "plusMinus",
            pgs.power_play_goals AS "powerPlayGoals",
            pgs.short_handed_goals AS "shortHandedGoals",
            pgs.time_on_ice_seconds AS "timeOnIceSeconds"
          FROM core.player_game_stat pgs
          JOIN core.player p ON p.id = pgs.player_id
          JOIN core.team t ON t.id = pgs.team_id
          WHERE pgs.game_id = ${gameId}::uuid
            AND (${teamId}::uuid IS NULL OR pgs.team_id = ${teamId}::uuid)
          ORDER BY ${orderExpression} ${direction}, p.id ${direction}
          LIMIT ${query.pageSize}
          OFFSET ${offset}
        `,
    );
    return {
      items,
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  async exists(id: string): Promise<boolean> {
    return (await this.prisma.game.count({ where: { id } })) > 0;
  }
}
