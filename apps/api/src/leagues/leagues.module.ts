import { Module } from '@nestjs/common';

import { LeaguesController } from './controllers/leagues.controller.js';
import { LeaguesRepository } from './repositories/leagues.repository.js';
import { LeaguesService } from './services/leagues.service.js';

@Module({
  controllers: [LeaguesController],
  providers: [LeaguesRepository, LeaguesService],
  exports: [LeaguesService],
})
export class LeaguesModule {}
