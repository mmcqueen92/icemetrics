import { Module } from '@nestjs/common';

import { ProvidersModule } from './providers/providers.module.js';
import { RawModule } from './raw/raw.module.js';
import { IngestionCaptureService } from './ingestion-capture.service.js';
import { PlayersImportService } from './reference/players-import.service.js';
import { ReferenceImportRepository } from './reference/reference-import.repository.js';
import { TeamsImportService } from './reference/teams-import.service.js';
import { GameImportRepository } from './games/game-import.repository.js';
import { GameStatisticsImportService } from './games/game-statistics-import.service.js';
import { ScheduleImportService } from './games/schedule-import.service.js';
import { StandingsImportRepository } from './standings/standings-import.repository.js';
import { StandingsImportService } from './standings/standings-import.service.js';

@Module({
  exports: [
    IngestionCaptureService,
    GameStatisticsImportService,
    PlayersImportService,
    ProvidersModule,
    RawModule,
    ScheduleImportService,
    StandingsImportService,
    TeamsImportService,
  ],
  imports: [ProvidersModule, RawModule],
  providers: [
    GameImportRepository,
    GameStatisticsImportService,
    IngestionCaptureService,
    PlayersImportService,
    ReferenceImportRepository,
    ScheduleImportService,
    StandingsImportRepository,
    StandingsImportService,
    TeamsImportService,
  ],
})
export class IngestionModule {}
