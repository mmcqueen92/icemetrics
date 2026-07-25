import { Inject, Injectable } from '@nestjs/common';

import { IssueSeverity, JobStatus } from '../../generated/prisma/client.js';
import type { JobOutcome } from '../../jobs/job.types.js';
import { IngestionCaptureService } from '../ingestion-capture.service.js';
import type {
  HockeyDataProvider,
  ProviderCollection,
  ProviderFetch,
  ProviderGame,
} from '../providers/provider.types.js';
import { HOCKEY_DATA_PROVIDER } from '../providers/providers.module.js';
import { ImportIssueService } from '../raw/import-issue.service.js';
import { RawPayloadService } from '../raw/raw-payload.service.js';
import {
  completedOutcome,
  countMutations,
  emptyCounts,
  recordRejections,
} from '../reference/reference-job.helpers.js';
import type { ResolvedGameInput } from './game-import.types.js';
import { GameImportRepository } from './game-import.repository.js';
import { preserveTerminalFinal } from './game-transition.js';

type ScheduleProvider = Pick<
  HockeyDataProvider,
  'getSchedule' | 'getTeamSeasonSchedule'
>;

@Injectable()
export class ScheduleImportService {
  constructor(
    @Inject(HOCKEY_DATA_PROVIDER)
    private readonly provider: ScheduleProvider,
    @Inject(IngestionCaptureService)
    private readonly capture: IngestionCaptureService,
    @Inject(GameImportRepository)
    private readonly repository: GameImportRepository,
    @Inject(RawPayloadService)
    private readonly rawPayloads: RawPayloadService,
    @Inject(ImportIssueService)
    private readonly issues: ImportIssueService,
  ) {}

  async execute(
    executionId: string,
    parameters: Readonly<Record<string, unknown>>,
  ): Promise<JobOutcome> {
    const counts = emptyCounts();
    const requests = await this.requests(parameters);
    if ('outcome' in requests) {
      return requests.outcome;
    }
    const observed = new Set<string>();
    let lastScope: string | null = null;

    for (const request of requests.values) {
      let fetch;
      try {
        fetch = await request.fetch();
      } catch {
        counts.recordsFailed += 1;
        await this.issues.record({
          code: 'SCHEDULE_FETCH_FAILED',
          entityType: 'schedule',
          executionId,
          externalKey: request.scope,
          message: 'Schedule scope could not be fetched',
          severity: IssueSeverity.ERROR,
        });
        continue;
      }
      let captured;
      try {
        captured = await this.capture.captureAndValidate(fetch, executionId);
      } catch {
        counts.recordsFailed += 1;
        continue;
      }
      const collection = captured.value;
      counts.recordsFetched += collectionSize(collection);
      counts.recordsFailed += collection.rejections.length;
      await recordRejections(this.issues, {
        entityType: 'game',
        executionId,
        payloadId: captured.payloadId,
        rejections: collection.rejections,
      });
      const uniqueGames: ProviderGame[] = [];
      for (const game of collection.items) {
        if (observed.has(game.externalId)) {
          await this.issues.record({
            code: 'SCHEDULE_GAME_DUPLICATE_DISCOVERY',
            entityType: 'game',
            executionId,
            externalKey: game.externalId,
            message: 'Game was rediscovered in the same schedule execution',
            payloadId: captured.payloadId,
            severity: IssueSeverity.WARNING,
          });
        }
        observed.add(game.externalId);
        uniqueGames.push(game);
      }
      const resolved = await this.resolveGames(
        executionId,
        captured.payloadId,
        uniqueGames,
        counts,
      );
      if (parameters['dryRun'] !== true) {
        const mutations = await this.repository.upsertSchedule(resolved);
        countMutations(
          counts,
          mutations.map(({ mutation }) => mutation),
        );
        await this.rawPayloads.markProcessed(captured.payloadId);
      }
      lastScope = request.scope;
    }
    return completedOutcome(counts, {
      externalIds: [...observed].sort(),
      ...(lastScope ? { lastScope } : {}),
    });
  }

