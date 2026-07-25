import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import {
  GameStatus,
  GameType,
  MetricWindow,
  Prisma,
} from '../../generated/prisma/client.js';

export interface AnalyticsSeasonData {
  games: Awaited<ReturnType<AnalyticsRefreshRepository['loadGames']>>;
  seasonId: string;
  standings: Awaited<
    ReturnType<AnalyticsRefreshRepository['loadStandingSnapshots']>
  >;
}

export interface MetricSnapshotWrite {
  asOfGameId: string;
  entityId: string;
  metricCode: string;
  sampleSize: number;
  value: number;
  window: MetricWindow;
}

export interface RankingSnapshotWrite {
  asOfDate: Date;
  rank: number;
  sampleSize: number;
  score: number;
  teamId: string;
}

export interface ReconcileCounts {
  created: number;
  unchanged: number;
  updated: number;
}

const ELIGIBLE_GAME_TYPES = [GameType.REGULAR_SEASON, GameType.PLAYOFF];

@Injectable()
export class AnalyticsRefreshRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolveSeasonIds(
    parameters: Readonly<Record<string, unknown>>,
    now: Date,
  ): Promise<string[]> {
    if (typeof parameters['seasonId'] === 'string') {
      return [parameters['seasonId']];
    }
    const affectedGameIds = stringArray(parameters['affectedGameIds']);
    if (affectedGameIds.length > 0) {
      const games = await this.prisma.game.findMany({
        distinct: ['seasonId'],
        select: { seasonId: true },
        where: { id: { in: affectedGameIds } },
      });
      return games.map((game) => game.seasonId).sort();
    }
    if (typeof parameters['gameId'] === 'string') {
      const game = await this.prisma.game.findUnique({
        select: { seasonId: true },
        where: { id: parameters['gameId'] },
      });
      return game === null ? [] : [game.seasonId];
    }

    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const active = await this.prisma.season.findMany({
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      select: { id: true },
      where: { endDate: { gte: date }, startDate: { lte: date } },
    });
    return active.map((season) => season.id);
  }

  async loadSeason(seasonId: string): Promise<AnalyticsSeasonData | null> {
    const exists = await this.prisma.season.count({ where: { id: seasonId } });
    if (exists === 0) {
      return null;
    }
    const [games, standings] = await Promise.all([
      this.loadGames(seasonId),
      this.loadStandingSnapshots(seasonId),
    ]);
    return { games, seasonId, standings };
  }

  loadGames(seasonId: string) {
    return this.prisma.game.findMany({
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      select: {
        awayScore: true,
        decisionType: true,
        homeScore: true,
        id: true,
        playerStats: {
          orderBy: { playerId: 'asc' },
          select: {
            assists: true,
            goals: true,
            playerId: true,
            shots: true,
          },
        },
        startsAt: true,
        teamStats: {
          orderBy: { teamId: 'asc' },
          select: {
            goalsAgainst: true,
            goalsFor: true,
            team: { select: { id: true, name: true } },
            teamId: true,
          },
        },
      },
      where: {
        gameType: { in: ELIGIBLE_GAME_TYPES },
        seasonId,
        status: GameStatus.FINAL,
      },
    });
  }

  loadStandingSnapshots(seasonId: string) {
    return this.prisma.teamStandingSnapshot.findMany({
      orderBy: [{ asOfDate: 'asc' }, { teamId: 'asc' }],
      select: {
        asOfDate: true,
        pointPercentage: true,
        points: true,
        teamId: true,
      },
      where: { seasonId },
    });
  }

  async reconcile(
    seasonId: string,
    formulaVersion: string,
    computedAt: Date,
    players: readonly MetricSnapshotWrite[],
    teams: readonly MetricSnapshotWrite[],
    rankings: readonly RankingSnapshotWrite[],
  ): Promise<ReconcileCounts> {
    return this.prisma.$transaction(async (transaction) => {
      const playerCounts = await reconcileMetrics(
        transaction,
        'player',
        seasonId,
        formulaVersion,
        computedAt,
        players,
      );
      const teamCounts = await reconcileMetrics(
        transaction,
        'team',
        seasonId,
        formulaVersion,
        computedAt,
        teams,
      );
      const rankingCounts = await reconcileRankings(
        transaction,
        seasonId,
        formulaVersion,
        computedAt,
        rankings,
      );
      return addCounts(playerCounts, teamCounts, rankingCounts);
    });
  }
}

