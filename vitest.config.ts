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
      // Umbrales fijados en lo que hay hoy (8 nov 2026): de aquí solo suben. Lo de dinero, sesiones,
      // permisos y datos personales exige 90 % de líneas (regla global); lo que aún no llega queda en su piso actual.
      thresholds: {
        lines: 88,
        functions: 87,
        statements: 84,
        branches: 71,
        'src/worker/auth.ts': { lines: 90 },
        'src/worker/crypto.ts': { lines: 90 },
        'src/worker/accesos.ts': { lines: 90 },
        'src/worker/movimientos.ts': { lines: 90 },
        'src/worker/pagar.ts': { lines: 90 },
        'src/worker/capturas.ts': { lines: 90 },
        'src/app/lib/borrador.ts': { lines: 90 },
        'src/worker/cuentas.ts': { lines: 85 },
        'src/worker/gastos.ts': { lines: 89 },
        'src/app/lib/sesion.tsx': { lines: 56 },
      },
    },
  },
});
