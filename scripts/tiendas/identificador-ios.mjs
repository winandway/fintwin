// Registra el identificador de la app de iPhone (com.windoce.fintwin) en el portal de Apple, con
// la capacidad de avisos (notificaciones push). Si ya existe, no hace nada.
// Uso: node scripts/tiendas/identificador-ios.mjs
import { asc } from './asc.mjs';

const BUNDLE = 'com.windoce.fintwin';
const ya = (await asc('GET', `/v1/bundleIds?filter[identifier]=${BUNDLE}`)).data.find(
  (b) => b.attributes.identifier === BUNDLE,
);
const bundle =
  ya ??
  (
    await asc('POST', '/v1/bundleIds', {
      data: { type: 'bundleIds', attributes: { identifier: BUNDLE, name: 'FinTwin', platform: 'IOS' } },
    })
  ).data;
const caps = (await asc('GET', `/v1/bundleIds/${bundle.id}/bundleIdCapabilities`)).data;
if (!caps.some((c) => c.attributes.capabilityType === 'PUSH_NOTIFICATIONS'))
  await asc('POST', '/v1/bundleIdCapabilities', {
    data: {
      type: 'bundleIdCapabilities',
      attributes: { capabilityType: 'PUSH_NOTIFICATIONS' },
      relationships: { bundleId: { data: { type: 'bundleIds', id: bundle.id } } },
    },
  });
console.log(`${BUNDLE}: ${ya ? 'ya existía' : 'creado'} (id ${bundle.id}), con avisos.`);
