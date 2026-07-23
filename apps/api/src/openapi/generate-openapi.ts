import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

const safeGeneratorEnvironment = {
  APP_ENV: 'local',
  APP_VERSION: 'openapi-generation',
  CORS_ALLOWED_ORIGINS: 'http://localhost:4200',
  DATABASE_URL: 'postgresql://openapi:openapi@localhost:5432/openapi',
  LOG_LEVEL: 'error',
  NODE_ENV: 'development',
  PORT: '3000',
} as const;

for (const [key, value] of Object.entries(safeGeneratorEnvironment)) {
  process.env[key] ??= value;
}

const [{ AppModule }, { configureApplication }, { createOpenApiDocument }] =
  await Promise.all([
    import('../app.module.js'),
    import('../common/configure-application.js'),
    import('./create-openapi-document.js'),
  ]);

const app = await NestFactory.create<NestExpressApplication>(AppModule, {
  logger: false,
});

try {
  configureApplication(app);
  await app.init();

  const document = createOpenApiDocument(app);
  const outputPath = process.env['OPENAPI_OUTPUT_PATH']
    ? resolve(process.env['OPENAPI_OUTPUT_PATH'])
    : resolve('openapi/openapi.json');

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
} finally {
  await app.close();
}
