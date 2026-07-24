import { Module } from '@nestjs/common';

import { TeamsController } from './controllers/teams.controller.js';
import { TeamsRepository } from './repositories/teams.repository.js';
import { TeamsService } from './services/teams.service.js';

@Module({
  controllers: [TeamsController],
  providers: [TeamsRepository, TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
