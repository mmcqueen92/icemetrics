import { Module } from '@nestjs/common';

import { SeasonsController } from './controllers/seasons.controller.js';
import { SeasonsRepository } from './repositories/seasons.repository.js';
import { SeasonsService } from './services/seasons.service.js';

@Module({
  controllers: [SeasonsController],
  providers: [SeasonsRepository, SeasonsService],
  exports: [SeasonsService],
})
export class SeasonsModule {}
