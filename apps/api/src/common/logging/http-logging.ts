import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import pino from 'pino';
import type { Options } from 'pino-http';

import type { Environment } from '../config/environment.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface HttpRequest extends IncomingMessage {
  baseUrl?: string;
  ip?: string;
  originalUrl?: string;
  route?: {
    path?: string;
  };
}

export function createHttpLoggingOptions(
  environment: Pick<Environment, 'APP_ENV' | 'APP_VERSION' | 'LOG_LEVEL'>,
): Options {
  return {
    autoLogging: true,
    customAttributeKeys: {
      reqId: 'requestId',
      responseTime: 'durationMs',
    },
    customErrorMessage: () => 'Request completed',
    customLogLevel: (request, response) => {
      const path = request.url?.split('?', 1)[0];

      if (
        (path === '/health/live' || path === '/health/ready') &&
        response.statusCode < 400
      ) {
        return 'silent';
      }

      return response.statusCode >= 400 && response.statusCode < 500
        ? 'warn'
        : 'info';
    },
    customProps: () => ({
      environment: environment.APP_ENV,
      release: environment.APP_VERSION ?? 'development',
      service: 'icemetrics-api',
    }),
    customSuccessMessage: () => 'Request completed',
    genReqId: (request: IncomingMessage, response: ServerResponse) => {
      const incomingId = request.headers['x-request-id'];
      const requestId =
        typeof incomingId === 'string' && isValidRequestId(incomingId)
          ? incomingId
          : randomUUID();

      response.setHeader('X-Request-ID', requestId);
      return requestId;
    },
    level: environment.LOG_LEVEL,
    quietReqLogger: true,
    redact: {
      censor: '[REDACTED]',
      paths: [
        'authorization',
        'cookie',
        'DATABASE_URL',
        'databaseUrl',
        'payload',
        'req.headers',
        'request.headers',
      ],
    },
    serializers: {
      err: pino.stdSerializers.err,
      req: (value: unknown) => {
        const request = value as HttpRequest;

        return {
          method: request.method,
          path: requestPath(request),
          remoteAddress: request.ip ?? request.socket?.remoteAddress,
        };
      },
      res: (value: unknown) => {
        const response = value as ServerResponse;
        return { statusCode: response.statusCode };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
}

export function isValidRequestId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function requestPath(request: HttpRequest): string {
  const routePath = request.route?.path;

  if (routePath) {
    return `${request.baseUrl ?? ''}${routePath}`;
  }

  return (request.originalUrl ?? request.url ?? '/').split('?', 1)[0] ?? '/';
}
