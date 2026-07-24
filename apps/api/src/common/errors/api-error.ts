export type ApiErrorCode =
  | 'DEPENDENCY_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'RESOURCE_CONFLICT'
  | 'RESOURCE_NOT_FOUND'
  | 'VALIDATION_ERROR';

export interface ApiErrorDetail {
  code: string;
  field: string;
  message: string;
}

export class ApplicationError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details: readonly ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ResourceNotFoundError extends ApplicationError {
  constructor(resourceName: string) {
    super(404, 'RESOURCE_NOT_FOUND', `${resourceName} does not exist.`);
  }
}

export class RequestValidationError extends ApplicationError {
  constructor(details: readonly ApiErrorDetail[]) {
    super(
      400,
      'VALIDATION_ERROR',
      'The request contains invalid values.',
      details,
    );
  }
}
