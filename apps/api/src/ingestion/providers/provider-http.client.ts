import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../common/config/environment.js';
import { ProviderHttpError } from './provider.errors.js';

const RETRYABLE_STATUS_CODES = new Set([408, 429]);
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;
const MAX_RETRY_AFTER_MS = 30_000;
export const PROVIDER_HTTP_CLIENT_DEPENDENCIES = Symbol(
  'PROVIDER_HTTP_CLIENT_DEPENDENCIES',
);

export interface ProviderHttpResponse {
  body: Uint8Array;
  contentType: string | null;
  fetchedAt: Date;
  httpStatus: number;
}

export interface ProviderHttpRequest {
  endpointFamily: string;
  url: URL;
}

export interface ProviderHttpClientDependencies {
  fetch: typeof fetch;
  now: () => Date;
  random: () => number;
  sleep: (milliseconds: number) => Promise<void>;
}

@Injectable()
export class ProviderHttpClient {
  private readonly dependencies: ProviderHttpClientDependencies;
  private readonly semaphore: Semaphore;
  private readonly timeoutMs: number;
  private readonly userAgent: string;

  constructor(
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Optional()
    @Inject(PROVIDER_HTTP_CLIENT_DEPENDENCIES)
    dependencies: Partial<ProviderHttpClientDependencies> = {},
  ) {
    this.timeoutMs = config.get('PROVIDER_TIMEOUT_MS', { infer: true });
    this.semaphore = new Semaphore(
      config.get('PROVIDER_MAX_CONCURRENCY', { infer: true }),
    );
    const version = config.get('APP_VERSION', { infer: true }) ?? 'development';
    this.userAgent = `IceMetrics/${version} (+https://github.com/icemetrics)`;
    this.dependencies = {
      fetch: dependencies.fetch ?? globalThis.fetch,
      now: dependencies.now ?? (() => new Date()),
      random: dependencies.random ?? Math.random,
      sleep:
        dependencies.sleep ??
        ((milliseconds) =>
          new Promise((resolve) => setTimeout(resolve, milliseconds))),
    };
  }

  async get(request: ProviderHttpRequest): Promise<ProviderHttpResponse> {
    return this.semaphore.run(async () => {
      for (let attempt = 0; ; attempt += 1) {
        try {
          const response = await this.dependencies.fetch(request.url, {
            headers: {
              Accept: 'application/json',
              'User-Agent': this.userAgent,
            },
            signal: AbortSignal.timeout(this.timeoutMs),
          });

          if (response.ok) {
            return readResponse(response, this.dependencies.now());
          }

          if (!isRetryableStatus(response.status) || attempt >= MAX_RETRIES) {
            return readResponse(response, this.dependencies.now());
          }

          await this.dependencies.sleep(
            retryDelayMilliseconds(
              attempt,
              response.headers.get('retry-after'),
              this.dependencies.now(),
              this.dependencies.random(),
            ),
          );
        } catch (error) {
          if (error instanceof ProviderHttpError) {
            throw error;
          }

          if (attempt >= MAX_RETRIES) {
            throw new ProviderHttpError(
              'Provider request failed after retries',
              request.endpointFamily,
              null,
            );
          }

          await this.dependencies.sleep(
            retryDelayMilliseconds(
              attempt,
              null,
              this.dependencies.now(),
              this.dependencies.random(),
            ),
          );
        }
      }
    });
  }
}

async function readResponse(
  response: Response,
  fetchedAt: Date,
): Promise<ProviderHttpResponse> {
  return {
    body: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get('content-type'),
    fetchedAt,
    httpStatus: response.status,
  };
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status) || status >= 500;
}

export function retryDelayMilliseconds(
  attempt: number,
  retryAfter: string | null,
  now: Date,
  random: number,
): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1_000, MAX_RETRY_AFTER_MS);
    }

    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) {
      return Math.min(Math.max(0, date - now.getTime()), MAX_RETRY_AFTER_MS);
    }
  }

  const exponential = INITIAL_BACKOFF_MS * 2 ** attempt;
  return Math.round(exponential * (0.5 + random * 0.5));
}

class Semaphore {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly capacity: number) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.active < this.capacity) {
      this.active += 1;
      return;
    }

    await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active += 1;
  }

  private release(): void {
    this.active -= 1;
    this.waiting.shift()?.();
  }
}
