import { JobType } from '../generated/prisma/client.js';
import { describe, expect, it } from 'vitest';

import { parseJobArguments } from './job-parameters.js';

describe('parseJobArguments', () => {
  it('parses the read-only operational health command', () => {
    expect(parseJobArguments(['health'])).toEqual({
      command: 'health',
      parameters: {},
    });
  });

  it('parses a bounded manual job request', () => {
    expect(
      parseJobArguments([
        'run',
        '--job',
        'schedule',
        '--date-from',
        '2026-01-01',
        '--date-to',
        '2026-12-31',
        '--dry-run',
      ]),
    ).toEqual({
      command: 'run',
      jobType: JobType.SCHEDULE,
      parameters: {
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
        dryRun: true,
      },
    });
  });

  it.each([
    [['run', '--job', 'unknown'], 'logical ingestion job'],
    [['run', '--job', 'teams', '--date', '2026-02-30'], 'real YYYY-MM-DD'],
    [
      [
        'run',
        '--job',
        'schedule',
        '--date-from',
        '2025-01-01',
        '--date-to',
        '2026-01-03',
      ],
      'at most 366 days',
    ],
    [['replay', '--payload-id', 'not-a-uuid'], 'must be a UUID'],
    [['dispatch', '--dry-run'], 'Unknown option'],
  ])('rejects invalid arguments', (arguments_, message) => {
    expect(() => parseJobArguments(arguments_)).toThrow(message);
  });
});
