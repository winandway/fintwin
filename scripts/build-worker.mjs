// Empaqueta el servidor en un solo _worker.js y deja schema.sql al lado,
// que es lo que YaDominios Cloud lee de la raíz de yapanel-build.
import { build } from 'esbuild';
import { copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// La versión (commit) viaja dentro del servidor: la prueba de humo espera a verla en vivo.
const version = process.env.GITHUB_SHA ?? execSync('git rev-parse HEAD').toString().trim();

await build({
  entryPoints: ['src/worker/index.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'neutral',
  outfile: 'dist/_worker.js',
  minify: true,
  legalComments: 'none',
  define: { __VERSION__: JSON.stringify(version) },
});
copyFileSync('schema.sql', 'dist/schema.sql');
console.log('dist/_worker.js + dist/schema.sql listos');
