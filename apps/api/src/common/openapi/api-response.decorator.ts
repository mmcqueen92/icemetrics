import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
  getSchemaPath,
} from '@nestjs/swagger';

import { ApiErrorResponseDto } from '../errors/api-error.dto.js';
import { PaginationMetaDto } from '../pagination/pagination.dto.js';

const STANDARD_RESPONSE_HEADERS = {
  'RateLimit-Limit': {
    description: 'Maximum requests allowed in the current window.',
    schema: { type: 'integer' },
  },
  'RateLimit-Remaining': {
    description: 'Requests remaining in the current window.',
    schema: { type: 'integer' },
  },
  'RateLimit-Reset': {
    description: 'Seconds until the current rate-limit window resets.',
    schema: { type: 'integer' },
  },
  'X-Request-ID': {
    description: 'Request correlation UUID.',
    schema: { format: 'uuid', type: 'string' },
  },
};

export function ApiSingleResponse(
  model: Type<unknown>,
  description: string,
): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description,
      headers: STANDARD_RESPONSE_HEADERS,
      schema: {
        properties: {
          data: { $ref: getSchemaPath(model) },
        },
        required: ['data'],
        type: 'object',
      },
    }),
    ...standardErrorDecorators(true),
  );
}

export function ApiPaginatedResponse(
  model: Type<unknown>,
  description: string,
  includeNotFound = false,
): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(model, PaginationMetaDto),
    ApiOkResponse({
      description,
      headers: STANDARD_RESPONSE_HEADERS,
      schema: {
        properties: {
          data: {
            items: { $ref: getSchemaPath(model) },
            type: 'array',
          },
          meta: { $ref: getSchemaPath(PaginationMetaDto) },
        },
        required: ['data', 'meta'],
        type: 'object',
      },
    }),
    ...standardErrorDecorators(includeNotFound),
  );
}

export function ApiNotFoundError(): MethodDecorator {
  return ApiNotFoundResponse({
    description: 'The requested resource does not exist.',
    type: ApiErrorResponseDto,
  });
}

function standardErrorDecorators(includeNotFound: boolean): MethodDecorator[] {
  const decorators: MethodDecorator[] = [
    ApiBadRequestResponse({
      description: 'A path or query value is invalid.',
      type: ApiErrorResponseDto,
    }),
    ApiTooManyRequestsResponse({
      description: 'The public request limit was exceeded.',
      type: ApiErrorResponseDto,
    }),
    ApiInternalServerErrorResponse({
      description: 'An unexpected internal failure occurred.',
      type: ApiErrorResponseDto,
    }),
    ApiServiceUnavailableResponse({
      description: 'The database is unavailable.',
      type: ApiErrorResponseDto,
    }),
  ];

  if (includeNotFound) {
    decorators.push(ApiNotFoundError());
  }

  return decorators;
}