  private async requests(
    parameters: Readonly<Record<string, unknown>>,
  ): Promise<
    | {
        values: readonly {
          fetch: () => Promise<ProviderFetch<ProviderCollection<ProviderGame>>>;
          scope: string;
        }[];
      }
    | { outcome: JobOutcome }
  > {
    if (typeof parameters['seasonId'] === 'string') {
      const context = await this.repository.seasonBackfillContext(
        parameters['seasonId'],
      );
      if (!context) {
        return {
          outcome: {
            counts: { ...emptyCounts(), recordsFailed: 1 },
            errorSummary: { code: 'SEASON_IDENTITY_NOT_FOUND' },
            status: JobStatus.FAILED,
          },
        };
      }
      return {
        values: context.teams.map((team) => ({
          fetch: () =>
            this.provider.getTeamSeasonSchedule(team, context.seasonExternalId),
          scope: `${team}:${context.seasonExternalId}`,
        })),
      };
    }
    const dates = parameterDates(parameters);
    return {
      values: dates.map((date) => ({
        fetch: () => this.provider.getSchedule(date),
        scope: date,
      })),
    };
  }

  private async resolveGames(
    executionId: string,
    payloadId: string,
    games: readonly ProviderGame[],
    counts: ReturnType<typeof emptyCounts>,
  ): Promise<ResolvedGameInput[]> {
    const references = await this.repository.resolveReferences({
      seasonExternalIds: games.map(({ seasonExternalId }) => seasonExternalId),
      teamExternalIds: games.flatMap((game) => [
        game.awayTeamExternalId,
        game.homeTeamExternalId,
      ]),
    });
    const existing = await this.repository.existingGames(
      games.map(({ externalId }) => externalId),
    );
    const resolved: ResolvedGameInput[] = [];
    for (const incoming of games) {
      const seasonId = references.seasons.get(incoming.seasonExternalId);
      const awayTeamId = references.teams.get(incoming.awayTeamExternalId);
      const homeTeamId = references.teams.get(incoming.homeTeamExternalId);
      if (!seasonId || !awayTeamId || !homeTeamId) {
        counts.recordsFailed += 1;
        await this.issues.record({
          code: 'GAME_PARENT_IDENTITY_NOT_FOUND',
          details: {
            missing: [
              ...(!seasonId ? ['season'] : []),
              ...(!awayTeamId ? ['awayTeam'] : []),
              ...(!homeTeamId ? ['homeTeam'] : []),
            ],
          },
          entityType: 'game',
          executionId,
          externalKey: incoming.externalId,
          message: 'Game parent provider identity could not be resolved',
          payloadId,
          severity: IssueSeverity.ERROR,
        });
        continue;
      }
      const existingGame = existing.get(incoming.externalId);
      if (
        existingGame &&
        (existingGame.seasonId !== seasonId ||
          existingGame.awayTeamId !== awayTeamId ||
          existingGame.homeTeamId !== homeTeamId)
      ) {
        counts.recordsFailed += 1;
        await this.issues.record({
          code: 'GAME_IDENTITY_PARENT_MISMATCH',
          entityType: 'game',
          executionId,
          externalKey: incoming.externalId,
          message:
            'Existing game identity resolved to different parent records',
          payloadId,
          severity: IssueSeverity.ERROR,
        });
        continue;
      }
      if (!incoming.venue) {
        await this.issues.record({
          code: 'GAME_OPTIONAL_VENUE_MISSING',
          entityType: 'game',
          executionId,
          externalKey: incoming.externalId,
          message: 'Provider game did not include an optional venue',
          payloadId,
          severity: IssueSeverity.WARNING,
        });
      }
      resolved.push({
        awayTeamId,
        game: preserveTerminalFinal(incoming, existingGame),
        homeTeamId,
        seasonId,
      });
    }
    return resolved;
  }
}

function parameterDates(
  parameters: Readonly<Record<string, unknown>>,
): string[] {
  const from = parameters['dateFrom'];
  const to = parameters['dateTo'];
  if (typeof from === 'string' && typeof to === 'string') {
    const dates: string[] = [];
    const current = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
  }
  return [
    typeof parameters['date'] === 'string'
      ? parameters['date']
      : new Date().toISOString().slice(0, 10),
  ];
}

function collectionSize<T>(collection: ProviderCollection<T>): number {
  return collection.items.length + collection.rejections.length;
}
