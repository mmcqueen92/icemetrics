import { Inject, Injectable } from '@nestjs/common';

import { JobStatus, JobType, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { MutationKind } from '../reference/reference-import.types.js';
import type {
  ExistingGameSnapshot,
  GameImportMutation,
  GameStatisticsInput,
  GameStatisticsResult,
  ResolvedGameInput,
  StatisticsCandidate,
} from './game-import.types.js';
import { statisticsDue } from './statistics-refresh-policy.js';

const PROVIDER = 'nhl';
const CORRECTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

@Injectable()
export class GameImportRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolveReferences(input: {
    seasonExternalIds: readonly string[];
    teamExternalIds: readonly string[];
  }): Promise<{
    seasons: ReadonlyMap<string, string>;
    teams: ReadonlyMap<string, string>;
  }> {
    const [seasons, teams] = await Promise.all([
      this.prisma.seasonProviderIdentity.findMany({
        select: { externalId: true, seasonId: true },
        where: {
          externalId: { in: [...new Set(input.seasonExternalIds)] },
          provider: PROVIDER,
        },
      }),
      this.prisma.teamProviderIdentity.findMany({
        select: { externalId: true, teamId: true },
        where: {
          externalId: { in: [...new Set(input.teamExternalIds)] },
          provider: PROVIDER,
        },
      }),
    ]);
    return {
      seasons: new Map(
        seasons.map(({ externalId, seasonId }) => [externalId, seasonId]),
      ),
      teams: new Map(
        teams.map(({ externalId, teamId }) => [externalId, teamId]),
      ),
    };
  }

  async existingGames(
    externalIds: readonly string[],
  ): Promise<ReadonlyMap<string, ExistingGameSnapshot>> {
    const identities = await this.prisma.gameProviderIdentity.findMany({
      include: { game: true },
      where: {
        externalId: { in: [...new Set(externalIds)] },
        provider: PROVIDER,
      },
    });
    return new Map(
      identities.map(({ externalId, game }) => [externalId, game]),
    );
  }

  async upsertSchedule(
    games: readonly ResolvedGameInput[],
  ): Promise<readonly GameImportMutation[]> {
    return this.prisma.$transaction(async (transaction) => {
      const results: GameImportMutation[] = [];
      for (const input of games) {
        results.push(await upsertGame(transaction, input));
      }
      return results;
    });
  }

  async seasonBackfillContext(seasonId: string): Promise<{
    seasonExternalId: string;
    teams: readonly string[];
  } | null> {
    const season = await this.prisma.season.findUnique({
      select: {
        leagueId: true,
        providerIdentities: {
          select: { externalId: true },
          where: { provider: PROVIDER },
        },
      },
      where: { id: seasonId },
    });
    const seasonExternalId = season?.providerIdentities[0]?.externalId;
    if (!season || !seasonExternalId) {
      return null;
    }
    const teams = await this.prisma.team.findMany({
      orderBy: [{ abbreviation: 'asc' }, { id: 'asc' }],
      select: { abbreviation: true },
      where: { leagueId: season.leagueId },
    });
    return {
      seasonExternalId,
      teams: teams.map(({ abbreviation }) => abbreviation),
    };
  }

  async statisticsCandidates(input: {
    gameId?: string;
    now: Date;
  }): Promise<readonly StatisticsCandidate[]> {
    const games = await this.prisma.game.findMany({
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      select: {
        awayTeamId: true,
        awayTeam: {
          select: {
            providerIdentities: {
              select: { externalId: true },
              where: { provider: PROVIDER },
            },
          },
        },
        homeTeamId: true,
        homeTeam: {
          select: {
            providerIdentities: {
              select: { externalId: true },
              where: { provider: PROVIDER },
            },
          },
        },
        id: true,
        playerStats: { select: { id: true }, take: 1 },
        providerIdentities: {
          select: { externalId: true },
          where: { provider: PROVIDER },
        },
        season: {
          select: {
            providerIdentities: {
              select: { externalId: true },
              where: { provider: PROVIDER },
            },
          },
        },
        seasonId: true,
        teamStats: { select: { id: true } },
        updatedAt: true,
      },
      take: 100,
      where: input.gameId
        ? { id: input.gameId, status: 'FINAL' }
        : {
            OR: [
              { playerStats: { none: {} } },
              { teamStats: { none: {} } },
              {
                startsAt: {
                  gte: new Date(input.now.getTime() - CORRECTION_WINDOW_MS),
                },
              },
            ],
            status: 'FINAL',
          },
    });
    const externalIds = games.flatMap((game) =>
      game.providerIdentities.map(({ externalId }) => externalId),
    );
    const executions = await this.prisma.jobExecution.findMany({
      orderBy: [{ finishedAt: 'desc' }, { id: 'asc' }],
      select: { cursor: true, finishedAt: true },
      take: 100,
      where: {
        jobType: JobType.GAME_STATISTICS,
        status: { in: [JobStatus.SUCCEEDED, JobStatus.PARTIAL] },
      },
    });
    const latestChecks = new Map<string, Date>();
    for (const execution of executions) {
      if (!execution.finishedAt) {
        continue;
      }
      for (const checkedId of checkedExternalIds(execution.cursor)) {
        if (externalIds.includes(checkedId) && !latestChecks.has(checkedId)) {
          latestChecks.set(checkedId, execution.finishedAt);
        }
      }
    }
    return games.flatMap((game) => {
      const externalId = game.providerIdentities[0]?.externalId;
      const awayTeamExternalId =
        game.awayTeam.providerIdentities[0]?.externalId;
      const homeTeamExternalId =
        game.homeTeam.providerIdentities[0]?.externalId;
      const seasonExternalId = game.season.providerIdentities[0]?.externalId;
      if (
        !externalId ||
        !awayTeamExternalId ||
        !homeTeamExternalId ||
        !seasonExternalId
      ) {
        return [];
      }
      const candidate: StatisticsCandidate = {
        awayTeamExternalId,
        awayTeamId: game.awayTeamId,
        externalId,
        firstFinalAt: game.updatedAt,
        gameId: game.id,
        hasCompleteStatistics:
          game.playerStats.length > 0 && game.teamStats.length === 2,
        homeTeamExternalId,
        homeTeamId: game.homeTeamId,
        latestCheckedAt: latestChecks.get(externalId) ?? null,
        seasonExternalId,
        seasonId: game.seasonId,
      };
      return input.gameId || statisticsDue(candidate, input.now)
        ? [candidate]
        : [];
    });
  }

  async resolvedPlayerIds(
    externalIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    const identities = await this.prisma.playerProviderIdentity.findMany({
      select: { externalId: true, playerId: true },
      where: {
        externalId: { in: [...new Set(externalIds)] },
        provider: PROVIDER,
      },
    });
    return new Map(
      identities.map(({ externalId, playerId }) => [externalId, playerId]),
    );
  }

  async importStatistics(
    input: GameStatisticsInput,
  ): Promise<GameStatisticsResult> {
    return this.prisma.$transaction(async (transaction) => {
      const mutations: MutationKind[] = [];
      const gameMutation = await updateExistingGame(
        transaction,
        input.game.gameId,
        input.game,
      );
      mutations.push(gameMutation);
      const playerIds = new Map<string, string>();
      for (const missing of input.missingPlayers) {
        const created = await transaction.player.create({
          data: {
            active: missing.player.active,
            birthDate: missing.player.birthDate
              ? date(missing.player.birthDate)
              : null,
            currentTeamId: missing.currentTeamId,
            firstName: missing.player.firstName,
            lastName: missing.player.lastName,
            position: missing.player.position,
            shootsCatches: missing.player.shootsCatches,
          },
        });
        await transaction.playerProviderIdentity.create({
          data: {
            externalId: missing.player.externalId,
            playerId: created.id,
            provider: PROVIDER,
          },
        });
        playerIds.set(missing.player.externalId, created.id);
        mutations.push('created');
      }
      const importedPlayerIds: string[] = [];
      for (const resolved of input.playerStats) {
        const playerId =
          playerIds.get(resolved.stat.playerExternalId) ?? resolved.playerId;
        if (!playerId) {
          throw new Error('Resolved player statistic is missing a player ID');
        }
        importedPlayerIds.push(playerId);
        mutations.push(
          await upsertPlayerStat(
            transaction,
            input.game.gameId,
            playerId,
            resolved.teamId,
            resolved.stat,
          ),
        );
      }
      if (input.completePlayerSnapshot) {
        await transaction.playerGameStat.deleteMany({
          where: {
            gameId: input.game.gameId,
            ...(importedPlayerIds.length > 0
              ? { playerId: { notIn: importedPlayerIds } }
              : {}),
          },
        });
      }
      for (const teamStat of input.teamStats) {
        mutations.push(
          await upsertTeamStat(
            transaction,
            input.game.gameId,
            teamStat.teamId,
            teamStat,
          ),
        );
      }
      return { mutations };
    });
  }
}

