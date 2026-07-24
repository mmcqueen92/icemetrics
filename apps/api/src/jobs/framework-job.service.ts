import { Inject, Injectable } from '@nestjs/common';
import {
  JobStatus,
  JobTrigger,
  type JobType,
} from '../generated/prisma/client.js';
import { PlayersImportService } from '../ingestion/reference/players-import.service.js';
import { TeamsImportService } from '../ingestion/reference/teams-import.service.js';

import { JobCoordinatorService } from './job-coordinator.service.js';
import { EMPTY_JOB_COUNTS, type JobRunResult } from './job.types.js';

@Injectable()
export class FrameworkJobService {
  constructor(
    @Inject(JobCoordinatorService)
    private readonly coordinator: JobCoordinatorService,
    @Inject(PlayersImportService)
    private readonly players: PlayersImportService,
    @Inject(TeamsImportService)
    private readonly teams: TeamsImportService,
  ) {}

  run(
    jobType: JobType,
    trigger: JobTrigger,
    parameters: Readonly<Record<string, unknown>>,
    scheduledFor?: Date,
  ): Promise<JobRunResult> {
    return this.coordinator.run(
      {
        jobType,
        parameters,
        ...(scheduledFor ? { scheduledFor } : {}),
        trigger,
      },
      (executionId) => {
        if (jobType === 'TEAMS') {
          return this.teams.execute(executionId, parameters);
        }
        if (jobType === 'PLAYERS') {
          return this.players.execute(executionId, parameters);
        }
        return Promise.resolve({
          counts: EMPTY_JOB_COUNTS,
          errorSummary: {
            code: 'TRANSFORM_NOT_IMPLEMENTED',
            message: `${jobType} transformation begins in a later pass`,
          },
          status: JobStatus.SKIPPED,
        });
      },
    );
  }
}
