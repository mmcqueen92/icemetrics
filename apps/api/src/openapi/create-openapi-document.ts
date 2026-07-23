import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('IceMetrics API')
    .setDescription('Public, read-only NHL data and analytics API.')
    .setVersion('1.0')
    .addServer('/api/v1', 'Version 1')
    .build();

  return SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: true,
  });
}
