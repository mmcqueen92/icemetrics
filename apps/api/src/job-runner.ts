import { NestFactory } from '@nestjs/core';

import { JobRunnerModule } from './job-runner.module.js';
import { JobCliService } from './jobs/job-cli.service.js';

async function bootstrap(): Promise<void> {
  const context = await NestFactory.createApplicationContext(JobRunnerModule, {
    logger: false,
  });
  try {
    const exitCode = await context
      .get(JobCliService)
      .execute(process.argv.slice(2));
    process.exitCode = exitCode;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Job runner failed'}\n`,
    );
    process.exitCode = 1;
  } finally {
    await context.close();
  }
}

void bootstrap();
