import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';

const blueprint = parse(await readFile('render.yaml', 'utf8'));
const dockerfile = await readFile('Dockerfile.api', 'utf8');
const workflow = await readFile('.github/workflows/deployment.yml', 'utf8');
parse(workflow);

assert(
  blueprint.previews?.generation === 'off',
  'Render previews must be off.',
);
assert(blueprint.projects?.length === 1, 'Expected one Render project.');
const environments = blueprint.projects[0]?.environments;
assert(environments?.length === 2, 'Expected staging and production.');

const names = new Set();
for (const environment of environments) {
  assert(
    environment.networking?.isolation === 'enabled',
    `${environment.name} private networking must be isolated.`,
  );
  assert(
    environment.databases?.length === 1,
    `${environment.name} must own one database.`,
  );
  const database = environment.databases[0];
  assert(
    database.postgresMajorVersion === '17',
    `${environment.name} must pin PostgreSQL 17.`,
  );
  assert(
    Array.isArray(database.ipAllowList) && database.ipAllowList.length === 0,
    `${environment.name} database external access must be blocked.`,
  );
  assert(
    database.plan !== 'free',
    `${environment.name} database cannot be free.`,
  );

  const services = environment.services ?? [];
  assert(services.length === 3, `${environment.name} must own web/API/jobs.`);
  for (const service of services) {
    assert(
      !names.has(service.name),
      `Duplicate Render service ${service.name}.`,
    );
    names.add(service.name);
    assert(
      service.autoDeployTrigger === 'off',
      `${service.name} must deploy only through exact-SHA workflow hooks.`,
    );
    for (const variable of service.envVars ?? []) {
      if (variable.fromDatabase) {
        assert(
          variable.fromDatabase.name === database.name,
          `${service.name} references another environment's database.`,
        );
      }
    }
  }
  const api = services.find((service) => service.name.endsWith('-api'));
  const jobs = services.find((service) => service.name.endsWith('-jobs'));
  const web = services.find((service) => service.name.endsWith('-web'));
  assert(
    api?.preDeployCommand ===
      'npm run db:migrate:deploy --workspace @icemetrics/api',
    `${environment.name} API must apply migrations once before deploy.`,
  );
  assert(
    api?.healthCheckPath === '/health/ready',
    'API readiness is required.',
  );
  assert(jobs?.schedule === '0 * * * *', 'Jobs must run hourly.');
  assert(
    jobs?.dockerCommand?.includes('job-runner.js health'),
    'Cron must finish with the freshness gate.',
  );
  assert(
    web?.routes?.some(
      (route) =>
        route.type === 'rewrite' &&
        route.source === '/*' &&
        route.destination === '/index.html',
    ),
    'Static site requires the SPA fallback.',
  );
}

const production = environments.find(
  (environment) => environment.name === 'production',
);
assert(
  production?.permissions?.protection === 'enabled',
  'Production Render environment must be protected.',
);
assert(
  /npm ci --omit=dev/.test(dockerfile) && /^USER icemetrics$/m.test(dockerfile),
  'Production image must install production dependencies and run non-root.',
);
assert(
  workflow.includes('environment: production') &&
    workflow.includes('verify-staging-release') &&
    workflow.includes('inputs.release'),
  'Promotion workflow must gate production on a staging-verified SHA.',
);

process.stdout.write('Deployment configuration is internally consistent.\n');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
