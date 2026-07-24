import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { HelmetOptions } from 'helmet';

import type { Environment } from './config/environment.js';
import { createRequestValidationPipe } from './validation/request-validation.pipe.js';

export function configureApplication(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  const origins = config
    .get('CORS_ALLOWED_ORIGINS', { infer: true })
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const production = config.get('NODE_ENV', { infer: true }) === 'production';
  const helmetOptions: HelmetOptions = {
    contentSecurityPolicy: false,
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    ...(production ? {} : { strictTransportSecurity: false }),
  };

  app.use(helmet(helmetOptions));

  app.setGlobalPrefix('api/v1', {
    exclude: ['health/live', 'health/ready'],
  });
  app.set('etag', 'strong');
  app.enableCors({
    credentials: false,
    methods: ['GET', 'HEAD', 'OPTIONS'],
    origin: origins,
  });
  app.enableShutdownHooks();
  app.useGlobalPipes(createRequestValidationPipe());

  if (production) {
    app.set('trust proxy', 1);
  }
}
