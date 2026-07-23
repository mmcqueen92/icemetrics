import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';
import { configureApplication } from './common/configure-application.js';
import type { Environment } from './common/config/environment.js';
import { createOpenApiDocument } from './openapi/create-openapi-document.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApplication(app);

  const document = createOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document);

  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }), '0.0.0.0');
}

void bootstrap();
