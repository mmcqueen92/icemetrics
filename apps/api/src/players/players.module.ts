import { Module } from '@nestjs/common';

import { PlayersController } from './controllers/players.controller.js';
import { PlayersRepository } from './repositories/players.repository.js';
import { PlayersService } from './services/players.service.js';

@Module({
  controllers: [PlayersController],
  providers: [PlayersRepository, PlayersService],
  exports: [PlayersService],
})
export class PlayersModule {}
