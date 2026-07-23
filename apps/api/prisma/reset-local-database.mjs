import { spawn } from 'node:child_process';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

import { config as loadEnvironment } from 'dotenv';

loadEnvironment({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});

const LOCAL_DATABASE_URL =
  'postgresql://icemetrics:icemetrics@localhost:5433/icemetrics';
const databaseUrl = new URL(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL);
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

if (process.env.NODE_ENV !== 'development') {
  throw new Error('db:reset requires NODE_ENV=development.');
}

if (process.env.APP_ENV === 'staging' || process.env.APP_ENV === 'production') {
  throw new Error('db:reset cannot run in staging or production.');
}

if (
  !['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
  !localHosts.has(databaseUrl.hostname)
) {
  throw new Error('db:reset only accepts a local PostgreSQL DATABASE_URL.');
}

const prompt = createInterface({
  input: process.stdin,
  output: process.stdout,
});
const databaseName = databaseUrl.pathname.slice(1);
const answer = await prompt.question(
  `Reset local database "${databaseName}" on ${databaseUrl.host}? Type RESET to continue: `,
);
prompt.close();

if (answer !== 'RESET') {
  console.info('Database reset cancelled.');
  process.exitCode = 1;
} else {
  const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const environment = {
    ...process.env,
    DATABASE_URL: databaseUrl.toString(),
  };

  await run(
    npmExecutable,
    [
      'exec',
      '--workspace',
      '@icemetrics/api',
      '--',
      'prisma',
      'migrate',
      'reset',
      '--force',
    ],
    environment,
  );
  await run(
    npmExecutable,
    ['run', 'db:seed', '--workspace', '@icemetrics/api'],
    environment,
  );
}

function run(command, arguments_, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      env: environment,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${String(code)}.`));
      }
    });
  });
}
