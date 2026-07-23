import { fileURLToPath } from 'node:url';

import { config as loadEnvironment } from 'dotenv';
import { defineConfig } from 'prisma/config';

loadEnvironment({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});

const LOCAL_DATABASE_URL =
  'postgresql://icemetrics:icemetrics@localhost:5433/icemetrics';

function databaseUrl(): string {
  const value = process.env['DATABASE_URL'] ?? LOCAL_DATABASE_URL;

  if (!value.startsWith('postgresql://') && !value.startsWith('postgres://')) {
    throw new Error('DATABASE_URL must use the PostgreSQL protocol');
  }

  if (
    process.env['NODE_ENV'] === 'production' &&
    !process.env['DATABASE_URL']
  ) {
    throw new Error('DATABASE_URL is required in production');
  }

  return value;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.mjs',
  },
  datasource: {
    url: databaseUrl(),
  },
});
