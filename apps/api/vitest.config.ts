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
        'src/common/errors/api-error.dto.ts',
        'src/common/errors/api-exception.filter.ts',
        'src/common/health/health.controller.ts',
        'src/common/health/health.module.ts',
        'src/common/http/**',
        'src/common/logging/logging.module.ts',
        'src/common/pagination/pagination.dto.ts',
        'src/common/rate-limit/**',
        'src/common/validation/uuid-param.dto.ts',
        'src/common/validation/validated-parameters.ts',
        'src/database/database.module.ts',
        'src/job-runner.ts',
        'src/main.ts',
        'src/openapi/**',
      ],
      include: [
        'src/common/config/**/*.ts',
        'src/common/errors/api-error.ts',
        'src/common/health/database-health.service.ts',
        'src/common/logging/*.ts',
        'src/common/pagination/**/*.ts',
        'src/common/validation/**/*.ts',
        'src/database/prisma.service.ts',
        'src/games/services/**/*.ts',
        'src/leagues/services/**/*.ts',
        'src/players/services/**/*.ts',
        'src/seasons/services/**/*.ts',
        'src/standings/services/**/*.ts',
        'src/teams/services/**/*.ts',
      ],
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
