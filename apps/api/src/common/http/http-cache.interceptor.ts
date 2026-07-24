import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  Inject,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { type Observable, tap } from 'rxjs';

import { CACHE_CONTROL_METADATA, CachePolicy } from './cache-control.js';

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const policy = this.reflector.getAllAndOverride<CachePolicy>(
      CACHE_CONTROL_METADATA,
      [context.getHandler(), context.getClass()],
    );

    const response = context.switchToHttp().getResponse<Response>();

    if (policy === CachePolicy.Game) {
      return next.handle().pipe(
        tap((value: unknown) => {
          response.setHeader(
            'Cache-Control',
            hasFinalStatus(value) ? CachePolicy.Historical : CachePolicy.Live,
          );
        }),
      );
    }

    if (policy) {
      response.setHeader('Cache-Control', policy);
    }

    return next.handle();
  }
}

function hasFinalStatus(value: unknown): boolean {
  if (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    value.status === 'FINAL'
  ) {
    return true;
  }

  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    typeof value.data === 'object' &&
    value.data !== null &&
    'status' in value.data &&
    value.data.status === 'FINAL'
  );
}