async function reconcileMetrics(
  transaction: Prisma.TransactionClient,
  entity: 'player' | 'team',
  seasonId: string,
  formulaVersion: string,
  computedAt: Date,
  desired: readonly MetricSnapshotWrite[],
): Promise<ReconcileCounts> {
  const existing =
    entity === 'player'
      ? await transaction.playerMetricSnapshot.findMany({
          select: {
            asOfGameId: true,
            formulaVersion: true,
            id: true,
            metricCode: true,
            playerId: true,
            sampleSize: true,
            value: true,
            window: true,
          },
          where: { seasonId },
        })
      : await transaction.teamMetricSnapshot.findMany({
          select: {
            asOfGameId: true,
            formulaVersion: true,
            id: true,
            metricCode: true,
            sampleSize: true,
            teamId: true,
            value: true,
            window: true,
          },
          where: { seasonId },
        });
  const byKey = new Map(
    (existing as unknown as ExistingMetric[]).map((snapshot) => [
      metricKey(
        entity === 'player' ? snapshot.playerId! : snapshot.teamId!,
        snapshot.metricCode,
        snapshot.window,
        snapshot.asOfGameId,
      ),
      snapshot,
    ]),
  );
  const desiredKeys = new Set<string>();
  const counts: ReconcileCounts = { created: 0, unchanged: 0, updated: 0 };
  const writes: Array<{
    asOfGameId: string;
    computedAt: Date;
    entityId: string;
    formulaVersion: string;
    metricCode: string;
    sampleSize: number;
    seasonId: string;
    value: Prisma.Decimal;
    window: MetricWindow;
  }> = [];
  const replacedIds: string[] = [];

  for (const snapshot of desired) {
    const key = metricKey(
      snapshot.entityId,
      snapshot.metricCode,
      snapshot.window,
      snapshot.asOfGameId,
    );
    desiredKeys.add(key);
    const current = byKey.get(key);
    const value = decimalValue(snapshot.value);
    if (current === undefined) {
      writes.push({
        asOfGameId: snapshot.asOfGameId,
        computedAt,
        entityId: snapshot.entityId,
        formulaVersion,
        metricCode: snapshot.metricCode,
        sampleSize: snapshot.sampleSize,
        seasonId,
        value,
        window: snapshot.window,
      });
      counts.created += 1;
    } else if (
      current.formulaVersion === formulaVersion &&
      current.sampleSize === snapshot.sampleSize &&
      current.value.equals(value)
    ) {
      counts.unchanged += 1;
    } else {
      replacedIds.push(current.id);
      writes.push({
        asOfGameId: snapshot.asOfGameId,
        computedAt,
        entityId: snapshot.entityId,
        formulaVersion,
        metricCode: snapshot.metricCode,
        sampleSize: snapshot.sampleSize,
        seasonId,
        value,
        window: snapshot.window,
      });
      counts.updated += 1;
    }
  }

  const staleIds = [...byKey.entries()]
    .filter(
      ([key, snapshot]) =>
        snapshot.formulaVersion === formulaVersion && !desiredKeys.has(key),
    )
    .map(([, snapshot]) => snapshot.id);
  const removedIds = [...replacedIds, ...staleIds];
  if (removedIds.length > 0) {
    if (entity === 'player') {
      await transaction.playerMetricSnapshot.deleteMany({
        where: { id: { in: removedIds } },
      });
    } else {
      await transaction.teamMetricSnapshot.deleteMany({
        where: { id: { in: removedIds } },
      });
    }
    counts.updated += staleIds.length;
  }
  for (const batch of chunks(writes, 1_000)) {
    if (entity === 'player') {
      await transaction.playerMetricSnapshot.createMany({
        data: batch.map(({ entityId, ...write }) => ({
          ...write,
          playerId: entityId,
        })),
      });
    } else {
      await transaction.teamMetricSnapshot.createMany({
        data: batch.map(({ entityId, ...write }) => ({
          ...write,
          teamId: entityId,
        })),
      });
    }
  }
  return counts;
}

