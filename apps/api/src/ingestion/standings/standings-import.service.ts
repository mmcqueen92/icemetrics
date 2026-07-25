import { Inject, Injectable } from '@nestjs/common';

import { IssueSeverity } from '../../generated/prisma/client.js';
import type { JobOutcome } from '../../jobs/job.types.js';
import { IngestionCaptureService } from '../ingestion-capture.service.js';
import type {
  HockeyDataProvider,
  ProviderStanding,
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
import {
  StandingsImportRepository,
  type StandingImportInput,
} from './standings-import.repository.js';

type StandingsProvider = Pick<HockeyDataProvider, 'getStandings'>;

@Injectable()
export class StandingsImportService {
  constructor(
    @Inject(HOCKEY_DATA_PROVIDER)
    private readonly provider: StandingsProvider,
    @Inject(IngestionCaptureService)
    private readonly capture: IngestionCaptureService,
    @Inject(StandingsImportRepository)
    private readonly repository: StandingsImportRepository,
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
    const date =
      typeof parameters['date'] === 'string'
        ? parameters['date']
        : new Date().toISOString().slice(0, 10);
    const captured = await this.capture.captureAndValidate(
      await this.provider.getStandings(date),
      executionId,
    );
    counts.recordsFetched +=
      captured.value.items.length + captured.value.rejections.length;
    counts.recordsFailed += captured.value.rejections.length;
    await recordRejections(this.issues, {
      entityType: 'standing',
      executionId,
      payloadId: captured.payloadId,
      rejections: captured.value.rejections,
    });

    const storedPayload = await this.rawPayloads.get(captured.payloadId);
    const sourceCutoff =
      storedPayload?.fetchedAt.toISOString() ??
      captured.value.items[0]?.sourceCutoff;
    const groups = groupStandings(
      captured.value.items.map((standing) => ({
        ...standing,
        ...(sourceCutoff ? { sourceCutoff } : {}),
      })),
    );
    const importedKeys: string[] = [];
    for (const [key, standings] of groups) {
      const seasonExternalId = standings[0]!.seasonExternalId;
      const context = await this.repository.resolveContext(seasonExternalId);
      if (!context) {
        counts.recordsFailed += standings.length;
        await this.issues.record({
          code: 'STANDINGS_SEASON_IDENTITY_NOT_FOUND',
          entityType: 'standing',
          executionId,
          externalKey: seasonExternalId,
          message: 'Standings season provider identity could not be resolved',
          payloadId: captured.payloadId,
          severity: IssueSeverity.ERROR,
        });
        continue;
      }
      const seenTeams = new Set<string>();
      const resolved: StandingImportInput[] = [];
      for (const standing of standings) {
        const abbreviation = standing.teamAbbreviation.toUpperCase();
        const teamId = context.teams.get(abbreviation);
        if (!teamId || seenTeams.has(abbreviation)) {
          counts.recordsFailed += 1;
          await this.issues.record({
            code: teamId
              ? 'STANDINGS_TEAM_DUPLICATE'
              : 'STANDINGS_TEAM_IDENTITY_NOT_FOUND',
            entityType: 'standing',
            executionId,
            externalKey: abbreviation,
            message: teamId
              ? 'Standings snapshot contained a duplicate team'
              : 'Standings team could not be resolved in the season league',
            payloadId: captured.payloadId,
            severity: IssueSeverity.ERROR,
          });
          continue;
        }
        seenTeams.add(abbreviation);
        if (
          standing.wins + standing.losses + standing.overtimeLosses !==
          standing.gamesPlayed
        ) {
          await this.issues.record({
            code: 'STANDINGS_RECORD_TOTAL_MISMATCH',
            details: {
              gamesPlayed: standing.gamesPlayed,
              losses: standing.losses,
              overtimeLosses: standing.overtimeLosses,
              wins: standing.wins,
            },
            entityType: 'standing',
            executionId,
            externalKey: abbreviation,
            message: 'Standing record does not sum to games played',
            payloadId: captured.payloadId,
            severity: IssueSeverity.WARNING,
          });
        }
        resolved.push({ standing, teamId });
      }
      if (parameters['dryRun'] !== true) {
        countMutations(
          counts,
          await this.repository.upsertSnapshot(context.seasonId, resolved),
        );
      }
      importedKeys.push(key);
    }
    if (parameters['dryRun'] !== true && groups.size > 0) {
      await this.rawPayloads.markProcessed(captured.payloadId);
    }
    return completedOutcome(counts, { snapshots: importedKeys.sort() });
  }
}

function groupStandings(
  standings: readonly ProviderStanding[],
): ReadonlyMap<string, ProviderStanding[]> {
  const groups = new Map<string, ProviderStanding[]>();
  for (const standing of standings) {
    const key = `${standing.seasonExternalId}:${standing.asOfDate}`;
    const group = groups.get(key) ?? [];
    group.push(standing);
    groups.set(key, group);
  }
  return groups;
}
