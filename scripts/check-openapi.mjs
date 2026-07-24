import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'icemetrics-openapi-'));
const generatedPath = join(temporaryDirectory, 'openapi.json');
const generatedClientPath = join(temporaryDirectory, 'client');
const committedPath = resolve('apps/api/openapi/openapi.json');
const committedClientPath = resolve('apps/web/src/app/core/api/generated');

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
      const clientResult = spawnSync(
        process.execPath,
        [
          'scripts/generate-openapi-client.mjs',
          generatedPath,
          generatedClientPath,
        ],
        { stdio: 'inherit' },
      );

      if (clientResult.error) {
        throw clientResult.error;
      }

      if (clientResult.status !== 0) {
        process.exitCode = clientResult.status ?? 1;
      } else if (
        JSON.stringify(directorySnapshot(generatedClientPath)) !==
        JSON.stringify(directorySnapshot(committedClientPath))
      ) {
        console.error(
          'Generated Angular API client has drifted. Run npm run openapi:generate and commit the result.',
        );
        process.exitCode = 1;
      } else {
        console.log('OpenAPI document and Angular client are current.');
      }
    }
  }
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true });
}

function directorySnapshot(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return directorySnapshot(path).map(([name, content]) => [
          `${entry.name}/${name}`,
          content,
        ]);
      }

      return [[entry.name, readFileSync(path, 'utf8')]];
    })
    .sort(([left], [right]) => left.localeCompare(right));
}
