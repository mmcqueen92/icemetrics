import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './environment.js';

const validDevelopmentEnvironment = {
  APP_ENV: 'local',
  APP_VERSION: 'development',
  CORS_ALLOWED_ORIGINS: 'http://localhost:4200',
  DATABASE_URL: 'postgresql://icemetrics:icemetrics@localhost:5432/icemetrics',
  LOG_LEVEL: 'debug',
  NODE_ENV: 'development',
  PORT: '3000',
};

describe('validateEnvironment', () => {
  it('parses a valid local environment and applies provider defaults', () => {
    const environment = validateEnvironment(validDevelopmentEnvironment);

    expect(environment.PORT).toBe(3000);
    expect(environment.PROVIDER_MAX_CONCURRENCY).toBe(4);
    expect(environment.PROVIDER_TIMEOUT_MS).toBe(10_000);
    expect(environment.NHL_WEB_API_BASE_URL).toBe(
      'https://api-web.nhle.com/v1',
    );
  });

  it('rejects a non-PostgreSQL database URL', () => {
    expect(() =>
      validateEnvironment({
        ...validDevelopmentEnvironment,
        DATABASE_URL: 'mysql://localhost/icemetrics',
      }),
    ).toThrow('DATABASE_URL must use the PostgreSQL protocol');
  });

  it('requires production release metadata and public URL', () => {
    expect(() =>
      validateEnvironment({
        ...validDevelopmentEnvironment,
        APP_ENV: 'production',
        APP_VERSION: undefined,
        CORS_ALLOWED_ORIGINS: 'https://icemetrics.example',
        NODE_ENV: 'production',
        PUBLIC_API_BASE_URL: undefined,
      }),
    ).toThrow('APP_VERSION is required in production');
  });

  it('uses the immutable Render commit as the production release', () => {
    expect(
      validateEnvironment({
        ...validDevelopmentEnvironment,
        APP_ENV: 'staging',
        APP_VERSION: undefined,
        CORS_ALLOWED_ORIGINS: 'https://icemetrics-staging-web.onrender.com',
        NODE_ENV: 'production',
        PUBLIC_API_BASE_URL:
          'https://icemetrics-staging-api.onrender.com/api/v1',
        RENDER_GIT_COMMIT: 'abc123',
      }).APP_VERSION,
    ).toBe('abc123');
  });

  it('rejects insecure production origins', () => {
    expect(() =>
      validateEnvironment({
        ...validDevelopmentEnvironment,
        APP_ENV: 'production',
        CORS_ALLOWED_ORIGINS: 'http://icemetrics.example',
        NODE_ENV: 'production',
        PUBLIC_API_BASE_URL: 'https://api.icemetrics.example',
      }),
    ).toThrow('Production CORS origins must use HTTPS');
  });

  it('requires a Sentry environment when Sentry is enabled', () => {
    expect(() =>
      validateEnvironment({
        ...validDevelopmentEnvironment,
        SENTRY_DSN: 'https://examplePublicKey@o0.ingest.sentry.io/0',
      }),
    ).toThrow('SENTRY_ENVIRONMENT is required when SENTRY_DSN is set');
  });
});
