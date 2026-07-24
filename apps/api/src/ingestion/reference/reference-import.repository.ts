import { Inject, Injectable } from '@nestjs/common';

import { JobStatus, JobType, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  MutationKind,
  ReferenceSnapshotInput,
  ReferenceSnapshotResult,
  RosterContext,
  RosterPlayerInput,
} from './reference-import.types.js';

const PROVIDER = 'nhl';

@Injectable()
export class ReferenceImportRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async upsertReferenceSnapshot(
    input: ReferenceSnapshotInput,
  ): Promise<ReferenceSnapshotResult> {
    return this.prisma.$transaction(async (transaction) => {
      const league = await upsertLeague(transaction, input.league);
      const season = await upsertSeason(transaction, league.id, input.season);
      const teams: MutationKind[] = [];
      for (const team of input.teams) {
        teams.push(await upsertTeam(transaction, league.id, team));
      }
      return {
        mutations: [league.mutation, season, ...teams],
      };
    });
  }

  async getRosterContext(input: {
    date: Date;
    seasonId?: string;
  }): Promise<RosterContext | null> {
    const season = await this.prisma.season.findFirst({
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        providerIdentities: {
          select: { externalId: true },
          where: { provider: PROVIDER },
        },
      },
      where: input.seasonId
        ? { id: input.seasonId }
        : {
            endDate: { gte: input.date },
            startDate: { lte: input.date },
          },
    });
    const seasonExternalId = season?.providerIdentities[0]?.externalId;
    if (!season || !seasonExternalId) {
      return null;
    }
    const teams = await this.prisma.team.findMany({
      orderBy: [{ abbreviation: 'asc' }, { id: 'asc' }],
      select: {
        abbreviation: true,
        id: true,
        providerIdentities: {
          select: { externalId: true },
          where: { provider: PROVIDER },
        },
      },
      where: { active: true, league: { code: 'NHL' } },
    });
    return {
      seasonExternalId,
      seasonId: season.id,
      teams: teams.flatMap((team) => {
        const externalId = team.providerIdentities[0]?.externalId;
        return externalId
          ? [{ abbreviation: team.abbreviation, externalId, id: team.id }]
          : [];
      }),
    };
  }

  async upsertRoster(
    players: readonly RosterPlayerInput[],
  ): Promise<readonly MutationKind[]> {
    return this.prisma.$transaction(async (transaction) => {
      const mutations: MutationKind[] = [];
      for (const input of players) {
        mutations.push(await upsertPlayer(transaction, input));
      }
      return mutations;
    });
  }

  async activeExternalIds(entity: 'player' | 'team'): Promise<string[]> {
    if (entity === 'team') {
      const identities = await this.prisma.teamProviderIdentity.findMany({
        orderBy: { externalId: 'asc' },
        select: { externalId: true },
        where: { provider: PROVIDER, team: { active: true } },
      });
      return identities.map(({ externalId }) => externalId);
    }
    const identities = await this.prisma.playerProviderIdentity.findMany({
      orderBy: { externalId: 'asc' },
      select: { externalId: true },
      where: { player: { active: true }, provider: PROVIDER },
    });
    return identities.map(({ externalId }) => externalId);
  }

  async inactivate(
    entity: 'player' | 'team',
    externalIds: readonly string[],
  ): Promise<number> {
    if (externalIds.length === 0) {
      return 0;
    }
    if (entity === 'team') {
      return (
        await this.prisma.team.updateMany({
          data: { active: false },
          where: {
            active: true,
            providerIdentities: {
              some: {
                externalId: { in: [...externalIds] },
                provider: PROVIDER,
              },
            },
          },
        })
      ).count;
    }
    return (
      await this.prisma.player.updateMany({
        data: { active: false, currentTeamId: null },
        where: {
          active: true,
          providerIdentities: {
            some: { externalId: { in: [...externalIds] }, provider: PROVIDER },
          },
        },
      })
    ).count;
  }

  async previousSuccessfulSnapshots(
    jobType: JobType,
    limit = 2,
  ): Promise<ReadonlySet<string>[]> {
    const executions = await this.prisma.jobExecution.findMany({
      orderBy: [{ finishedAt: 'desc' }, { id: 'asc' }],
      select: { cursor: true, parameters: true },
      take: 50,
      where: {
        jobType,
        status: JobStatus.SUCCEEDED,
      },
    });
    return executions
      .filter((execution) => !isDryRun(execution.parameters))
      .slice(0, limit)
      .map((execution) => {
        const cursor = execution.cursor;
        if (
          !cursor ||
          typeof cursor !== 'object' ||
          Array.isArray(cursor) ||
          !('externalIds' in cursor) ||
          !Array.isArray(cursor['externalIds'])
        ) {
          return new Set<string>();
        }
        return new Set(
          cursor['externalIds'].filter(
            (value): value is string => typeof value === 'string',
          ),
        );
      });
  }
}

type Transaction = Prisma.TransactionClient;

