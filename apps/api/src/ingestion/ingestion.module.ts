import { Module } from '@nestjs/common';

import { ProvidersModule } from './providers/providers.module.js';
import { RawModule } from './raw/raw.module.js';
import { IngestionCaptureService } from './ingestion-capture.service.js';

@Module({
  exports: [IngestionCaptureService, ProvidersModule, RawModule],
  imports: [ProvidersModule, RawModule],
  providers: [IngestionCaptureService],
})
export class IngestionModule {}
