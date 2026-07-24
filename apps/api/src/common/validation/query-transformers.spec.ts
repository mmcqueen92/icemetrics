import type { TransformFnParams } from 'class-transformer';
import { describe, expect, it } from 'vitest';

import { toStrictBoolean, trimString } from './query-transformers.js';

describe('query transformers', () => {
  it('converts only explicit boolean query values', () => {
    expect(toStrictBoolean(params('true'))).toBe(true);
    expect(toStrictBoolean(params(true))).toBe(true);
    expect(toStrictBoolean(params('false'))).toBe(false);
    expect(toStrictBoolean(params(false))).toBe(false);
    expect(toStrictBoolean(params('1'))).toBe('1');
  });

  it('trims strings and preserves non-string values', () => {
    expect(trimString(params('  Alex Mercer  '))).toBe('Alex Mercer');
    expect(trimString(params(12))).toBe(12);
  });
});

function params(value: unknown): TransformFnParams {
  return { value } as TransformFnParams;
}
