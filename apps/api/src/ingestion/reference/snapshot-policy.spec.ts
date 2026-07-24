import { describe, expect, it } from 'vitest';

import { evaluateSnapshotAbsences } from './snapshot-policy.js';

describe('evaluateSnapshotAbsences', () => {
  it('warns for the first two absences and deactivates on the third', () => {
    const active = new Set(['present', 'first', 'second', 'third']);
    const result = evaluateSnapshotAbsences(active, new Set(['present']), [
      new Set(['present', 'first']),
      new Set(['present', 'first', 'second']),
    ]);

    expect(result).toEqual({
      deactivate: ['third'],
      warnings: [
        { absenceCount: 1, externalId: 'first' },
        { absenceCount: 2, externalId: 'second' },
      ],
    });
  });

  it('does not interpret missing snapshot history as an absence', () => {
    expect(
      evaluateSnapshotAbsences(new Set(['team-1']), new Set(), []),
    ).toEqual({
      deactivate: [],
      warnings: [{ absenceCount: 1, externalId: 'team-1' }],
    });
  });
});
