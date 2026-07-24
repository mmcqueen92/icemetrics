import { ValidationPipe, type ValidationPipeOptions } from '@nestjs/common';

import { createValidationException } from './validation-exception.js';

export function createRequestValidationPipe(
  options: Pick<ValidationPipeOptions, 'expectedType'> = {},
): ValidationPipe {
  return new ValidationPipe({
    forbidNonWhitelisted: true,
    exceptionFactory: createValidationException,
    stopAtFirstError: false,
    transform: true,
    transformOptions: {
      enableImplicitConversion: false,
    },
    whitelist: true,
    ...options,
  });
}
