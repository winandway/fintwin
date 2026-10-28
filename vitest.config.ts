import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      { extends: true, test: { name: 'worker', include: ['test/worker/**/*.test.ts'], environment: 'node' } },
      { extends: true, test: { name: 'app', include: ['test/app/**/*.test.tsx'], environment: 'jsdom', setupFiles: ['test/app/setup.ts'] } },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/worker/**', 'src/shared/**', 'src/app/lib/**'],
      thresholds: { lines: 60, functions: 60, statements: 60, branches: 50 },
    },
  },
});
