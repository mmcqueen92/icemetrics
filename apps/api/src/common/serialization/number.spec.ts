import { describe, expect, it } from 'vitest';

import { percentage, roundToFour } from './number.js';

describe('number serialization', () => {
  it('rounds public numeric values to four decimal places', () => {
    expect(roundToFour(1 / 3)).toBe(0.3333);
    expect(percentage(1, 3)).toBe(33.3333);
  });

  it('returns null for an unavailable percentage denominator', () => {
    expect(percentage(0, 0)).toBeNull();
  });
});
