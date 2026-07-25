import { JobType } from '../generated/prisma/client.js';
import { describe, expect, it } from 'vitest';

import { childRequiresDispatcherFailure, dueJobs } from './dispatch-policy.js';
import { EMPTY_JOB_COUNTS } from './job.types.js';

describe('dueJobs', () => {
  it('returns active-season jobs in dependency order', () => {
    const now = new Date('2026-01-15T23:10:00Z');
    const old = new Date('2026-01-14T20:00:00Z');

    expect(
      dueJobs({
        activeSeason: true,
        latestSuccessful: {
          [JobType.ANALYTICS]: old,
          [JobType.GAME_STATISTICS]: old,
          [JobType.PLAYERS]: old,
          [JobType.SCHEDULE]: old,
          [JobType.STANDINGS]: old,
          [JobType.TEAMS]: old,
        },
        now,
      }),
    ).toEqual([
      JobType.TEAMS,
      JobType.PLAYERS,
      JobType.SCHEDULE,
      JobType.GAME_STATISTICS,
      JobType.STANDINGS,
      JobType.ANALYTICS,
    ]);
  });

  it('uses a daily cadence outside an active season', () => {
    const now = new Date('2026-07-15T12:00:00Z');
    const recent = new Date('2026-07-15T10:00:00Z');

    expect(
      dueJobs({
        activeSeason: false,
        latestSuccessful: {
          [JobType.GAME_STATISTICS]: recent,
          [JobType.SCHEDULE]: recent,
          [JobType.STANDINGS]: recent,
        },
        now,
      }),
    ).not.toContain(JobType.SCHEDULE);
  });
});

describe('childRequiresDispatcherFailure', () => {
  it('escalates failed children and partial jobs above one percent', () => {
    expect(
      childRequiresDispatcherFailure({
        counts: { ...EMPTY_JOB_COUNTS, recordsFailed: 2, recordsFetched: 100 },
        executionId: 'failed-partial',
        status: 'PARTIAL',
      }),
    ).toBe(true);
    expect(
      childRequiresDispatcherFailure({
        counts: { ...EMPTY_JOB_COUNTS, recordsFailed: 1, recordsFetched: 100 },
        executionId: 'accepted-partial',
        status: 'PARTIAL',
      }),
    ).toBe(false);
    expect(
      childRequiresDispatcherFailure({
        counts: EMPTY_JOB_COUNTS,
        executionId: 'failed',
        status: 'FAILED',
      }),
    ).toBe(true);
  });
});
