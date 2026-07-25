import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const environmentName = process.env['APP_ENV'];
const apiBaseUrl = process.env['PUBLIC_API_BASE_URL'];
const releaseVersion = process.env['RENDER_GIT_COMMIT'];
const sentryDsn = process.env['PUBLIC_SENTRY_DSN'] || null;

if (environmentName !== 'staging' && environmentName !== 'production') {
  throw new Error(
    'APP_ENV must be staging or production for a deployment build.',
  );
}
if (!apiBaseUrl?.startsWith('https://')) {
  throw new Error('PUBLIC_API_BASE_URL must be an HTTPS URL.');
}
if (!releaseVersion?.trim()) {
  throw new Error('RENDER_GIT_COMMIT is required for a deployment build.');
}
if (sentryDsn !== null && !sentryDsn.startsWith('https://')) {
  throw new Error('PUBLIC_SENTRY_DSN must be an HTTPS URL when supplied.');
}

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(
  repositoryRoot,
  'apps/web/src/environments/generated/environment.render.ts',
);
await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  `export const environment = ${JSON.stringify(
    { apiBaseUrl, environmentName, releaseVersion, sentryDsn },
    null,
    2,
  )} as const;\n`,
  'utf8',
);
