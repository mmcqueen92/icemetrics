import { Inject, Injectable } from '@nestjs/common';

import { startOfUtcDate } from '../../common/serialization/date.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  GameStatus,
  GameType,
  MetricWindow,
  type Prisma,
} from '../../generated/prisma/client.js';
import { ANALYTICS_FORMULA_VERSION } from '../domain/analytics-metrics.js';

const TEAM_SELECT = {
  abbreviation: true,
  active: true,
  city: true,
  id: true,
  name: true,
} satisfies Prisma.TeamSelect;

const PLAYER_SELECT = {
  active: true,
  currentTeam: { select: TEAM_SELECT },
  firstName: true,
  id: true,
  lastName: true,
  position: true,
} satisfies Prisma.PlayerSelect;

const ELIGIBLE_GAME_WHERE = {
  gameType: { in: [GameType.REGULAR_SEASON, GameType.PLAYOFF] },
  status: GameStatus.FINAL,
} satisfies Prisma.GameWhereInput;

@Injectable()
export class AnalyticsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findPlayer(id: string) {
    return this.prisma.player.findUnique({
      select: PLAYER_SELECT,
      where: { id },
    });
  }

  findPlayers(ids: readonly string[]) {
    return this.prisma.player.findMany({
      orderBy: { id: 'asc' },
      select: PLAYER_SELECT,
      where: { id: { in: [...ids] } },
    });
  }

  findTeam(id: string) {
    return this.prisma.team.findUnique({
      select: TEAM_SELECT,
      where: { id },
    });
  }

  findSeason(id: string) {
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

  findPlayerTrend(playerId: string, seasonId: string, window: MetricWindow) {
    return this.prisma.playerMetricSnapshot.findMany({
      orderBy: [
        { asOfGame: { startsAt: 'asc' } },
        { asOfGameId: 'asc' },
        { metricCode: 'asc' },
      ],
      select: {
        asOfGame: { select: { startsAt: true } },
        asOfGameId: true,
        computedAt: true,
        formulaVersion: true,
        metricCode: true,
        sampleSize: true,
        value: true,
      },
      where: {
        formulaVersion: ANALYTICS_FORMULA_VERSION,
        playerId,
        seasonId,
        window,
      },
    });
  }

  findTeamTrend(teamId: string, seasonId: string) {
    return this.prisma.teamMetricSnapshot.findMany({
      orderBy: [
        { asOfGame: { startsAt: 'asc' } },
        { asOfGameId: 'asc' },
        { metricCode: 'asc' },
      ],
      select: {
        asOfGame: { select: { startsAt: true } },
        asOfGameId: true,
        computedAt: true,
        formulaVersion: true,
        metricCode: true,
        sampleSize: true,
        value: true,
      },
      where: {
        formulaVersion: ANALYTICS_FORMULA_VERSION,
        seasonId,
        teamId,
        window: MetricWindow.LAST_10,
      },
    });
  }

  findPlayerSeasonStats(playerIds: readonly string[], seasonId: string) {
    return this.prisma.playerGameStat.findMany({
      orderBy: [{ game: { startsAt: 'asc' } }, { gameId: 'asc' }],
      select: {
        assists: true,
        game: { select: { id: true, startsAt: true } },
        goals: true,
        playerId: true,
        shots: true,
      },
      where: {
        game: { ...ELIGIBLE_GAME_WHERE, seasonId },
        playerId: { in: [...playerIds] },
      },
    });
  }

  findPlayerRollingSnapshots(
    playerIds: readonly string[],
    seasonId: string,
    window: MetricWindow,
  ) {
    return this.prisma.playerMetricSnapshot.findMany({
      orderBy: [
        { asOfGame: { startsAt: 'desc' } },
        { asOfGameId: 'desc' },
        { metricCode: 'asc' },
      ],
      select: {
        asOfGame: { select: { startsAt: true } },
        asOfGameId: true,
        computedAt: true,
        formulaVersion: true,
        metricCode: true,
        playerId: true,
        sampleSize: true,
        value: true,
      },
      where: {
        formulaVersion: ANALYTICS_FORMULA_VERSION,
        playerId: { in: [...playerIds] },
        seasonId,
        window,
      },
    });
  }

  async findRankings(seasonId: string, asOfDate?: string) {
    const selectedDate =
      asOfDate === undefined
        ? (
            await this.prisma.teamRankingSnapshot.aggregate({
              _max: { asOfDate: true },
              where: {
                formulaVersion: ANALYTICS_FORMULA_VERSION,
                rankingCode: 'team.powerRanking',
                seasonId,
              },
            })
          )._max.asOfDate
        : startOfUtcDate(asOfDate);
    if (selectedDate === null) {
      return { date: null, rows: [] };
    }
    const rows = await this.prisma.teamRankingSnapshot.findMany({
      orderBy: { rank: 'asc' },
      select: {
        asOfDate: true,
        computedAt: true,
        formulaVersion: true,
        rank: true,
        sampleSize: true,
        score: true,
        team: { select: TEAM_SELECT },
        teamId: true,
      },
      where: {
        asOfDate: selectedDate,
        formulaVersion: ANALYTICS_FORMULA_VERSION,
        rankingCode: 'team.powerRanking',
        seasonId,
      },
    });
    return { date: selectedDate, rows };
  }

  findTeamSeasonStats(seasonId: string, cutoff: Date) {
    return this.prisma.teamGameStat.findMany({
      orderBy: [{ game: { startsAt: 'asc' } }, { gameId: 'asc' }],
      select: {
        game: {
          select: { decisionType: true, id: true, startsAt: true },
        },
        goalsAgainst: true,
        goalsFor: true,
        teamId: true,
      },
      where: {
        game: {
          ...ELIGIBLE_GAME_WHERE,
          seasonId,
          startsAt: { lt: new Date(cutoff.getTime() + 86_400_000) },
        },
      },
    });
  }

  findOfficialStandings(seasonId: string, cutoff: Date) {
    return this.prisma.teamStandingSnapshot.findMany({
      orderBy: [{ asOfDate: 'desc' }, { teamId: 'asc' }],
      select: {
        asOfDate: true,
        pointPercentage: true,
        points: true,
        teamId: true,
      },
      where: { asOfDate: { lte: cutoff }, seasonId },
    });
  }
}
