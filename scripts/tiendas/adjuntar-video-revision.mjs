// Adjuntar un video (o cualquier archivo) a la información para el revisor de Apple (3 nov 2026). Es lo que
// Apple pidió con la guía 2.1: una grabación en un iPhone físico. Conviene achicarlo antes con ffmpeg
// (720 de ancho, H.264): el original del iPhone pesa cientos de MB.
// Uso: node scripts/tiendas/adjuntar-video-revision.mjs <archivo.mp4>
import crypto from 'node:crypto';
import fs from 'node:fs';
import { basename } from 'node:path';
import { asc } from './asc.mjs';

const APP = '6829195734';
const archivo = process.argv[2];
if (!archivo) {
  console.log('Falta el archivo: node scripts/tiendas/adjuntar-video-revision.mjs <archivo.mp4>');
  process.exit(2);
}
const bytes = fs.readFileSync(archivo);
const [version] = (await asc('GET', `/v1/apps/${APP}/appStoreVersions?filter[platform]=IOS`)).data;
const detalle = (await asc('GET', `/v1/appStoreVersions/${version.id}/appStoreReviewDetail`)).data;

const nuevo = (
  await asc('POST', '/v1/appStoreReviewAttachments', {
    data: {
      type: 'appStoreReviewAttachments',
      attributes: { fileName: basename(archivo), fileSize: bytes.length },
      relationships: { appStoreReviewDetail: { data: { type: 'appStoreReviewDetails', id: detalle.id } } },
    },
  })
).data;
for (const op of nuevo.attributes.uploadOperations) {
  const cabeceras = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
  const r = await fetch(op.url, { method: op.method, headers: cabeceras, body: bytes.subarray(op.offset, op.offset + op.length) });
  if (!r.ok) throw new Error(`Falló la parte ${op.offset}: ${r.status}`);
}
const md5 = crypto.createHash('md5').update(bytes).digest('hex');
await asc('PATCH', `/v1/appStoreReviewAttachments/${nuevo.id}`, {
  data: { type: 'appStoreReviewAttachments', id: nuevo.id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
});
console.log(`Adjuntado «${basename(archivo)}» a la información para el revisor (versión ${version.attributes.versionString}).`);
