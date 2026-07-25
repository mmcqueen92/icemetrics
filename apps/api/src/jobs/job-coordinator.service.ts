import { Inject, Injectable } from '@nestjs/common';
import { JobStatus } from '../generated/prisma/client.js';

import { AdvisoryLockService } from './advisory-lock.service.js';
import { JobCompletionLogger } from './job-completion.logger.js';
import { JobExecutionService } from './job-execution.service.js';
import { ErrorTrackingService } from '../common/observability/error-tracking.service.js';
import {
  EMPTY_JOB_COUNTS,
  type JobOutcome,
  type JobRunRequest,
  type JobRunResult,
} from './job.types.js';

@Injectable()
export class JobCoordinatorService {
  constructor(
    @Inject(JobExecutionService)
    private readonly executions: JobExecutionService,
    @Inject(AdvisoryLockService)
    private readonly locks: AdvisoryLockService,
    @Inject(JobCompletionLogger)
    private readonly logger: JobCompletionLogger,
    @Inject(ErrorTrackingService)
    private readonly errorTracking: ErrorTrackingService,
  ) {}

  async run(
    request: JobRunRequest,
    operation: (executionId: string) => Promise<JobOutcome>,
  ): Promise<JobRunResult> {
    const started = performance.now();
    const executionId = await this.executions.create(request);
    const lockKey = jobLockKey(request);
    try {
      await this.executions.start(executionId);
      const locked = await this.locks.withLock(lockKey, async () => {
        return operation(executionId);
      });
      const outcome: JobOutcome = locked.acquired
        ? locked.value
        : {
            counts: EMPTY_JOB_COUNTS,
            errorSummary: { code: 'LOCK_UNAVAILABLE' },
            status: JobStatus.SKIPPED,
          };
      await this.executions.complete(executionId, outcome);
      const result = { ...outcome, executionId };
      this.logger.completed(
        request.jobType,
        result,
        Math.round(performance.now() - started),
      );
      return result;
    } catch (error) {
      this.errorTracking.captureException(error, {
        jobExecutionId: executionId,
        jobType: request.jobType,
        service: 'jobs',
      });
      await this.executions.fail(executionId, error);
      const failed: JobRunResult = {
        counts: { ...EMPTY_JOB_COUNTS, recordsFailed: 1 },
        errorSummary: { code: 'JOB_FAILED' },
        executionId,
        status: JobStatus.FAILED,
      };
      this.logger.completed(
        request.jobType,
        failed,
        Math.round(performance.now() - started),
      );
      return failed;
    }
  }
}

function jobLockKey(request: JobRunRequest): string {
  if (request.jobType === 'DISPATCH') {
    return 'icemetrics:dispatcher';
  }
  const scope = Object.entries(request.parameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&');
  return `icemetrics:job:${request.jobType}:${scope}`;
}
