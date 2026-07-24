import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerRequest } from '@nestjs/throttler';
import type { Response } from 'express';

@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  protected override headerPrefix = 'RateLimit';

  protected override async handleRequest(
    request: ThrottlerRequest,
  ): Promise<boolean> {
    try {
      return await super.handleRequest(request);
    } catch (error) {
      const response = request.context.switchToHttp().getResponse<Response>();
      const retryAfter =
        response.getHeader('Retry-After') ?? Math.ceil(request.ttl / 1_000);

      response.setHeader('RateLimit-Limit', request.limit);
      response.setHeader('RateLimit-Remaining', 0);
      response.setHeader('RateLimit-Reset', retryAfter);
      throw error;
    }
  }
}
