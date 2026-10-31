// Precio gratis y disponible en todos los países (31 oct 2026). Apple pide nombrar los territorios.
// Uso: node scripts/tiendas/precio-disponibilidad.mjs
import { asc } from './asc.mjs';

const APP = '6829195734';

// Precio: el punto de precio 0 de Estados Unidos como base.
const puntos = (await asc('GET', `/v1/apps/${APP}/appPricePoints?filter[territory]=USA&limit=200`)).data;
const gratis = puntos.find((p) => Number(p.attributes.customerPrice) === 0);
if (!gratis) throw new Error('No encontré el precio gratis');
await asc('POST', '/v1/appPriceSchedules', {
  data: {
    type: 'appPriceSchedules',
    relationships: {
      app: { data: { type: 'apps', id: APP } },
      baseTerritory: { data: { type: 'territories', id: 'USA' } },
      manualPrices: { data: [{ type: 'appPrices', id: '${precio}' }] },
    },
  },
  included: [
    {
      type: 'appPrices',
      id: '${precio}',
      attributes: { startDate: null },
      relationships: { appPricePoint: { data: { type: 'appPricePoints', id: gratis.id } } },
    },
  ],
});

// Disponibilidad: todos los territorios, y los nuevos que Apple agregue.
const territorios = [];
let url = '/v1/territories?limit=200';
while (url) {
  const r = await asc('GET', url);
  territorios.push(...r.data.map((t) => t.id));
  url = r.links?.next ? r.links.next.replace('https://api.appstoreconnect.apple.com', '') : null;
}
await asc('POST', '/v2/appAvailabilities', {
  data: {
    type: 'appAvailabilities',
    attributes: { availableInNewTerritories: true },
    relationships: {
      app: { data: { type: 'apps', id: APP } },
      territoryAvailabilities: { data: territorios.map((t) => ({ type: 'territoryAvailabilities', id: `\${${t}}` })) },
    },
  },
  included: territorios.map((t) => ({
    type: 'territoryAvailabilities',
    id: `\${${t}}`,
    attributes: { available: true },
    relationships: { territory: { data: { type: 'territories', id: t } } },
  })),
});
console.log(`Gratis y disponible en ${territorios.length} países.`);
