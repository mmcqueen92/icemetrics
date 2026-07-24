import { Inject, Injectable } from '@nestjs/common';
import { JobStatus, JobTrigger, JobType } from '../generated/prisma/client.js';

import { dueJobs } from './dispatch-policy.js';
import { FrameworkJobService } from './framework-job.service.js';
import { JobCoordinatorService } from './job-coordinator.service.js';
import { JobExecutionService } from './job-execution.service.js';
import { EMPTY_JOB_COUNTS, type JobRunResult } from './job.types.js';

const LOGICAL_JOBS = [
  JobType.TEAMS,
  JobType.PLAYERS,
  JobType.SCHEDULE,
  JobType.GAME_STATISTICS,
  JobType.STANDINGS,
  JobType.ANALYTICS,
] as const;

@Injectable()
export class DispatcherService {
  constructor(
    @Inject(JobCoordinatorService)
    private readonly coordinator: JobCoordinatorService,
    @Inject(JobExecutionService)
    private readonly executions: JobExecutionService,
    @Inject(FrameworkJobService)
    private readonly frameworkJobs: FrameworkJobService,
  ) {}

  dispatch(now = new Date()): Promise<JobRunResult> {
    return this.coordinator.run(
      {
        jobType: JobType.DISPATCH,
        parameters: { at: now.toISOString() },
        scheduledFor: now,
        trigger: JobTrigger.SCHEDULED,
      },
      async () => {
        const reconciled = await this.executions.reconcileAbandoned(now);
        const activeSeason = await this.executions.isActiveSeason(now);
        const latestEntries = await Promise.all(
          LOGICAL_JOBS.map(
            async (jobType) =>
              [
                jobType,
                await this.executions.latestSuccessfulAt(jobType),
              ] as const,
          ),
        );
        const scheduled = dueJobs({
          activeSeason,
          latestSuccessful: Object.fromEntries(latestEntries),
          now,
        });
        const results: JobRunResult[] = [];
        for (const jobType of scheduled) {
          results.push(
            await this.frameworkJobs.run(
              jobType,
              JobTrigger.SCHEDULED,
              {},
              now,
            ),
          );
        }
        const failed = results.some(
          (result) => result.status === JobStatus.FAILED,
        );
        return {
          counts: {
            ...EMPTY_JOB_COUNTS,
            recordsFailed: failed ? 1 : 0,
            recordsFetched: results.length,
          },
          errorSummary: {
            childExecutions: results.map((result) => result.executionId),
            reconciledAbandoned: reconciled,
          },
          status: failed ? JobStatus.FAILED : JobStatus.SUCCEEDED,
        };
      },
    );
  }
}
