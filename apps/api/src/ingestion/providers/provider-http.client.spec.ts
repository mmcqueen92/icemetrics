import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { Environment } from '../../common/config/environment.js';
import {
  ProviderHttpClient,
  retryDelayMilliseconds,
} from './provider-http.client.js';

function config(
  overrides: Partial<Environment> = {},
): ConfigService<Environment, true> {
  return new ConfigService({
    APP_ENV: 'test',
    APP_VERSION: 'test',
    PROVIDER_MAX_CONCURRENCY: 2,
    PROVIDER_TIMEOUT_MS: 10,
    ...overrides,
  });
}

describe('ProviderHttpClient', () => {
  it('retries retryable responses and honors Retry-After', async () => {
    const providerFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('busy', {
          headers: { 'retry-after': '2' },
          status: 429,
        }),
      )
      .mockResolvedValueOnce(
        new Response('{"ok":true}', {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
      );
    const sleep = vi.fn(() => Promise.resolve());
    const client = new ProviderHttpClient(config(), {
      fetch: providerFetch,
      sleep,
    });

    const response = await client.get({
      endpointFamily: 'teams',
      url: new URL('https://provider.test/team'),
    });

    expect(response.httpStatus).toBe(200);
    expect(sleep).toHaveBeenCalledWith(2_000);
    expect(providerFetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable client responses', async () => {
    const providerFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('missing', { status: 404 }));
    const client = new ProviderHttpClient(config(), {
      fetch: providerFetch,
      sleep: vi.fn(() => Promise.resolve()),
    });

    await expect(
      client.get({
        endpointFamily: 'player',
        url: new URL('https://provider.test/player/0'),
      }),
    ).resolves.toMatchObject({ httpStatus: 404 });
    expect(providerFetch).toHaveBeenCalledOnce();
  });

  it('applies a timeout and stops after three retries', async () => {
    const providerFetch = vi.fn<typeof fetch>().mockImplementation(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('timed out', 'AbortError')),
            { once: true },
          );
        }),
    );
    const client = new ProviderHttpClient(config({ PROVIDER_TIMEOUT_MS: 5 }), {
      fetch: providerFetch,
      sleep: vi.fn(() => Promise.resolve()),
    });

    await expect(
      client.get({
        endpointFamily: 'schedule',
        url: new URL('https://provider.test/schedule/2026-01-01'),
      }),
    ).rejects.toMatchObject({ status: null });
    expect(providerFetch).toHaveBeenCalledTimes(4);
  });

  it('caps concurrent requests', async () => {
    let active = 0;
    let maximum = 0;
    const releases: Array<() => void> = [];
    const providerFetch = vi.fn<typeof fetch>().mockImplementation(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1;
      return new Response('{}', { status: 200 });
    });
    const client = new ProviderHttpClient(config(), {
      fetch: providerFetch,
    });
    const requests = Array.from({ length: 5 }, (_, index) =>
      client.get({
        endpointFamily: 'teams',
        url: new URL(`https://provider.test/${index}`),
      }),
    );

    await vi.waitFor(() => expect(releases).toHaveLength(2));
    for (let released = 0; released < 5; released += 1) {
      await vi.waitFor(() => expect(releases.length).toBeGreaterThan(0));
      releases.shift()?.();
    }
    await Promise.all(requests);

    expect(maximum).toBe(2);
  });
});

describe('retryDelayMilliseconds', () => {
  it('uses bounded exponential jitter without Retry-After', () => {
    expect(
      retryDelayMilliseconds(2, null, new Date('2026-01-01T00:00:00Z'), 0),
    ).toBe(1_000);
  });
});
