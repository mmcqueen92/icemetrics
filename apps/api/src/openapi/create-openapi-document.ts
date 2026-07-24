import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';

import {
  ApiErrorBodyDto,
  ApiErrorDetailDto,
  ApiErrorResponseDto,
} from '../common/errors/api-error.dto.js';
import {
  PaginationMetaDto,
  PaginationQueryDto,
} from '../common/pagination/pagination.dto.js';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('IceMetrics API')
    .setDescription('Public, read-only NHL data and analytics API.')
    .setVersion('1.0')
    .addServer('/api/v1', 'Version 1')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [
      ApiErrorBodyDto,
      ApiErrorDetailDto,
      ApiErrorResponseDto,
      PaginationMetaDto,
      PaginationQueryDto,
    ],
    ignoreGlobalPrefix: true,
  });

  document.openapi = '3.1.0';
  document.components ??= {};
  document.components.headers = {
    RateLimitLimit: {
      description: 'Maximum requests allowed in the current window.',
      schema: { type: 'integer' },
    },
    RateLimitRemaining: {
      description: 'Requests remaining in the current window.',
      schema: { type: 'integer' },
    },
    RateLimitReset: {
      description: 'Seconds until the current rate-limit window resets.',
      schema: { type: 'integer' },
    },
    RequestId: {
      description: 'Request correlation UUID.',
      schema: { format: 'uuid', type: 'string' },
    },
  };

  return document;
}