async function upsertLeague(
  transaction: Transaction,
  input: ReferenceSnapshotInput['league'],
): Promise<{ id: string; mutation: MutationKind }> {
  const identity = await transaction.leagueProviderIdentity.findUnique({
    include: { league: true },
    where: {
      provider_externalId: { externalId: input.externalId, provider: PROVIDER },
    },
  });
  if (identity) {
    const unchanged =
      identity.league.code === input.code &&
      identity.league.name === input.name;
    if (!unchanged) {
      await transaction.league.update({
        data: { code: input.code, name: input.name },
        where: { id: identity.leagueId },
      });
    }
    return {
      id: identity.leagueId,
      mutation: unchanged ? 'unchanged' : 'updated',
    };
  }
  const existing = await transaction.league.findUnique({
    where: { code: input.code },
  });
  const league =
    existing ??
    (await transaction.league.create({
      data: { code: input.code, name: input.name },
    }));
  await transaction.leagueProviderIdentity.create({
    data: {
      externalId: input.externalId,
      leagueId: league.id,
      provider: PROVIDER,
    },
  });
  return { id: league.id, mutation: existing ? 'updated' : 'created' };
}

async function upsertSeason(
  transaction: Transaction,
  leagueId: string,
  input: ReferenceSnapshotInput['season'],
): Promise<MutationKind> {
  const identity = await transaction.seasonProviderIdentity.findUnique({
    include: { season: true },
    where: {
      provider_externalId: { externalId: input.externalId, provider: PROVIDER },
    },
  });
  const data = {
    endDate: date(input.endDate),
    label: input.label,
    leagueId,
    startDate: date(input.startDate),
  };
  if (identity) {
    const unchanged =
      identity.season.leagueId === leagueId &&
      identity.season.label === input.label &&
      sameDate(identity.season.startDate, input.startDate) &&
      sameDate(identity.season.endDate, input.endDate);
    if (!unchanged) {
      await transaction.season.update({
        data,
        where: { id: identity.seasonId },
      });
    }
    return unchanged ? 'unchanged' : 'updated';
  }
  const existing = await transaction.season.findUnique({
    where: { leagueId_label: { label: input.label, leagueId } },
  });
  const season =
    existing ??
    (await transaction.season.create({
      data,
    }));
  await transaction.seasonProviderIdentity.create({
    data: {
      externalId: input.externalId,
      provider: PROVIDER,
      seasonId: season.id,
    },
  });
  return existing ? 'updated' : 'created';
}

async function upsertTeam(
  transaction: Transaction,
  leagueId: string,
  input: ReferenceSnapshotInput['teams'][number],
): Promise<MutationKind> {
  const identity = await transaction.teamProviderIdentity.findUnique({
    include: { team: true },
    where: {
      provider_externalId: { externalId: input.externalId, provider: PROVIDER },
    },
  });
  const data = {
    abbreviation: input.abbreviation,
    active: true,
    city: input.city,
    leagueId,
    name: input.name,
  };
  if (identity) {
    const unchanged =
      identity.team.leagueId === leagueId &&
      identity.team.abbreviation === input.abbreviation &&
      identity.team.city === input.city &&
      identity.team.name === input.name &&
      identity.team.active;
    if (!unchanged) {
      await transaction.team.update({ data, where: { id: identity.teamId } });
    }
    return unchanged ? 'unchanged' : 'updated';
  }
  const existing = await transaction.team.findUnique({
    where: {
      leagueId_abbreviation: { abbreviation: input.abbreviation, leagueId },
    },
  });
  const team =
    existing ??
    (await transaction.team.create({
      data,
    }));
  if (existing) {
    await transaction.team.update({ data, where: { id: existing.id } });
  }
  await transaction.teamProviderIdentity.create({
    data: {
      externalId: input.externalId,
      provider: PROVIDER,
      teamId: team.id,
    },
  });
  return existing ? 'updated' : 'created';
}

async function upsertPlayer(
  transaction: Transaction,
  input: RosterPlayerInput,
): Promise<MutationKind> {
  const identity = await transaction.playerProviderIdentity.findUnique({
    include: { player: true },
    where: {
      provider_externalId: {
        externalId: input.player.externalId,
        provider: PROVIDER,
      },
    },
  });
  const data = {
    active: input.player.active,
    birthDate: input.player.birthDate ? date(input.player.birthDate) : null,
    currentTeamId: input.teamId,
    firstName: input.player.firstName,
    lastName: input.player.lastName,
    position: input.player.position,
    shootsCatches: input.player.shootsCatches,
  };
  if (identity) {
    const player = identity.player;
    const unchanged =
      player.active === data.active &&
      player.currentTeamId === data.currentTeamId &&
      player.firstName === data.firstName &&
      player.lastName === data.lastName &&
      player.position === data.position &&
      player.shootsCatches === data.shootsCatches &&
      sameNullableDate(player.birthDate, input.player.birthDate);
    if (!unchanged) {
      await transaction.player.update({
        data,
        where: { id: identity.playerId },
      });
    }
    return unchanged ? 'unchanged' : 'updated';
  }
  const player = await transaction.player.create({ data });
  await transaction.playerProviderIdentity.create({
    data: {
      externalId: input.player.externalId,
      playerId: player.id,
      provider: PROVIDER,
    },
  });
  return 'created';
}

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function sameDate(value: Date, expected: string): boolean {
  return value.toISOString().slice(0, 10) === expected;
}

function sameNullableDate(
  value: Date | null,
  expected: string | null,
): boolean {
  return value
    ? expected === value.toISOString().slice(0, 10)
    : expected === null;
}

function isDryRun(parameters: Prisma.JsonValue): boolean {
  return (
    parameters !== null &&
    !Array.isArray(parameters) &&
    typeof parameters === 'object' &&
    parameters['dryRun'] === true
  );
}
