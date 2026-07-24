import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Environment } from '../common/config/environment.js';
import { PrismaService } from './prisma.service.js';

const disconnect = vi.fn().mockResolvedValue(undefined);
const end = vi.fn().mockResolvedValue(undefined);
const query = vi.fn();
const poolConstructor = vi.fn();
const adapterConstructor = vi.fn();

vi.mock('../generated/prisma/client.js', () => ({
  PrismaClient: class {
    readonly $disconnect = disconnect;
  },
}));

vi.mock('pg', () => ({
  Pool: class {
    constructor(options: unknown) {
      poolConstructor(options);
    }

    readonly end = end;
    readonly query = query;
  },
}));

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class {
    constructor(pool: unknown, options: unknown) {
      adapterConstructor(pool, options);
    }
  },
}));

describe('PrismaService', () => {
  const config = {
    get: vi.fn(() => 'postgresql://user:password@localhost:5432/database'),
  } as unknown as ConfigService<Environment, true>;

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    disconnect.mockResolvedValue(undefined);
    end.mockResolvedValue(undefined);
  });

  it('configures bounded PostgreSQL connections and query execution', () => {
    new PrismaService(config);

    expect(poolConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeoutMillis: 5_000,
        query_timeout: 5_000,
        statement_timeout: 5_000,
      }),
    );
    expect(adapterConstructor).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ disposeExternalPool: false }),
    );
  });

  it('uses a two-second readiness probe without exposing failures', async () => {
    query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const service = new PrismaService(config);

    await expect(service.isReady()).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith('SELECT 1');

    query.mockRejectedValueOnce(new Error('connection details'));
    await expect(service.isReady()).resolves.toBe(false);
  });

  it('bounds a stalled readiness probe at two seconds', async () => {
    vi.useFakeTimers();
    query.mockReturnValueOnce(new Promise(() => undefined));
    const service = new PrismaService(config);
    const readiness = service.isReady();

    await vi.advanceTimersByTimeAsync(2_000);

    await expect(readiness).resolves.toBe(false);
  });

  it('disconnects only once across lifecycle hooks', async () => {
    const service = new PrismaService(config);

    await service.onModuleDestroy();
    await service.onApplicationShutdown();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });
});
