import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Environment } from '../config/environment.js';
import { DatabaseHealthService } from './database-health.service.js';

const query = vi.fn();
const end = vi.fn().mockResolvedValue(undefined);
const on = vi.fn();

vi.mock('pg', () => ({
  Pool: class {
    readonly end = end;
    readonly on = on;
    readonly query = query;
  },
}));

describe('DatabaseHealthService', () => {
  const config = {
    get: vi.fn(() => 'postgresql://user:password@localhost:5432/database'),
  } as unknown as ConfigService<Environment, true>;

  afterEach(() => {
    vi.clearAllMocks();
    end.mockResolvedValue(undefined);
  });

  it('reports ready when PostgreSQL answers the probe', async () => {
    query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const service = new DatabaseHealthService(config);

    await expect(service.isReady()).resolves.toBe(true);
  });

  it('reports unavailable without exposing connection errors', async () => {
    query.mockRejectedValueOnce(new Error('connection details'));
    const service = new DatabaseHealthService(config);

    await expect(service.isReady()).resolves.toBe(false);
  });

  it('handles idle-client errors so database loss does not crash the API', () => {
    new DatabaseHealthService(config);

    expect(on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('closes its pool only once across lifecycle hooks', async () => {
    const service = new DatabaseHealthService(config);

    await service.onModuleDestroy();
    await service.onApplicationShutdown();

    expect(end).toHaveBeenCalledTimes(1);
  });
});
