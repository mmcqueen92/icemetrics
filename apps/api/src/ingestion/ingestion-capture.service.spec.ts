import { describe, expect, it, vi } from 'vitest';

import { ProviderValidationError } from './providers/provider.errors.js';
import type { ProviderFetch } from './providers/provider.types.js';
import { IngestionCaptureService } from './ingestion-capture.service.js';

describe('IngestionCaptureService', () => {
  it('stores raw bytes before validation', async () => {
    const events: string[] = [];
    const rawPayloads = {
      markRejected: vi.fn(),
      markValidated: vi.fn(() => {
        events.push('validated');
        return Promise.resolve();
      }),
      store: vi.fn(() => {
        events.push('stored');
        return Promise.resolve({
          created: true,
          payload: { id: 'payload-id' },
        });
      }),
    };
    const service = new IngestionCaptureService(
      { record: vi.fn() } as never,
      rawPayloads as never,
    );
    const fetch = providerFetch(() => {
      events.push('transformed');
      return [{ externalId: '10' }];
    });

    await service.captureAndValidate(fetch, 'execution-id');

    expect(events).toEqual(['stored', 'transformed', 'validated']);
  });

  it('preserves and rejects invalid raw payloads with an import issue', async () => {
    const issues = { record: vi.fn() };
    const rawPayloads = {
      markRejected: vi.fn(),
      markValidated: vi.fn(),
      store: vi.fn(() =>
        Promise.resolve({
          created: true,
          payload: { id: 'payload-id' },
        }),
      ),
    };
    const service = new IngestionCaptureService(
      issues as never,
      rawPayloads as never,
    );
    const fetch = providerFetch(() => {
      throw new ProviderValidationError('teams', ['data: required']);
    });

    await expect(
      service.captureAndValidate(fetch, 'execution-id'),
    ).rejects.toBeInstanceOf(ProviderValidationError);
    expect(rawPayloads.markRejected).toHaveBeenCalledWith('payload-id');
    expect(issues.record).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PROVIDER_SCHEMA_INVALID',
        payloadId: 'payload-id',
      }),
    );
  });
});

function providerFetch<T>(validate: () => T): ProviderFetch<T> {
  return {
    body: new TextEncoder().encode('{}'),
    contentType: 'application/json',
    descriptor: {
      externalKey: 'nhl',
      parameters: {},
      path: '/team',
      resourceType: 'teams',
    },
    fetchedAt: new Date('2026-01-01T00:00:00Z'),
    httpStatus: 200,
    provider: 'nhl',
    validate,
  };
}
