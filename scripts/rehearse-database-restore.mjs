import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const container = `icemetrics-restore-rehearsal-${randomUUID()}`;
const password = randomUUID();
const database = 'icemetrics_source';

try {
  run('docker', [
    'run',
    '--detach',
    '--name',
    container,
    '--publish',
    '127.0.0.1::5432',
    '--env',
    `POSTGRES_DB=${database}`,
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    '--env',
    'POSTGRES_USER=icemetrics',
    'postgres:17.10-alpine3.23',
  ]);
  waitUntilReady();
  const portOutput = run('docker', ['port', container, '5432/tcp']).trim();
  const port = portOutput.match(/:(\d+)$/)?.[1];
  if (!port) throw new Error('Could not resolve the rehearsal database port.');

  const environment = {
    ...process.env,
    APP_ENV: 'local',
    DATABASE_URL: `postgresql://icemetrics:${password}@localhost:${port}/${database}`,
    NODE_ENV: 'development',
  };
  run('npm.cmd', ['run', 'db:migrate:deploy'], environment);
  run('npm.cmd', ['run', 'db:seed'], environment);
  run('docker', [
    'exec',
    container,
    'pg_dump',
    '--username=icemetrics',
    '--format=custom',
    '--file=/tmp/icemetrics.dump',
    database,
  ]);
  run('docker', [
    'exec',
    container,
    'createdb',
    '--username=icemetrics',
    'icemetrics_restored',
  ]);
  run('docker', [
    'exec',
    container,
    'pg_restore',
    '--username=icemetrics',
    '--dbname=icemetrics_restored',
    '--exit-on-error',
    '/tmp/icemetrics.dump',
  ]);

  const source = fingerprint(database);
  const restored = fingerprint('icemetrics_restored');
  if (source !== restored) {
    throw new Error(
      `Restore fingerprint mismatch: source=${source}, restored=${restored}`,
    );
  }
  process.stdout.write(
    `${JSON.stringify({
      checkedAt: new Date().toISOString(),
      fingerprint: source,
      postgresImage: 'postgres:17.10-alpine3.23',
      status: 'ok',
    })}\n`,
  );
} finally {
  spawnSync('docker', ['rm', '--force', container], { stdio: 'ignore' });
}

function fingerprint(targetDatabase) {
  return run('docker', [
    'exec',
    container,
    'psql',
    '--username=icemetrics',
    '--dbname',
    targetDatabase,
    '--tuples-only',
    '--no-align',
    '--command',
    `SELECT json_build_object(
      'migrations', (SELECT count(*) FROM public."_prisma_migrations"),
      'leagues', (SELECT count(*) FROM core.league),
      'seasons', (SELECT count(*) FROM core.season),
      'teams', (SELECT count(*) FROM core.team),
      'players', (SELECT count(*) FROM core.player)
    )::text;`,
  ]).trim();
}

function waitUntilReady() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = spawnSync(
      'docker',
      [
        'exec',
        container,
        'pg_isready',
        '--username=icemetrics',
        '--dbname',
        database,
      ],
      { stdio: 'ignore' },
    );
    if (result.status === 0) return;
  }
  throw new Error('Rehearsal PostgreSQL did not become ready.');
}

function run(command, args, environment = process.env) {
  const npmCli = process.env['npm_execpath'];
  const executable =
    command === 'npm.cmd' && npmCli ? process.execPath : command;
  const executableArgs =
    command === 'npm.cmd' && npmCli ? [npmCli, ...args] : args;
  const result = spawnSync(executable, executableArgs, {
    encoding: 'utf8',
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed:\n${
        result.error?.message ?? result.stderr ?? result.stdout
      }`,
    );
  }
  return result.stdout;
}
