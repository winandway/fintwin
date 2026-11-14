// Capturas de Docs: tipo de pago y «Tomar foto» en el link de pago, en inglés y español.
// Uso: con `npm run dev:todo` corriendo, `node scripts/capturas-docs.mjs <slug> <correo> <clave>`.
import { chromium } from '@playwright/test';
import { copyFileSync } from 'node:fs';

const [slug, email, clave] = process.argv.slice(2);
const base = 'http://localhost:5175';
const navegador = await chromium.launch();
for (const idioma of ['en', 'es']) {
  const ctx = await navegador.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, colorScheme: 'dark' });
  await ctx.addInitScript((i) => localStorage.setItem('fintwin:idioma', i), idioma);
  const r = await ctx.request.post(`${base}/datos/auth/entrar`, { headers: { 'x-fintwin': '1' }, data: { email, clave } });
  if (!r.ok()) throw new Error(`no entró: ${r.status()}`);
  await ctx.request.post(`${base}/datos/yo/idioma`, { headers: { 'x-fintwin': '1' }, data: { idioma } });
  const p = await ctx.newPage();
  await p.goto(`${base}/pay/${slug}`);
  await p.getByTestId('tipo-pago').selectOption('otro');
  await p.getByTestId('tipo-pago-otro').fill('Binance');
  // La cabecera fija taparía la captura; se deja quieta arriba y se mide desde el principio.
  await p.addStyleTag({ content: 'header{position:static!important}' });
  await p.evaluate(() => window.scrollTo(0, 0));
  const desde = await p.getByTestId('subir-archivos').boundingBox();
  const hasta = await p.getByTestId('tipo-pago-otro').boundingBox();
  if (!desde || !hasta) throw new Error('no se encontraron las casillas');
  // fullPage: las cajas sin desplazar ya están en coordenadas de la página.
  const arriba = desde.y - 230;
  const salida = `docs/capturas/tipo-pago-${idioma}.png`;
  await p.screenshot({ path: salida, fullPage: true, clip: { x: 0, y: arriba, width: 375, height: hasta.y + hasta.height + 16 - arriba } });
  copyFileSync(salida, `public/docs/tipo-pago-${idioma}.png`);
  await ctx.close();
}
await navegador.close();
console.log('capturas listas');
