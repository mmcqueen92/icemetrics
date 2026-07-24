import type { ValidationError } from 'class-validator';
import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  createValidationException,
  flattenValidationErrors,
} from './validation-exception.js';
import { createRequestValidationPipe } from './request-validation.pipe.js';

describe('validation errors', () => {
  it('maps validator constraints to stable external details', () => {
    const errors: ValidationError[] = [
      {
        constraints: {
          min: 'page must not be less than 1',
        },
        property: 'page',
      },
      {
        constraints: {
          whitelistValidation: 'property unexpected should not exist',
        },
        property: 'unexpected',
      },
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      {
        code: 'MIN_VALUE',
        field: 'page',
        message: 'page must not be less than 1',
      },
      {
        code: 'UNKNOWN_FIELD',
        field: 'unexpected',
        message: 'property unexpected should not exist',
      },
    ]);
  });

  it('preserves nested external field paths', () => {
    expect(
      flattenValidationErrors([
        {
          children: [
            {
              constraints: { isUUID: 'id must be a UUID' },
              property: 'id',
            },
          ],
          property: 'filter',
        },
      ]),
    ).toEqual([
      {
        code: 'INVALID_UUID',
        field: 'filter.id',
        message: 'id must be a UUID',
      },
    ]);
  });

  it('creates the standard validation application error', () => {
    const error = createValidationException([
      {
        constraints: { isInt: 'page must be an integer number' },
        property: 'page',
      },
    ]);

    expect(error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'The request contains invalid values.',
      status: 400,
    });
  });

  it('creates the strict shared request validation pipe', () => {
    expect(createRequestValidationPipe()).toBeInstanceOf(ValidationPipe);
  });
});
