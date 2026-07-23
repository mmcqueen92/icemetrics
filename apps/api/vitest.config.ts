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
    coverage: {
      exclude: [
        'src/app.module.ts',
        'src/common/health/health.controller.ts',
        'src/common/health/health.module.ts',
        'src/job-runner.ts',
        'src/main.ts',
        'src/openapi/**',
      ],
      include: ['src/common/config/**/*.ts', 'src/common/health/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    restoreMocks: true,
  },
});
