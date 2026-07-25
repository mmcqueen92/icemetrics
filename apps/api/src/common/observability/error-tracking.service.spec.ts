import { describe, expect, it, vi } from 'vitest';

import { ErrorTrackingService } from './error-tracking.service.js';

vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
  flush: vi.fn().mockResolvedValue(true),
  init: vi.fn(),
  withScope: (callback: (scope: { setTag(): void }) => void) =>
    callback({ setTag: vi.fn() }),
}));

function config(values: Record<string, string | undefined>) {
  return {
    get: vi.fn((key: string) => values[key]),
  };
}

describe('ErrorTrackingService', () => {
  it('remains inert without a DSN', async () => {
    const service = new ErrorTrackingService(config({}) as never);
    service.captureException(new Error('ignored'));
    await expect(service.flush()).resolves.toBe(true);
  });

  it('initializes and captures errors when configured', async () => {
    const Sentry = await import('@sentry/node');
    const service = new ErrorTrackingService(
      config({
        APP_VERSION: 'abc123',
        SENTRY_DSN: 'https://public@example.invalid/1',
        SENTRY_ENVIRONMENT: 'staging',
      }) as never,
    );
    service.captureException(new Error('failure'), { jobType: 'SCHEDULE' });
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: 'staging',
        release: 'abc123',
        sendDefaultPii: false,
      }),
    );
    expect(Sentry.captureException).toHaveBeenCalled();
    await expect(service.flush()).resolves.toBe(true);
  });
});
