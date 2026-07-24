import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  Inject,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { Observable } from 'rxjs';

import { CACHE_CONTROL_METADATA, type CachePolicy } from './cache-control.js';

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

    if (policy) {
      context
        .switchToHttp()
        .getResponse<Response>()
        .setHeader('Cache-Control', policy);
    }

    return next.handle();
  }
}
