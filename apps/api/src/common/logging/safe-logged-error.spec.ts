import { describe, expect, it } from 'vitest';

import { safeLoggedError } from './safe-logged-error.js';

describe('safeLoggedError', () => {
  it('retains diagnostic frames without secret-bearing messages', () => {
    const logged = safeLoggedError(
      new Error('postgresql://private-user:private-password@database/internal'),
    );
    const serialized = JSON.stringify(logged);

    expect(logged.message).toBe('Unexpected request failure');
    expect(logged.type).toBe('Error');
    expect(logged.stack).toContain('safe-logged-error.spec');
    expect(serialized).not.toContain('private-password');
    expect(serialized).not.toContain('postgresql://');
  });

  it('normalizes non-error thrown values', () => {
    expect(safeLoggedError('forbidden raw value')).toEqual({
      message: 'Unexpected request failure',
      type: 'UnknownError',
    });
  });
});
