import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';

import { pinoHttp } from 'pino-http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createHttpLoggingOptions, isValidRequestId } from './http-logging.js';

const REQUEST_ID = '0d9de4ac-57b8-4cb4-8895-33bcb4eb3396';

describe('HTTP logging', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server?.listening) {
      server.close();
      await once(server, 'close');
    }
  });

  it('accepts only structurally valid UUID request IDs', () => {
    expect(isValidRequestId(REQUEST_ID)).toBe(true);
    expect(isValidRequestId('not-a-uuid')).toBe(false);
    expect(isValidRequestId('00000000-0000-0000-0000-000000000000')).toBe(
      false,
    );
  });

  it('selects safe access-log levels and generates invalid request IDs', () => {
    const options = createHttpLoggingOptions({
      APP_ENV: 'test',
      LOG_LEVEL: 'info',
    });
    const request = {
      headers: { 'x-request-id': 'not-a-uuid' },
      url: '/health/live',
    } as unknown as IncomingMessage;
    const setHeader = vi.fn();
    const response = {
      setHeader,
      statusCode: 200,
    } as unknown as ServerResponse;

    expect(options.customLogLevel?.(request, response)).toBe('silent');
    request.url = '/players';
    response.statusCode = 400;
    expect(options.customLogLevel?.(request, response)).toBe('warn');
    response.statusCode = 500;
    expect(options.customLogLevel?.(request, response)).toBe('info');

    const generated = options.genReqId?.(request, response);
    expect(generated).toMatch(/^[0-9a-f-]{36}$/i);
    expect(setHeader).toHaveBeenCalledWith('X-Request-ID', generated);
    expect(options.customProps?.(request, response)).toMatchObject({
      release: 'development',
    });
  });

  it('writes correlated JSON logs without headers or query values', async () => {
    const stream = new PassThrough();
    const logPromise = once(stream, 'data');
    const middleware = pinoHttp(
      createHttpLoggingOptions({
        APP_ENV: 'test',
        APP_VERSION: 'logging-test',
        LOG_LEVEL: 'info',
      }),
      stream,
    );

    server = createServer((request, response) => {
      middleware(request, response, () => {
        response.statusCode = 200;
        response.end('ok');
      });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Failed to allocate logging test port.');
    }

    await fetch(
      `http://127.0.0.1:${String(address.port)}/players?token=forbidden-query-value`,
      {
        headers: {
          Authorization: 'Bearer forbidden-header-value',
          'X-Request-ID': REQUEST_ID,
        },
      },
    );
    const chunks = (await logPromise) as unknown[];
    const chunk = chunks[0];
    const serialized = String(chunk);
    const log = JSON.parse(serialized) as Record<string, unknown>;

    expect(log['requestId']).toBe(REQUEST_ID);
    expect(log['service']).toBe('icemetrics-api');
    expect(log['environment']).toBe('test');
    expect(log['release']).toBe('logging-test');
    expect(log['req']).toMatchObject({
      method: 'GET',
      path: '/players',
    });
    expect(serialized).not.toContain('forbidden-query-value');
    expect(serialized).not.toContain('forbidden-header-value');
    expect(serialized).not.toContain('Authorization');
  });
});
