import { Inject, Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { ProviderStanding } from '../providers/provider.types.js';
import type { MutationKind } from '../reference/reference-import.types.js';

const PROVIDER = 'nhl';
const FORMULA_VERSION = 'nhl-official-v1';

export interface StandingImportInput {
  standing: ProviderStanding;
  teamId: string;
}

@Injectable()
export class StandingsImportRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolveContext(seasonExternalId: string): Promise<{
    seasonId: string;
    teams: ReadonlyMap<string, string>;
  } | null> {
    const identity = await this.prisma.seasonProviderIdentity.findUnique({
      include: { season: { select: { leagueId: true } } },
      where: {
        provider_externalId: {
          externalId: seasonExternalId,
          provider: PROVIDER,
        },
      },
    });
    if (!identity) {
      return null;
    }
    const teams = await this.prisma.team.findMany({
      select: { abbreviation: true, id: true },
      where: { leagueId: identity.season.leagueId },
    });
    return {
      seasonId: identity.seasonId,
      teams: new Map(
        teams.map(({ abbreviation, id }) => [abbreviation.toUpperCase(), id]),
      ),
    };
  }

  async upsertSnapshot(
    seasonId: string,
    standings: readonly StandingImportInput[],
  ): Promise<readonly MutationKind[]> {
    const computedAt = new Date();
    return this.prisma.$transaction(async (transaction) => {
      const mutations: MutationKind[] = [];
      for (const input of standings) {
        const standing = input.standing;
        const key = {
          asOfDate: date(standing.asOfDate),
          seasonId,
          teamId: input.teamId,
        };
        const existing = await transaction.teamStandingSnapshot.findUnique({
          where: { seasonId_teamId_asOfDate: key },
        });
        const data = {
          computedAt,
          conferenceRank: standing.conferenceRank,
          divisionRank: standing.divisionRank,
          formulaVersion: FORMULA_VERSION,
          gamesPlayed: standing.gamesPlayed,
          goalsAgainst: standing.goalsAgainst,
          goalsFor: standing.goalsFor,
          leagueRank: standing.leagueRank,
          losses: standing.losses,
          overtimeLosses: standing.overtimeLosses,
          pointPercentage: new Prisma.Decimal(standing.pointPercentage),
          points: standing.points,
          sourceCutoff: new Date(standing.sourceCutoff),
          wins: standing.wins,
        };
        if (existing && sameStanding(existing, data)) {
          mutations.push('unchanged');
          continue;
        }
        if (existing) {
          await transaction.teamStandingSnapshot.update({
            data,
            where: { id: existing.id },
          });
          mutations.push('updated');
          continue;
        }
        await transaction.teamStandingSnapshot.create({
          data: { ...data, ...key },
        });
        mutations.push('created');
      }
      return mutations;
    });
  }
}

function sameStanding(
  existing: {
    conferenceRank: number | null;
    divisionRank: number | null;
    gamesPlayed: number;
    goalsAgainst: number;
    goalsFor: number;
    leagueRank: number;
    losses: number;
    overtimeLosses: number;
    pointPercentage: Prisma.Decimal;
    points: number;
    sourceCutoff: Date;
    wins: number;
  },
  data: {
    conferenceRank: number | null;
    divisionRank: number | null;
    gamesPlayed: number;
    goalsAgainst: number;
    goalsFor: number;
    leagueRank: number;
    losses: number;
    overtimeLosses: number;
    pointPercentage: Prisma.Decimal;
    points: number;
    sourceCutoff: Date;
    wins: number;
  },
): boolean {
  return (
    existing.conferenceRank === data.conferenceRank &&
    existing.divisionRank === data.divisionRank &&
    existing.gamesPlayed === data.gamesPlayed &&
    existing.goalsAgainst === data.goalsAgainst &&
    existing.goalsFor === data.goalsFor &&
    existing.leagueRank === data.leagueRank &&
    existing.losses === data.losses &&
    existing.overtimeLosses === data.overtimeLosses &&
    existing.pointPercentage.equals(data.pointPercentage) &&
    existing.points === data.points &&
    existing.sourceCutoff.getTime() === data.sourceCutoff.getTime() &&
    existing.wins === data.wins
  );
}

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
