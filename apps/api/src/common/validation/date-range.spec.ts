import { describe, expect, it } from 'vitest';

import type { RequestValidationError } from '../errors/api-error.js';
import { validateDateRange } from './date-range.js';

describe('validateDateRange', () => {
  it('accepts absent, ordered, and 366-day inclusive ranges', () => {
    expect(() => validateDateRange(undefined, undefined)).not.toThrow();
    expect(() => validateDateRange('2025-01-01', '2025-12-31')).not.toThrow();
    expect(() => validateDateRange('2024-01-01', '2024-12-31')).not.toThrow();
  });

  it('rejects reversed ranges with a stable detail', () => {
    const error = captureValidationError(() =>
      validateDateRange('2025-02-01', '2025-01-01'),
    );
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_RANGE',
        field: 'dateTo',
      }),
    );
  });

  it('rejects ranges longer than 366 inclusive days', () => {
    const error = captureValidationError(() =>
      validateDateRange('2024-01-01', '2025-01-01'),
    );
    expect(error.details).toContainEqual(
      expect.objectContaining({
        code: 'MAX_DATE_RANGE',
        field: 'dateTo',
      }),
    );
  });
});

function captureValidationError(operation: () => void): RequestValidationError {
  try {
    operation();
    throw new Error('Expected date range validation to fail.');
  } catch (error) {
    return error as RequestValidationError;
  }
}
