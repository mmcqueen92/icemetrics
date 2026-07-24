import { Inject, Injectable } from '@nestjs/common';

import {
  IssueSeverity,
  JobStatus,
  JobType,
} from '../../generated/prisma/client.js';
import type { JobOutcome } from '../../jobs/job.types.js';
import { IngestionCaptureService } from '../ingestion-capture.service.js';
import type { HockeyDataProvider } from '../providers/provider.types.js';
import { HOCKEY_DATA_PROVIDER } from '../providers/providers.module.js';
import { ImportIssueService } from '../raw/import-issue.service.js';
import { RawPayloadService } from '../raw/raw-payload.service.js';
import {
  completedOutcome,
  countMutations,
  emptyCounts,
  recordRejections,
} from './reference-job.helpers.js';
import { ReferenceImportRepository } from './reference-import.repository.js';
import { evaluateSnapshotAbsences } from './snapshot-policy.js';

const SMALL_ROSTER_THRESHOLD = 15;
type RosterProvider = Pick<HockeyDataProvider, 'getRoster'>;

@Injectable()
export class PlayersImportService {
  constructor(
    @Inject(HOCKEY_DATA_PROVIDER)
    private readonly provider: RosterProvider,
    @Inject(IngestionCaptureService)
    private readonly capture: IngestionCaptureService,
    @Inject(ReferenceImportRepository)
    private readonly repository: ReferenceImportRepository,
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
    const context = await this.repository.getRosterContext({
      date: new Date(),
      ...(typeof parameters['seasonId'] === 'string'
        ? { seasonId: parameters['seasonId'] }
        : {}),
    });
    if (!context) {
      return {
        counts,
        errorSummary: { code: 'NO_ACTIVE_SEASON' },
        status: JobStatus.SKIPPED,
      };
    }
    if (context.teams.length === 0) {
      return {
        counts,
        errorSummary: { code: 'NO_ACTIVE_TEAMS' },
        status: JobStatus.SKIPPED,
      };
    }

    const seen = new Set<string>();
    let completeSnapshot = true;
    for (const team of context.teams) {
      let fetch;
      try {
        fetch = await this.provider.getRoster(
          team.abbreviation,
          context.seasonExternalId,
        );
      } catch {
        counts.recordsFailed += 1;
        completeSnapshot = false;
        await this.issues.record({
          code: 'ROSTER_FETCH_FAILED',
          entityType: 'roster',
          executionId,
          externalKey: team.externalId,
          message: 'Team roster could not be fetched',
          severity: IssueSeverity.ERROR,
        });
        continue;
      }

      let captured;
      try {
        captured = await this.capture.captureAndValidate(fetch, executionId);
      } catch {
        counts.recordsFailed += 1;
        completeSnapshot = false;
        continue;
      }

      const roster = captured.value;
      counts.recordsFetched += roster.items.length + roster.rejections.length;
      counts.recordsFailed += roster.rejections.length;
      if (roster.rejections.length > 0) {
        completeSnapshot = false;
        await recordRejections(this.issues, {
          entityType: 'player',
          executionId,
          payloadId: captured.payloadId,
          rejections: roster.rejections,
        });
      }
      if (roster.items.length < SMALL_ROSTER_THRESHOLD) {
        await this.issues.record({
          code: 'ROSTER_UNEXPECTEDLY_SMALL',
          details: {
            playerCount: roster.items.length,
            threshold: SMALL_ROSTER_THRESHOLD,
          },
          entityType: 'roster',
          executionId,
          externalKey: team.externalId,
          message: 'Team roster contained fewer players than expected',
          payloadId: captured.payloadId,
          severity: IssueSeverity.WARNING,
        });
      }
      const uniquePlayers = [];
      for (const player of roster.items) {
        if (seen.has(player.externalId)) {
          counts.recordsFailed += 1;
          completeSnapshot = false;
          await this.issues.record({
            code: 'PLAYER_DUPLICATE_ACROSS_ROSTERS',
            entityType: 'player',
            executionId,
            externalKey: player.externalId,
            message: 'Player appeared on more than one active team roster',
            payloadId: captured.payloadId,
            severity: IssueSeverity.ERROR,
          });
          continue;
        }
        seen.add(player.externalId);
        uniquePlayers.push({ player, teamId: team.id });
      }
      if (parameters['dryRun'] !== true) {
        try {
          countMutations(
            counts,
            await this.repository.upsertRoster(uniquePlayers),
          );
          await this.rawPayloads.markProcessed(captured.payloadId);
        } catch {
          counts.recordsFailed += 1;
          completeSnapshot = false;
          await this.issues.record({
            code: 'ROSTER_TRANSFORM_FAILED',
            entityType: 'roster',
            executionId,
            externalKey: team.externalId,
            message: 'Team roster transaction could not be committed',
            payloadId: captured.payloadId,
            severity: IssueSeverity.ERROR,
          });
        }
      }
    }

    const cursor = { externalIds: [...seen].sort() };
    if (parameters['dryRun'] !== true && completeSnapshot) {
      await this.applyAbsencePolicy(executionId, seen, counts);
    }
    return completedOutcome(counts, cursor);
  }

  private async applyAbsencePolicy(
    executionId: string,
    currentExternalIds: ReadonlySet<string>,
    counts: ReturnType<typeof emptyCounts>,
  ): Promise<void> {
    const active = new Set(await this.repository.activeExternalIds('player'));
    const previous = await this.repository.previousSuccessfulSnapshots(
      JobType.PLAYERS,
    );
    const policy = evaluateSnapshotAbsences(
      active,
      currentExternalIds,
      previous,
    );
    for (const warning of policy.warnings) {
      await this.issues.record({
        code: 'REFERENCE_ENTITY_ABSENT',
        details: { consecutiveSuccessfulSnapshots: warning.absenceCount },
        entityType: 'player',
        executionId,
        externalKey: warning.externalId,
        message: 'Active player was absent from successful roster snapshots',
        severity: IssueSeverity.WARNING,
      });
    }
    counts.recordsUpdated += await this.repository.inactivate(
      'player',
      policy.deactivate,
    );
  }
}
