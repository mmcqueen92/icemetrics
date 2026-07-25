import { Inject, Injectable } from '@nestjs/common';
import { JobStatus, JobTrigger } from '../generated/prisma/client.js';

import { DispatcherService } from './dispatcher.service.js';
import { FrameworkJobService } from './framework-job.service.js';
import { parseJobArguments } from './job-parameters.js';
import { ReplayService } from './replay.service.js';
import { OperationalHealthService } from './operational-health.service.js';
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
    @Inject(OperationalHealthService)
    private readonly operationalHealth: OperationalHealthService,
  ) {}

  async execute(argv: readonly string[]): Promise<number> {
    const parsed = parseJobArguments(argv);
    if (parsed.command === 'health') {
      const health = await this.operationalHealth.check();
      process.stdout.write(`${JSON.stringify(health)}\n`);
      return health.status === 'ok' ? 0 : 1;
    }
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
