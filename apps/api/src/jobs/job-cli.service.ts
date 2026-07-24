import { Inject, Injectable } from '@nestjs/common';
import { JobStatus, JobTrigger } from '../generated/prisma/client.js';

import { DispatcherService } from './dispatcher.service.js';
import { FrameworkJobService } from './framework-job.service.js';
import { parseJobArguments } from './job-parameters.js';
import { ReplayService } from './replay.service.js';
import type { JobRunResult } from './job.types.js';

@Injectable()
export class JobCliService {
  constructor(
    @Inject(DispatcherService)
    private readonly dispatcher: DispatcherService,
    @Inject(FrameworkJobService)
    private readonly jobs: FrameworkJobService,
    @Inject(ReplayService)
    private readonly replay: ReplayService,
  ) {}

  async execute(argv: readonly string[]): Promise<number> {
    const parsed = parseJobArguments(argv);
    let result: JobRunResult;
    if (parsed.command === 'dispatch') {
      result = await this.dispatcher.dispatch();
    } else if (parsed.command === 'replay') {
      result = await this.replay.replay(parsed.payloadId!);
    } else {
      result = await this.jobs.run(
        parsed.jobType!,
        JobTrigger.MANUAL,
        parsed.parameters,
      );
    }
    return exitCode(result);
  }
}

function exitCode(result: JobRunResult): number {
  if (result.status === JobStatus.FAILED) {
    return 1;
  }
  if (
    result.status === JobStatus.PARTIAL &&
    result.counts.recordsFailed / Math.max(1, result.counts.recordsFetched) >
      0.01
  ) {
    return 1;
  }
  return 0;
}
