import { Module } from '@nestjs/common';

import { ProvidersModule } from './providers/providers.module.js';
import { RawModule } from './raw/raw.module.js';
import { IngestionCaptureService } from './ingestion-capture.service.js';
import { PlayersImportService } from './reference/players-import.service.js';
import { ReferenceImportRepository } from './reference/reference-import.repository.js';
import { TeamsImportService } from './reference/teams-import.service.js';

@Module({
  exports: [
    IngestionCaptureService,
    PlayersImportService,
    ProvidersModule,
    RawModule,
    TeamsImportService,
  ],
  imports: [ProvidersModule, RawModule],
  providers: [
    IngestionCaptureService,
    PlayersImportService,
    ReferenceImportRepository,
    TeamsImportService,
  ],
})
export class IngestionModule {}