type Transaction = Prisma.TransactionClient;

async function upsertGame(
  transaction: Transaction,
  input: ResolvedGameInput,
): Promise<GameImportMutation> {
  const identity = await transaction.gameProviderIdentity.findUnique({
    include: { game: true },
    where: {
      provider_externalId: {
        externalId: input.game.externalId,
        provider: PROVIDER,
      },
    },
  });
  const data = gameData(input);
  if (identity) {
    const mutation = sameGame(identity.game, data) ? 'unchanged' : 'updated';
    if (mutation === 'updated') {
      await transaction.game.update({
        data,
        where: { id: identity.gameId },
      });
    }
    return {
      externalId: input.game.externalId,
      gameId: identity.gameId,
      mutation,
    };
  }
  const existing = await transaction.game.findUnique({
    where: {
      seasonId_homeTeamId_awayTeamId_startsAt: {
        awayTeamId: input.awayTeamId,
        homeTeamId: input.homeTeamId,
        seasonId: input.seasonId,
        startsAt: new Date(input.game.startsAt),
      },
    },
  });
  const game = existing
    ? await transaction.game.update({ data, where: { id: existing.id } })
    : await transaction.game.create({ data });
  await transaction.gameProviderIdentity.create({
    data: {
      externalId: input.game.externalId,
      gameId: game.id,
      provider: PROVIDER,
    },
  });
  return {
    externalId: input.game.externalId,
    gameId: game.id,
    mutation: existing ? 'updated' : 'created',
  };
}

