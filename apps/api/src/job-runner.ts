import { NestFactory } from '@nestjs/core';

import { JobRunnerModule } from './job-runner.module.js';
import { JobCliService } from './jobs/job-cli.service.js';
import { ErrorTrackingService } from './common/observability/error-tracking.service.js';

async function bootstrap(): Promise<void> {
  const context = await NestFactory.createApplicationContext(JobRunnerModule, {
    logger: false,
  });
  const errorTracking = context.get(ErrorTrackingService);
  try {
    const exitCode = await context
      .get(JobCliService)
      .execute(process.argv.slice(2));
    process.exitCode = exitCode;
  } catch (error) {
    errorTracking.captureException(error, { service: 'jobs' });
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Job runner failed'}\n`,
    );
    process.exitCode = 1;
  } finally {
    await errorTracking.flush();
    await context.close();
  }
}

void bootstrap();
