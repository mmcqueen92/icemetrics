import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { type Observable, map } from 'rxjs';

import { PaginatedResult } from '../pagination/pagination.js';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.path === '/health/live' || request.path === '/health/ready') {
      return next.handle();
    }

    return next.handle().pipe(
      map((value: unknown) => {
        if (value instanceof PaginatedResult) {
          return { data: value.items, meta: value.meta };
        }

        return { data: value };
      }),
    );
  }
}