async function reconcileRankings(
  transaction: Prisma.TransactionClient,
  seasonId: string,
  formulaVersion: string,
  computedAt: Date,
  desired: readonly RankingSnapshotWrite[],
): Promise<ReconcileCounts> {
  const existing = await transaction.teamRankingSnapshot.findMany({
    select: {
      asOfDate: true,
      formulaVersion: true,
      id: true,
      rank: true,
      sampleSize: true,
      score: true,
      teamId: true,
    },
    where: {
      rankingCode: 'team.powerRanking',
      seasonId,
    },
  });
  const byKey = new Map(
    existing.map((snapshot) => [
      rankingKey(snapshot.teamId, snapshot.asOfDate),
      snapshot,
    ]),
  );
  const desiredKeys = new Set<string>();
  const counts: ReconcileCounts = { created: 0, unchanged: 0, updated: 0 };
  const writes: Array<{
    asOfDate: Date;
    computedAt: Date;
    formulaVersion: string;
    rank: number;
    rankingCode: string;
    sampleSize: number;
    score: Prisma.Decimal;
    seasonId: string;
    teamId: string;
  }> = [];
  const replacedIds: string[] = [];
  for (const snapshot of desired) {
    const key = rankingKey(snapshot.teamId, snapshot.asOfDate);
    desiredKeys.add(key);
    const current = byKey.get(key);
    const score = decimalValue(snapshot.score);
    if (current === undefined) {
      writes.push({
        ...snapshot,
        computedAt,
        formulaVersion,
        rankingCode: 'team.powerRanking',
        score,
        seasonId,
      });
      counts.created += 1;
    } else if (
      current.formulaVersion === formulaVersion &&
      current.rank === snapshot.rank &&
      current.sampleSize === snapshot.sampleSize &&
      current.score.equals(score)
    ) {
      counts.unchanged += 1;
    } else {
      replacedIds.push(current.id);
      writes.push({
        ...snapshot,
        computedAt,
        formulaVersion,
        rankingCode: 'team.powerRanking',
        score,
        seasonId,
      });
      counts.updated += 1;
    }
  }
  const staleIds = [...byKey.entries()]
    .filter(
      ([key, snapshot]) =>
        snapshot.formulaVersion === formulaVersion && !desiredKeys.has(key),
    )
    .map(([, snapshot]) => snapshot.id);
  const removedIds = [...replacedIds, ...staleIds];
  if (removedIds.length > 0) {
    await transaction.teamRankingSnapshot.deleteMany({
      where: { id: { in: removedIds } },
    });
    counts.updated += staleIds.length;
  }
  for (const batch of chunks(writes, 1_000)) {
    await transaction.teamRankingSnapshot.createMany({ data: batch });
  }
  return counts;
}

interface ExistingMetric {
  asOfGameId: string;
  formulaVersion: string;
  id: string;
  metricCode: string;
  playerId?: string;
  sampleSize: number;
  teamId?: string;
  value: Prisma.Decimal;
  window: MetricWindow;
}

function decimalValue(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

function metricKey(
  entityId: string,
  code: string,
  window: MetricWindow,
  gameId: string,
): string {
  return `${entityId}|${code}|${window}|${gameId}`;
}

function rankingKey(teamId: string, date: Date): string {
  return `${teamId}|${date.toISOString().slice(0, 10)}`;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function addCounts(...counts: readonly ReconcileCounts[]): ReconcileCounts {
  return counts.reduce(
    (total, current) => ({
      created: total.created + current.created,
      unchanged: total.unchanged + current.unchanged,
      updated: total.updated + current.updated,
    }),
    { created: 0, unchanged: 0, updated: 0 },
  );
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}
