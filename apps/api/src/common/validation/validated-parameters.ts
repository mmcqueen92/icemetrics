import { Param, Query, type Type } from '@nestjs/common';

import { createRequestValidationPipe } from './request-validation.pipe.js';

export function ValidatedQuery<T>(type: Type<T>): ParameterDecorator {
  return Query(createRequestValidationPipe({ expectedType: type }));
}

export function ValidatedParams<T>(type: Type<T>): ParameterDecorator {
  return Param(createRequestValidationPipe({ expectedType: type }));
}
