import { z } from 'zod';

const optionalUrl = z
  .union([z.url(), z.literal('')])
  .transform((value) => (value === '' ? undefined : value));

const environmentSchema = z
  .object({
    APP_ENV: z.enum(['local', 'test', 'staging', 'production']),
    APP_VERSION: z.string().trim().min(1).optional(),
    CORS_ALLOWED_ORIGINS: z.string().trim().min(1),
    DATABASE_URL: z
      .string()
      .trim()
      .refine(
        (value) =>
          value.startsWith('postgresql://') || value.startsWith('postgres://'),
        'DATABASE_URL must use the PostgreSQL protocol',
      ),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']),
    NHL_STATS_API_BASE_URL: z
      .url()
      .default('https://api.nhle.com/stats/rest/en'),
    NHL_WEB_API_BASE_URL: z.url().default('https://api-web.nhle.com/v1'),
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    PROVIDER_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(4),
    PROVIDER_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(30_000)
      .default(10_000),
    PUBLIC_API_BASE_URL: optionalUrl.optional(),
    RATE_LIMIT_PER_MINUTE: z.coerce
      .number()
      .int()
      .min(10)
      .max(1_000)
      .default(120),
    SENTRY_DSN: optionalUrl.optional(),
    SENTRY_ENVIRONMENT: z
      .union([z.enum(['staging', 'production']), z.literal('')])
      .optional()
      .transform((value) => (value === '' ? undefined : value)),
  })
  .loose()
  .superRefine((environment, context) => {
    if (environment.NODE_ENV === 'production') {
      if (!environment.APP_VERSION) {
        context.addIssue({
          code: 'custom',
          message: 'APP_VERSION is required in production',
          path: ['APP_VERSION'],
        });
      }

      if (!environment.PUBLIC_API_BASE_URL) {
        context.addIssue({
          code: 'custom',
          message: 'PUBLIC_API_BASE_URL is required in production',
          path: ['PUBLIC_API_BASE_URL'],
        });
      }

      const origins = environment.CORS_ALLOWED_ORIGINS.split(',');
      for (const origin of origins) {
        if (!origin.trim().startsWith('https://')) {
          context.addIssue({
            code: 'custom',
            message: 'Production CORS origins must use HTTPS',
            path: ['CORS_ALLOWED_ORIGINS'],
          });
          break;
        }
      }
    }

    if (environment.SENTRY_DSN && !environment.SENTRY_ENVIRONMENT) {
      context.addIssue({
        code: 'custom',
        message: 'SENTRY_ENVIRONMENT is required when SENTRY_DSN is set',
        path: ['SENTRY_ENVIRONMENT'],
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  values: Record<string, unknown>,
): Environment {
  const result = environmentSchema.safeParse(values);

  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
