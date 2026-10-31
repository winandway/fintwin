// Capturas de la App Store (31 oct 2026): sube las capturas ORIGINALES de docs/capturas-tiendas/ios/<en|es>/
// (1320×2868, APP_IPHONE_67) a la versión en inglés y en español. Reemplaza las que hubiera.
// Uso: node scripts/tiendas/capturas-app-store.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import { join } from 'node:path';
import { asc } from './asc.mjs';

const APP = '6829195734';
const CARPETAS = new Map([
  ['en-US', 'en'],
  ['es-MX', 'es'],
]);
const TIPO = 'APP_IPHONE_67';

async function subir(setId, archivo) {
  const datos = fs.readFileSync(archivo);
  const res = await asc('POST', '/v1/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: { fileName: archivo.split('/').at(-1), fileSize: datos.length },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } },
    },
  });
  for (const op of res.data.attributes.uploadOperations) {
    const r = await fetch(op.url, {
      method: op.method,
      headers: Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value])),
      body: datos.subarray(op.offset, op.offset + op.length),
    });
    if (!r.ok) throw new Error(`subida ${r.status}`);
  }
  await asc('PATCH', `/v1/appScreenshots/${res.data.id}`, {
    data: {
      type: 'appScreenshots',
      id: res.data.id,
      attributes: { uploaded: true, sourceFileChecksum: crypto.createHash('md5').update(datos).digest('hex') },
    },
  });
}

const [version] = (await asc('GET', `/v1/apps/${APP}/appStoreVersions?filter[platform]=IOS`)).data;
const locs = (await asc('GET', `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).data;
for (const loc of locs) {
  const carpeta = CARPETAS.get(loc.attributes.locale);
  if (!carpeta) continue;
  const dir = join('docs', 'capturas-tiendas', 'ios', carpeta);
  const archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort().slice(0, 10);
  const sets = (await asc('GET', `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`)).data;
  const viejo = sets.find((x) => x.attributes.screenshotDisplayType === TIPO);
  if (viejo) await asc('DELETE', `/v1/appScreenshotSets/${viejo.id}`);
  const set = await asc('POST', '/v1/appScreenshotSets', {
    data: {
      type: 'appScreenshotSets',
      attributes: { screenshotDisplayType: TIPO },
      relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } },
    },
  });
  for (const f of archivos) await subir(set.data.id, join(dir, f));
  console.log(`${loc.attributes.locale}: ${archivos.length} capturas`);
}
