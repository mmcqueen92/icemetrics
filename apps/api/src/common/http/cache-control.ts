import { SetMetadata } from '@nestjs/common';

export const CACHE_CONTROL_METADATA = Symbol('cache-control');

export enum CachePolicy {
  Game = 'game-aware',
  Historical = 'public, max-age=3600',
  Live = 'public, max-age=60',
  Standard = 'public, max-age=300',
}

export const CacheControl = (policy: CachePolicy): MethodDecorator =>
  SetMetadata(CACHE_CONTROL_METADATA, policy);
