import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

import type { Environment } from '../config/environment.js';

const SENSITIVE_KEY =
  /authorization|cookie|database|dsn|password|payload|query|secret|token/i;

@Injectable()
export class ErrorTrackingService {
  private readonly enabled: boolean;

  constructor(
    @Inject(ConfigService)
    config: ConfigService<Environment, true>,
  ) {
    const dsn = config.get('SENTRY_DSN', { infer: true });
    this.enabled = dsn !== undefined;
    if (dsn) {
      Sentry.init({
        beforeSend: (event) => scrubValue(event) as typeof event,
        dsn,
        environment: config.get('SENTRY_ENVIRONMENT', { infer: true }),
        release: config.get('APP_VERSION', { infer: true }),
        sendDefaultPii: false,
        tracesSampleRate: 0,
      });
    }
  }

  captureException(
    error: unknown,
    context: Readonly<Record<string, string>> = {},
  ): void {
    if (!this.enabled) {
      return;
    }
    Sentry.withScope((scope) => {
      for (const [key, value] of Object.entries(context)) {
        scope.setTag(key, value);
      }
      Sentry.captureException(error);
    });
  }

  async flush(timeoutMs = 2_000): Promise<boolean> {
    return this.enabled ? Sentry.flush(timeoutMs) : true;
  }
}

function scrubValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(scrubValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[Filtered]' : scrubValue(nested),
      ]),
    );
  }
  if (
    typeof value === 'string' &&
    /postgres(?:ql)?:\/\/|https:\/\/[^@\s]+@[^/\s]+/i.test(value)
  ) {
    return '[Filtered]';
  }
  return value;
}
