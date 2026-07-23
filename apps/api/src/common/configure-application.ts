import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';

import type { Environment } from './config/environment.js';

export function configureApplication(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  const origins = config
    .get('CORS_ALLOWED_ORIGINS', { infer: true })
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    credentials: false,
    methods: ['GET', 'HEAD', 'OPTIONS'],
    origin: origins,
  });
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  if (config.get('NODE_ENV', { infer: true }) === 'production') {
    app.set('trust proxy', 1);
  }
}
