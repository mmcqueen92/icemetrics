import { randomUUID } from 'node:crypto';

import {
  Catch,
  type ArgumentsHost,
  HttpException,
  Inject,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

import {
  ApplicationError,
  type ApiErrorCode,
  type ApiErrorDetail,
} from './api-error.js';
import { safeLoggedError } from '../logging/safe-logged-error.js';

interface ErrorContract {
  code: ApiErrorCode;
  details: readonly ApiErrorDetail[];
  message: string;
  status: number;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(PinoLogger)
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ApiExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    if (isHealthRequest(request) && exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const contract = errorContract(exception);
    const requestId =
      typeof request.id === 'string' ? request.id : randomUUID();

    response.setHeader('X-Request-ID', requestId);

    if (contract.code === 'INTERNAL_ERROR') {
      this.logger.error(
        {
          err: safeLoggedError(exception),
          errorCode: contract.code,
        },
        'Unexpected request failure',
      );
    }

    response.status(contract.status).json({
      error: {
        code: contract.code,
        details: contract.details,
        message: contract.message,
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

function errorContract(exception: unknown): ErrorContract {
  if (exception instanceof ApplicationError) {
    return {
      code: exception.code,
      details: exception.details,
      message: exception.message,
      status: exception.status,
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();

    if (status === 400) {
      return standardError(
        status,
        'VALIDATION_ERROR',
        'The request contains invalid values.',
      );
    }

    if (status === 404) {
      return standardError(
        status,
        'RESOURCE_NOT_FOUND',
        'Resource does not exist.',
      );
    }

    if (status === 409) {
      return standardError(
        status,
        'RESOURCE_CONFLICT',
        'The request conflicts with the current resource state.',
      );
    }

    if (status === 429) {
      return standardError(
        status,
        'RATE_LIMIT_EXCEEDED',
        'The request rate limit has been exceeded.',
      );
    }

    if (status === 503) {
      return standardError(
        status,
        'DEPENDENCY_UNAVAILABLE',
        'A required dependency is unavailable.',
      );
    }
  }

  return standardError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
}

function isHealthRequest(request: Request): boolean {
  return request.path === '/health/live' || request.path === '/health/ready';
}

function standardError(
  status: number,
  code: ApiErrorCode,
  message: string,
): ErrorContract {
  return { code, details: [], message, status };
}
