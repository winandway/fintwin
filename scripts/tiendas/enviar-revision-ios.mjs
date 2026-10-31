// Enviar a revisión de Apple (31 oct 2026, adaptado de Tumbite): adjunta a la versión en preparación la
// compilación más nueva que Apple ya procesó (VALID) y la envía a revisión. Usa la llave de la API guardada
// en ~/.config/fintwin/apple-asc.
// Uso: node scripts/tiendas/enviar-revision-ios.mjs
import { asc } from './asc.mjs';

const APP = '6829195734';

const [version] = (await asc('GET', `/v1/apps/${APP}/appStoreVersions?filter[platform]=IOS`)).data;
const estado = version.attributes.appStoreState;
if (estado !== 'PREPARE_FOR_SUBMISSION') {
  console.log(`La versión ya está en «${estado}», no se envía otra vez.`);
  process.exit(0);
}

let build = (await asc('GET', `/v1/appStoreVersions/${version.id}/build`)).data;
if (!build) {
  const builds = (
    await asc('GET', `/v1/builds?filter[app]=${APP}&filter[processingState]=VALID&sort=-uploadedDate&limit=1`)
  ).data;
  if (!builds.length) {
    console.log('Apple todavía no terminó de procesar ninguna compilación (ninguna en VALID).');
    process.exit(3);
  }
  build = builds[0];
  await asc('PATCH', `/v1/appStoreVersions/${version.id}/relationships/build`, {
    data: { type: 'builds', id: build.id },
  });
  console.log(`Compilación ${build.attributes.version} adjuntada a la versión ${version.attributes.versionString}.`);
}

// Una entrega abierta se reutiliza para no dejar borradores sueltos.
const abiertas = (
  await asc('GET', `/v1/reviewSubmissions?filter[app]=${APP}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW`)
).data;
const entrega =
  abiertas[0] ??
  (
    await asc('POST', '/v1/reviewSubmissions', {
      data: {
        type: 'reviewSubmissions',
        attributes: { platform: 'IOS' },
        relationships: { app: { data: { type: 'apps', id: APP } } },
      },
    })
  ).data;
const items = (await asc('GET', `/v1/reviewSubmissions/${entrega.id}/items`)).data;
if (!items.length)
  await asc('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: entrega.id } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
      },
    },
  });
await asc('PATCH', `/v1/reviewSubmissions/${entrega.id}`, {
  data: { type: 'reviewSubmissions', id: entrega.id, attributes: { submitted: true } },
});
const despues = (await asc('GET', `/v1/appStoreVersions/${version.id}`)).data.attributes.appStoreState;
console.log(`Enviada a revisión de Apple (versión ${version.attributes.versionString}). Estado: ${despues}.`);
