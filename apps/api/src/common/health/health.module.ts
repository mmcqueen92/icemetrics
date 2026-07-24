import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module.js';
import { DatabaseHealthService } from './database-health.service.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [DatabaseHealthService],
})
export class HealthModule {}
