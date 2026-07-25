import { Global, Module } from '@nestjs/common';

import { ErrorTrackingService } from './error-tracking.service.js';

@Global()
@Module({
  exports: [ErrorTrackingService],
  providers: [ErrorTrackingService],
})
export class ObservabilityModule {}
