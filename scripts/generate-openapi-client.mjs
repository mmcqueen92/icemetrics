import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';

const GENERATOR_VERSION = '7.22.0';
const GENERATOR_IMAGE =
  `openapitools/openapi-generator-cli:v${GENERATOR_VERSION}` +
  '@sha256:1f459499a7c794aa0ea769c3c9b0eb54806c5ad2f68510a0ebb9338d0a626ced';
const repositoryRoot = resolve(import.meta.dirname, '..');
const inputPath = resolve(
  process.argv[2] ?? join(repositoryRoot, 'apps/api/openapi/openapi.json'),
);
const outputPath = resolve(
  process.argv[3] ??
    join(repositoryRoot, 'apps/web/src/app/core/api/generated'),
);
const stagingDirectory = mkdtempSync(
  join(tmpdir(), 'icemetrics-openapi-client-'),
);

try {
  const dockerArguments = ['run', '--rm'];

  if (
    process.platform !== 'win32' &&
    typeof process.getuid === 'function' &&
    typeof process.getgid === 'function'
  ) {
    dockerArguments.push(
      '--user',
      `${String(process.getuid())}:${String(process.getgid())}`,
    );
  }

  dockerArguments.push(
    '--volume',
    `${dirname(inputPath)}:/input:ro`,
    '--volume',
    `${stagingDirectory}:/output`,
    GENERATOR_IMAGE,
    'generate',
    '--input-spec',
    `/input/${basename(inputPath)}`,
    '--generator-name',
    'typescript-angular',
    '--output',
    '/output',
    '--additional-properties',
    [
      'modelPropertyNaming=original',
      'ngVersion=22.0.0',
      'npmName=@icemetrics/api-client',
      'npmVersion=0.1.0',
      'providedIn=root',
      'stringEnums=true',
    ].join(','),
    '--global-property',
    [
      'apiDocs=false',
      'apiTests=false',
      'modelDocs=false',
      'modelTests=false',
    ].join(','),
  );

  const result = spawnSync('docker', dockerArguments, {
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `OpenAPI Generator exited with status ${String(result.status)}.`,
    );
  }

  const generatedTypeScriptFiles = listFiles(stagingDirectory).filter((file) =>
    file.endsWith('.ts'),
  );

  rmSync(outputPath, { force: true, recursive: true });
  mkdirSync(outputPath, { recursive: true });

  for (const sourcePath of generatedTypeScriptFiles) {
    const relativePath = relative(stagingDirectory, sourcePath);
    const destinationPath = join(outputPath, relativePath);
    mkdirSync(dirname(destinationPath), { recursive: true });
    cpSync(sourcePath, destinationPath);
  }

  const manifest = {
    files: generatedTypeScriptFiles
      .map((file) => relative(stagingDirectory, file).replaceAll('\\', '/'))
      .sort(),
    generator: GENERATOR_IMAGE,
    specSha256: createHash('sha256')
      .update(readFileSync(inputPath))
      .digest('hex'),
  };
  writeFileSync(
    join(outputPath, 'generation-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  console.info(
    `Generated Angular API client with ${GENERATOR_IMAGE} (${manifest.files.length} TypeScript files).`,
  );
} finally {
  rmSync(stagingDirectory, { force: true, recursive: true });
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}
