import { describe, expect, it } from 'vitest';

import {
  ApplicationError,
  RequestValidationError,
  ResourceNotFoundError,
} from './api-error.js';

describe('application errors', () => {
  it('creates typed not-found errors with safe messages', () => {
    expect(new ResourceNotFoundError('Player')).toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      details: [],
      message: 'Player does not exist.',
      name: 'ResourceNotFoundError',
      status: 404,
    });
  });

  it('retains structured validation details', () => {
    const details = [
      { code: 'MIN_VALUE', field: 'page', message: 'invalid page' },
    ];

    expect(new RequestValidationError(details)).toMatchObject({
      code: 'VALIDATION_ERROR',
      details,
      status: 400,
    });
  });

  it('supports explicit future application error contracts', () => {
    expect(
      new ApplicationError(409, 'RESOURCE_CONFLICT', 'Resource conflict.'),
    ).toMatchObject({
      code: 'RESOURCE_CONFLICT',
      message: 'Resource conflict.',
      status: 409,
    });
  });
});
