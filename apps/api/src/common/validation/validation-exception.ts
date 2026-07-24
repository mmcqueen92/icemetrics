import type { ValidationError } from 'class-validator';

import {
  RequestValidationError,
  type ApiErrorDetail,
} from '../errors/api-error.js';

const VALIDATION_CODES: Readonly<Record<string, string>> = {
  isBoolean: 'INVALID_BOOLEAN',
  isDateString: 'INVALID_DATE',
  isDateOnly: 'INVALID_DATE',
  isEnum: 'INVALID_VALUE',
  isIn: 'INVALID_VALUE',
  isInt: 'INVALID_INTEGER',
  isString: 'INVALID_STRING',
  isUUID: 'INVALID_UUID',
  isUuid: 'INVALID_UUID',
  max: 'MAX_VALUE',
  maxLength: 'MAX_LENGTH',
  min: 'MIN_VALUE',
  minLength: 'MIN_LENGTH',
  whitelistValidation: 'UNKNOWN_FIELD',
};

export function createValidationException(
  errors: ValidationError[],
): RequestValidationError {
  return new RequestValidationError(flattenValidationErrors(errors));
}

export function flattenValidationErrors(
  errors: readonly ValidationError[],
  parentPath = '',
): ApiErrorDetail[] {
  const details: ApiErrorDetail[] = [];

  for (const error of errors) {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    for (const [constraint, message] of Object.entries(
      error.constraints ?? {},
    )) {
      details.push({
        code: VALIDATION_CODES[constraint] ?? 'INVALID_VALUE',
        field,
        message,
      });
    }

    details.push(...flattenValidationErrors(error.children ?? [], field));
  }

  return details;
}
