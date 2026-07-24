import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../database/prisma.service.js';
import { DatabaseHealthService } from './database-health.service.js';

const isReady = vi.fn();

describe('DatabaseHealthService', () => {
  const database = { isReady } as unknown as PrismaService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports ready when PostgreSQL answers the probe', async () => {
    isReady.mockResolvedValueOnce(true);
    const service = new DatabaseHealthService(database);

    await expect(service.isReady()).resolves.toBe(true);
  });

  it('reports unavailable without exposing connection errors', async () => {
    isReady.mockResolvedValueOnce(false);
    const service = new DatabaseHealthService(database);

    await expect(service.isReady()).resolves.toBe(false);
  });
});
