import { Module } from '@nestjs/common';

import { IngestionModule } from '../ingestion/ingestion.module.js';
import { AdvisoryLockService } from './advisory-lock.service.js';
import { DispatcherService } from './dispatcher.service.js';
import { FrameworkJobService } from './framework-job.service.js';
import { JobCliService } from './job-cli.service.js';
import { JobCompletionLogger } from './job-completion.logger.js';
import { JobCoordinatorService } from './job-coordinator.service.js';
import { JobExecutionService } from './job-execution.service.js';
import { ReplayService } from './replay.service.js';

@Module({
  exports: [
    DispatcherService,
    FrameworkJobService,
    JobCliService,
    JobCoordinatorService,
    JobExecutionService,
    ReplayService,
  ],
  imports: [IngestionModule],
  providers: [
    AdvisoryLockService,
    DispatcherService,
    FrameworkJobService,
    JobCliService,
    JobCompletionLogger,
    JobCoordinatorService,
    JobExecutionService,
    ReplayService,
  ],
})
export class JobsModule {}
