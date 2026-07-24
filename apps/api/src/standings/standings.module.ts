import { Module } from '@nestjs/common';

import { StandingsController } from './controllers/standings.controller.js';
import { StandingsRepository } from './repositories/standings.repository.js';
import { StandingsService } from './services/standings.service.js';

@Module({
  controllers: [StandingsController],
  providers: [StandingsRepository, StandingsService],
})
export class StandingsModule {}
