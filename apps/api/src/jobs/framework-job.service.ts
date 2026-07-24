import { Inject, Injectable } from '@nestjs/common';
import {
  JobStatus,
  JobTrigger,
  type JobType,
} from '../generated/prisma/client.js';

import { JobCoordinatorService } from './job-coordinator.service.js';
import { EMPTY_JOB_COUNTS, type JobRunResult } from './job.types.js';

@Injectable()
export class FrameworkJobService {
  constructor(
    @Inject(JobCoordinatorService)
    private readonly coordinator: JobCoordinatorService,
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
      () =>
        Promise.resolve({
          counts: EMPTY_JOB_COUNTS,
          errorSummary: {
            code: 'TRANSFORM_NOT_IMPLEMENTED',
            message: `${jobType} transformation begins in a later pass`,
          },
          status: JobStatus.SKIPPED,
        }),
    );
  }
}
