import { environment } from '../../../environments/environment';
import type * as SentryAngular from '@sentry/angular';

let sdk: Promise<typeof SentryAngular> | undefined;

export function initializeBrowserErrorTracking(): void {
  const dsn = environment.sentryDsn;
  if (!dsn || sdk) {
    return;
  }
  sdk = import('@sentry/angular').then((Sentry) => {
    Sentry.init({
      beforeSend: (event) => {
        if (event.request) {
          delete event.request.cookies;
          delete event.request.data;
          delete event.request.headers;
          delete event.request.query_string;
          if (event.request.url) {
            event.request.url =
              event.request.url.split('?')[0] ?? event.request.url;
          }
        }
        return event;
      },
      dsn,
      environment: environment.environmentName,
      release: environment.releaseVersion,
      sendDefaultPii: false,
      tracesSampleRate: 0,
    });
    return Sentry;
  });
}

export function captureUnexpectedBrowserError(error: unknown): void {
  void sdk?.then((Sentry) => Sentry.captureException(error));
}
