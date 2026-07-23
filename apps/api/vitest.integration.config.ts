import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
      },
    },
  },
  test: {
    environment: 'node',
    fileParallelism: true,
    hookTimeout: 90_000,
    include: ['test/**/*.integration.spec.ts'],
    restoreMocks: true,
    testTimeout: 90_000,
  },
});
