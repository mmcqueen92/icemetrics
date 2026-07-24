import { Inject, Injectable } from '@nestjs/common';

import { IssueSeverity } from '../generated/prisma/client.js';
import { ProviderValidationError } from './providers/provider.errors.js';
import type { ProviderFetch } from './providers/provider.types.js';
import { ImportIssueService } from './raw/import-issue.service.js';
import { RawPayloadService } from './raw/raw-payload.service.js';

export interface CapturedProviderResult<T> {
  created: boolean;
  payloadId: string;
  value: T;
}

@Injectable()
export class IngestionCaptureService {
  constructor(
    @Inject(ImportIssueService)
    private readonly issues: ImportIssueService,
    @Inject(RawPayloadService)
    private readonly rawPayloads: RawPayloadService,
  ) {}

  async captureAndValidate<T>(
    fetch: ProviderFetch<T>,
    executionId: string,
  ): Promise<CapturedProviderResult<T>> {
    const stored = await this.rawPayloads.store(fetch, executionId);
    try {
      const value = fetch.validate();
      await this.rawPayloads.markValidated(stored.payload.id);
      return {
        created: stored.created,
        payloadId: stored.payload.id,
        value,
      };
    } catch (error) {
      await this.rawPayloads.markRejected(stored.payload.id);
      await this.issues.record({
        code: 'PROVIDER_SCHEMA_INVALID',
        ...(error instanceof ProviderValidationError
          ? { details: { issues: [...error.issues] } }
          : {}),
        entityType: fetch.descriptor.resourceType,
        executionId,
        externalKey: fetch.descriptor.externalKey,
        message: 'Provider response failed runtime validation',
        payloadId: stored.payload.id,
        severity: IssueSeverity.ERROR,
      });
      throw error;
    }
  }
}
