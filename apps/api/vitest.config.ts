import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        'src/app.module.ts',
        'src/job-runner.ts',
        'src/main.ts',
        'src/openapi/**',
      ],
      include: ['src/common/config/**/*.ts'],
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
