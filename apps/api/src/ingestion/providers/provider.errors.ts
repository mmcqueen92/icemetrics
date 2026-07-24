export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly endpointFamily: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

export class ProviderValidationError extends Error {
  constructor(
    readonly resourceType: string,
    readonly issues: readonly string[],
  ) {
    super(`Provider response validation failed for ${resourceType}`);
    this.name = 'ProviderValidationError';
  }
}