async function updateExistingGame(
  transaction: Transaction,
  gameId: string,
  input: ResolvedGameInput,
): Promise<MutationKind> {
  const existing = await transaction.game.findUniqueOrThrow({
    where: { id: gameId },
  });
  const data = gameData(input);
  if (sameGame(existing, data)) {
    return 'unchanged';
  }
  await transaction.game.update({ data, where: { id: gameId } });
  return 'updated';
}

function gameData(input: ResolvedGameInput) {
  return {
    awayScore: input.game.awayScore,
    awayTeamId: input.awayTeamId,
    decisionType: input.game.decisionType,
    gameType: input.game.gameType,
    homeScore: input.game.homeScore,
    homeTeamId: input.homeTeamId,
    seasonId: input.seasonId,
    startsAt: new Date(input.game.startsAt),
    status: input.game.status,
    venue: input.game.venue,
  };
}

function sameGame(
  existing: ExistingGameSnapshot,
  data: ReturnType<typeof gameData>,
): boolean {
  return (
    existing.awayScore === data.awayScore &&
    existing.awayTeamId === data.awayTeamId &&
    existing.decisionType === data.decisionType &&
    existing.gameType === data.gameType &&
    existing.homeScore === data.homeScore &&
    existing.homeTeamId === data.homeTeamId &&
    existing.seasonId === data.seasonId &&
    existing.startsAt.getTime() === data.startsAt.getTime() &&
    existing.status === data.status &&
    existing.venue === data.venue
  );
}

async function upsertPlayerStat(
  transaction: Transaction,
  gameId: string,
  playerId: string,
  teamId: string,
  stat: GameStatisticsInput['playerStats'][number]['stat'],
): Promise<MutationKind> {
  const existing = await transaction.playerGameStat.findUnique({
    where: { gameId_playerId: { gameId, playerId } },
  });
  const data = {
    assists: stat.assists,
    goals: stat.goals,
    penaltyMinutes: stat.penaltyMinutes,
    plusMinus: stat.plusMinus,
    powerPlayGoals: stat.powerPlayGoals,
    shortHandedGoals: stat.shortHandedGoals,
    shots: stat.shots,
    teamId,
    timeOnIceSeconds: stat.timeOnIceSeconds,
  };
  if (existing && sameRecord(existing, data)) {
    return 'unchanged';
  }
  if (existing) {
    await transaction.playerGameStat.update({
      data,
      where: { id: existing.id },
    });
    return 'updated';
  }
  await transaction.playerGameStat.create({
    data: { ...data, gameId, playerId },
  });
  return 'created';
}

async function upsertTeamStat(
  transaction: Transaction,
  gameId: string,
  teamId: string,
  stat: GameStatisticsInput['teamStats'][number],
): Promise<MutationKind> {
  const existing = await transaction.teamGameStat.findUnique({
    where: { gameId_teamId: { gameId, teamId } },
  });
  const data = {
    goalsAgainst: stat.goalsAgainst,
    goalsFor: stat.goalsFor,
    penaltyMinutes: stat.penaltyMinutes,
    powerPlayGoals: stat.powerPlayGoals,
    powerPlayOpportunities: stat.powerPlayOpportunities,
    shotsAgainst: stat.shotsAgainst,
    shotsFor: stat.shotsFor,
  };
  if (existing && sameRecord(existing, data)) {
    return 'unchanged';
  }
  if (existing) {
    await transaction.teamGameStat.update({
      data,
      where: { id: existing.id },
    });
    return 'updated';
  }
  await transaction.teamGameStat.create({
    data: { ...data, gameId, teamId },
  });
  return 'created';
}

function sameRecord(
  existing: Readonly<Record<string, unknown>>,
  data: Readonly<Record<string, unknown>>,
): boolean {
  return Object.entries(data).every(([key, value]) => existing[key] === value);
}

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function checkedExternalIds(cursor: Prisma.JsonValue | null): string[] {
  if (
    !cursor ||
    typeof cursor !== 'object' ||
    Array.isArray(cursor) ||
    !Array.isArray(cursor['checkedExternalIds'])
  ) {
    return [];
  }
  return cursor['checkedExternalIds'].filter(
    (value): value is string => typeof value === 'string',
  );
}
