import { Controller, Get, Query } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ApiExcludeController } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ResourceNotFoundError } from '../src/common/errors/api-error.js';
import { CacheControl, CachePolicy } from '../src/common/http/cache-control.js';
import {
  createPaginationMeta,
  PaginatedResult,
} from '../src/common/pagination/pagination.js';
import { PaginationQueryDto } from '../src/common/pagination/pagination.dto.js';
import { createRequestValidationPipe } from '../src/common/validation/request-validation.pipe.js';

const ACCEPTED_REQUEST_ID = '0d9de4ac-57b8-4cb4-8895-33bcb4eb3396';

interface ErrorResponseBody {
  error: {
    details: unknown[];
    requestId: string;
    timestamp: string;
  };
}

class PlatformQueryDto extends PaginationQueryDto {
  @IsIn(['name'])
  sort = 'name';
}

@ApiExcludeController()
@Controller('platform-test')
class PlatformTestController {
  @Get('single')
  @CacheControl(CachePolicy.Standard)
  single(): { value: string } {
    return { value: 'ok' };
  }

  @Get('collection')
  @CacheControl(CachePolicy.Live)
  collection(
    @Query(
      createRequestValidationPipe({
        expectedType: PlatformQueryDto,
      }),
    )
    query: PlatformQueryDto,
  ): PaginatedResult<{ id: string }> {
    return new PaginatedResult(
      [{ id: '00000000-0000-4000-8000-000000000001' }],
      createPaginationMeta(query, 1, query.sort),
    );
  }

  @Get('not-found')
  notFound(): never {
    throw new ResourceNotFoundError('Fixture');
  }

  @Get('failure')
  failure(): never {
    throw new Error(
      'postgresql://private-user:private-password@database/internal',
    );
  }

  @Get('rate-limited')
  rateLimited(): { value: string } {
    return { value: 'ok' };
  }
}

describe('API platform', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    process.env['APP_ENV'] = 'test';
    process.env['APP_VERSION'] = 'platform-integration';
    process.env['CORS_ALLOWED_ORIGINS'] = 'http://localhost:4200';
    process.env['DATABASE_URL'] =
      'postgresql://unused:unused@127.0.0.1:1/unused';
    process.env['LOG_LEVEL'] = 'error';
    process.env['NODE_ENV'] = 'test';
    process.env['RATE_LIMIT_PER_MINUTE'] = '10';

    const [{ Test }, { AppModule }, { configureApplication }] =
      await Promise.all([
        import('@nestjs/testing'),
        import('../src/app.module.js'),
        import('../src/common/configure-application.js'),
      ]);
    const module = await Test.createTestingModule({
      controllers: [PlatformTestController],
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('wraps success responses and emits request and security headers', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/platform-test/single')
      .set('Origin', 'http://localhost:4200')
      .set('X-Request-ID', ACCEPTED_REQUEST_ID)
      .expect(200)
      .expect({ data: { value: 'ok' } });

    expect(response.headers['x-request-id']).toBe(ACCEPTED_REQUEST_ID);
    expect(response.headers['cache-control']).toBe('public, max-age=300');
    expect(response.headers['etag']).toMatch(/^".+"$/);
    expect(response.headers['ratelimit-limit']).toBe('10');
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:4200',
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('returns paginated collection metadata', async () => {
    await request(app.getHttpServer())
      .get(
        '/api/v1/platform-test/collection?page=1&pageSize=25&sort=name&order=asc',
      )
      .expect(200)
      .expect({
        data: [{ id: '00000000-0000-4000-8000-000000000001' }],
        meta: {
          order: 'asc',
          page: 1,
          pageSize: 25,
          sort: 'name',
          totalItems: 1,
          totalPages: 1,
        },
      });
  });

  it('returns structured validation details and rejects unknown inputs', async () => {
    const invalidPage = await request(app.getHttpServer())
      .get('/api/v1/platform-test/collection?page=0')
      .expect(400);
    const invalidPageBody = invalidPage.body as ErrorResponseBody;

    expect(invalidPageBody).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        details: [
          {
            code: 'MIN_VALUE',
            field: 'page',
            message: 'page must not be less than 1',
          },
        ],
        message: 'The request contains invalid values.',
      },
    });
    expect(invalidPageBody.error.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(Date.parse(invalidPageBody.error.timestamp)).not.toBeNaN();

    const unknown = await request(app.getHttpServer())
      .get('/api/v1/platform-test/collection?unexpected=value')
      .expect(400);
    const unknownBody = unknown.body as ErrorResponseBody;

    expect(unknownBody.error.details).toContainEqual({
      code: 'UNKNOWN_FIELD',
      field: 'unexpected',
      message: 'property unexpected should not exist',
    });
  });

  it('maps expected and unexpected errors without leaking internals', async () => {
    const notFound = await request(app.getHttpServer())
      .get('/api/v1/platform-test/not-found')
      .expect(404);

    expect(notFound.body).toMatchObject({
      error: {
        code: 'RESOURCE_NOT_FOUND',
        details: [],
        message: 'Fixture does not exist.',
      },
    });

    const failure = await request(app.getHttpServer())
      .get('/api/v1/platform-test/failure')
      .expect(500);
    const serialized = JSON.stringify(failure.body);

    expect(failure.body).toMatchObject({
      error: {
        code: 'INTERNAL_ERROR',
        details: [],
        message: 'An unexpected error occurred.',
      },
    });
    expect(serialized).not.toContain('private-password');
    expect(serialized).not.toContain('postgresql://');
    expect(serialized).not.toContain('stack');
  });

  it('honors conditional requests with ETag and 304', async () => {
    const initial = await request(app.getHttpServer())
      .get('/api/v1/platform-test/single')
      .expect(200);
    const etag = initial.headers['etag'] as string;

    const conditional = await request(app.getHttpServer())
      .get('/api/v1/platform-test/single')
      .set('If-None-Match', etag)
      .expect(304);

    expect(conditional.text).toBe('');
    expect(conditional.headers['cache-control']).toBe('public, max-age=300');
  });

  it('returns standard rate-limit headers and a safe 429 envelope', async () => {
    for (let requestNumber = 0; requestNumber < 10; requestNumber += 1) {
      await request(app.getHttpServer())
        .get('/api/v1/platform-test/rate-limited')
        .expect(200);
    }

    const limited = await request(app.getHttpServer())
      .get('/api/v1/platform-test/rate-limited')
      .expect(429);

    expect(limited.headers['ratelimit-limit']).toBe('10');
    expect(limited.headers['ratelimit-remaining']).toBe('0');
    expect(limited.headers['ratelimit-reset']).toBeDefined();
    expect(limited.headers['retry-after']).toBeDefined();
    expect(limited.body).toMatchObject({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        details: [],
        message: 'The request rate limit has been exceeded.',
      },
    });
  });

  it('replaces invalid incoming request IDs', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/platform-test/single')
      .set('X-Request-ID', 'not-a-uuid')
      .expect(200);

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
    expect(response.headers['x-request-id']).not.toBe('not-a-uuid');
  });
});
