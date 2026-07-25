import { Module } from '@nestjs/common';

import { AnalyticsController } from './controllers/analytics.controller.js';
import { AnalyticsRefreshRepository } from './repositories/analytics-refresh.repository.js';
import { AnalyticsRepository } from './repositories/analytics.repository.js';
import { AnalyticsRefreshService } from './services/analytics-refresh.service.js';
import { AnalyticsService } from './services/analytics.service.js';

@Module({
  controllers: [AnalyticsController],
  exports: [AnalyticsRefreshService],
  providers: [
    AnalyticsRefreshRepository,
    AnalyticsRefreshService,
    AnalyticsRepository,
    AnalyticsService,
  ],
})
export class AnalyticsModule {}
