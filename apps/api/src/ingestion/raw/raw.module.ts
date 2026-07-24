import { Module } from '@nestjs/common';

import { RawPayloadService } from './raw-payload.service.js';
import { ImportIssueService } from './import-issue.service.js';

@Module({
  exports: [ImportIssueService, RawPayloadService],
  providers: [ImportIssueService, RawPayloadService],
})
export class RawModule {}
