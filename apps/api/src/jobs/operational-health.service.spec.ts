import { describe, expect, it, vi } from 'vitest';

import { OperationalHealthService } from './operational-health.service.js';

function database(active = true, finishedAt: Date | null = new Date()) {
  return {
    jobExecution: {
      findFirst: vi
        .fn()
        .mockResolvedValue(finishedAt === null ? null : { finishedAt }),
    },
    season: { count: vi.fn().mockResolvedValue(active ? 1 : 0) },
  };
}

describe('OperationalHealthService', () => {
  const now = new Date('2026-01-15T12:00:00.000Z');

  it('reports fresh scheduled jobs during an active season', async () => {
    const service = new OperationalHealthService(
      database(true, new Date('2026-01-15T11:00:00.000Z')) as never,
    );
    await expect(service.check(now)).resolves.toMatchObject({
      activeSeason: true,
      status: 'ok',
      checks: [{ status: 'fresh' }, { status: 'fresh' }],
    });
  });

  it('fails stale active-season jobs and skips offseason freshness', async () => {
    const stale = new OperationalHealthService(database(true, null) as never);
    await expect(stale.check(now)).resolves.toMatchObject({
      status: 'unhealthy',
      checks: [{ status: 'stale' }, { status: 'stale' }],
    });

    const offseason = new OperationalHealthService(
      database(false, null) as never,
    );
    await expect(offseason.check(now)).resolves.toMatchObject({
      status: 'ok',
      checks: [{ status: 'not-required' }, { status: 'not-required' }],
    });
  });
});
