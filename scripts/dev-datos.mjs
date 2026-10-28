// Servidor local de /datos para probar las pantallas: misma lógica del sitio,
// base SQLite en memoria y correos impresos en la consola (nunca se mandan).
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';

await build({
  entryPoints: ['scripts/dev-entry.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: 'node_modules/.dev/dev-entry.mjs',
  external: ['node:sqlite'],
});
const { worker, crearD1, crearBucket } = await import(`${process.cwd()}/node_modules/.dev/dev-entry.mjs`);

const env = {
  DB: crearD1(),
  BUCKET: crearBucket(),
  ASSETS: { fetch: async () => new Response('not found', { status: 404 }) },
  APP_URL: 'http://localhost:5175',
  MAIL_FROM: 'no-reply@fintwin.windoce.com',
  SITIO_TOKEN: 'local',
};

const fetchReal = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes('/api/hosting/correo/enviar')) {
    const b = JSON.parse(String(init?.body));
    console.log(`\n[correo] para ${b.to[0].address}: ${b.subject}\n${b.text}\n`);
    writeFileSync('node_modules/.dev/ultimo-correo.txt', b.text);
    return new Response('{"ok":true}');
  }
  return fetchReal(input, init);
};

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const r = await worker.fetch(
    new Request(`http://localhost:8788${req.url}`, { method: req.method, headers: req.headers, body, duplex: 'half' }),
    env,
  );
  const headers = {};
  r.headers.forEach((v, k) => (headers[k] = v));
  res.writeHead(r.status, headers);
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(8788, () => console.log('datos locales en http://127.0.0.1:8788'));
