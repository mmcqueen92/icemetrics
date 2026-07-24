const CONNECTION_URL_PATTERN = /\b(?:postgres|postgresql):\/\/[^\s)]+/gi;

export interface SafeLoggedError {
  message: string;
  stack?: string;
  type: string;
}

export function safeLoggedError(error: unknown): SafeLoggedError {
  if (!(error instanceof Error)) {
    return {
      message: 'Unexpected request failure',
      type: 'UnknownError',
    };
  }

  const stack = error.stack
    ?.split('\n')
    .slice(1)
    .join('\n')
    .replaceAll(CONNECTION_URL_PATTERN, '[REDACTED_DATABASE_URL]');

  return {
    message: 'Unexpected request failure',
    ...(stack ? { stack } : {}),
    type: error.name,
  };
}
