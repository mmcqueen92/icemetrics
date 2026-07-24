import { Inject, Injectable } from '@nestjs/common';

import {
  IssueSeverity,
  JobStatus,
  JobTrigger,
  JobType,
} from '../generated/prisma/client.js';
import { NhlDataProvider } from '../ingestion/providers/nhl/nhl-data.provider.js';
import { ProviderValidationError } from '../ingestion/providers/provider.errors.js';
import type { ProviderResourceType } from '../ingestion/providers/provider.types.js';
import { ImportIssueService } from '../ingestion/raw/import-issue.service.js';
import { RawPayloadService } from '../ingestion/raw/raw-payload.service.js';
import { JobCoordinatorService } from './job-coordinator.service.js';
import { EMPTY_JOB_COUNTS, type JobRunResult } from './job.types.js';

const JOB_BY_RESOURCE: Readonly<Record<ProviderResourceType, JobType>> = {
  'game-boxscore': JobType.GAME_STATISTICS,
  'game-team-stats': JobType.GAME_STATISTICS,
  player: JobType.PLAYERS,
  roster: JobType.PLAYERS,
  schedule: JobType.SCHEDULE,
  season: JobType.TEAMS,
  standings: JobType.STANDINGS,
  'team-season-schedule': JobType.SCHEDULE,
  teams: JobType.TEAMS,
};

@Injectable()
export class ReplayService {
  constructor(
    @Inject(JobCoordinatorService)
    private readonly coordinator: JobCoordinatorService,
    @Inject(ImportIssueService)
    private readonly issues: ImportIssueService,
    @Inject(NhlDataProvider)
    private readonly nhl: NhlDataProvider,
    @Inject(RawPayloadService)
    private readonly rawPayloads: RawPayloadService,
  ) {}

  async replay(payloadId: string): Promise<JobRunResult> {
    const payload = await this.rawPayloads.get(payloadId);
    if (!payload) {
      throw new Error(`Raw provider payload ${payloadId} was not found`);
    }
    if (
      payload.provider !== 'nhl' ||
      !isProviderResource(payload.resourceType)
    ) {
      throw new Error(
        'Raw provider payload is not supported by the NHL adapter',
      );
    }
    const resourceType = payload.resourceType;

    return this.coordinator.run(
      {
        jobType: JOB_BY_RESOURCE[resourceType],
        parameters: { payloadId },
        trigger: JobTrigger.REPLAY,
      },
      async (executionId) => {
        try {
          const value = JSON.parse(
            new TextDecoder().decode(payload.body),
          ) as unknown;
          this.nhl.validateStoredPayload(
            resourceType,
            value,
            payload.parameters,
            payload.fetchedAt,
          );
          await this.rawPayloads.markValidated(payload.id);
          return {
            counts: {
              ...EMPTY_JOB_COUNTS,
              recordsFetched: 1,
              recordsUnchanged: 1,
            },
            status: JobStatus.SUCCEEDED,
          };
        } catch (error) {
          await this.rawPayloads.markRejected(payload.id);
          await this.issues.record({
            code: 'PROVIDER_SCHEMA_INVALID',
            ...(error instanceof ProviderValidationError
              ? { details: { issues: [...error.issues] } }
              : {}),
            entityType: resourceType,
            executionId,
            externalKey: payload.externalKey,
            message: 'Stored provider payload failed replay validation',
            payloadId: payload.id,
            severity: IssueSeverity.ERROR,
          });
          throw error;
        }
      },
    );
  }
}

function isProviderResource(value: string): value is ProviderResourceType {
  return value in JOB_BY_RESOURCE;
}
