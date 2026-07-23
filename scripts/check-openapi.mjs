import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'icemetrics-openapi-'));
const generatedPath = join(temporaryDirectory, 'openapi.json');
const committedPath = resolve('apps/api/openapi/openapi.json');

try {
  const result = spawnSync(
    process.execPath,
    ['apps/api/dist/openapi/generate-openapi.js'],
    {
      env: {
        ...process.env,
        OPENAPI_OUTPUT_PATH: generatedPath,
      },
      stdio: 'inherit',
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  } else {
    const generated = readFileSync(generatedPath, 'utf8');
    const committed = readFileSync(committedPath, 'utf8');

    if (generated !== committed) {
      console.error(
        'OpenAPI output has drifted. Run npm run openapi:generate and commit the result.',
      );
      process.exitCode = 1;
    } else {
      console.log('OpenAPI document is current.');
    }
  }
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true });
}
