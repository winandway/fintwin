// Ficha de FinTwin en la App Store (31 oct 2026): textos en inglés y español, categoría, clasificación
// por edad, enlaces, copyright, derechos de contenido, precio gratis en todos los países y datos para
// el revisor de Apple. Usa la llave de la API guardada en ~/.config/fintwin/apple-asc.
// Uso: node scripts/tiendas/ficha-app-store.mjs
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { asc } from './asc.mjs';

const APP = '6829195734';
const CONFIG = join(os.homedir(), '.config');
const revisor = fs.readFileSync(join(CONFIG, 'windoce-hub', 'fintwin-reviewer'), 'utf8');
const correoRevisor = /email=(.*)/.exec(revisor)[1].trim();
const claveRevisor = /password[:=]\s*(.*)/i.exec(revisor)[1].trim();
const telefono = (/Teléfono de la empresa:\s*(.+)/.exec(fs.readFileSync(join(CONFIG, 'fintwin', 'empresa-windoce.md'), 'utf8'))?.[1] ?? '')
  .replace(/[^\d+]/g, '')
  .replace(/^(\d{10})$/, '+1$1');

const TEXTOS = {
  'en-US': {
    name: 'FinTwin: Receipts & Income',
    subtitle: 'Business receipts, read by AI',
    promotionalText: 'Share your payment link: clients upload their receipt, AI reads it, duplicates are blocked and your team approves with its own PIN.',
    description: `FinTwin keeps your company's income records in order, without typing.

Share your payment link or QR. Whoever paid you uploads the receipt with its confirmation number. FinTwin reads the amount, the date and the confirmation code, blocks duplicates and leaves it ready for your team to approve.

WHAT YOU CAN DO
• Share a payment link or QR so clients upload their own receipts.
• Let AI read each receipt and fill in the details.
• Catch duplicate receipts before they are counted twice.
• Approve or reject several receipts at once with your own 4-digit PIN.
• Get a notification on your phone when a new receipt arrives.
• Record outflows with their invoice attached.
• Log commission expenses with the purchase ticket, grouped by category.
• Keep several accounts in one place: branches, clients or business units.
• Invite validators to your team, each with a personal PIN.

IMPORTANT
FinTwin is a record-keeping tool. It does not move, hold, send or receive money, and it is not a bank or a payment service.

Developed by Windoce LLC.`,
    keywords: 'receipts,invoices,income,records,business,duplicates,team,approval,expenses,bookkeeping',
    supportUrl: 'https://windoce.com/',
    marketingUrl: 'https://fintwin.windoce.com/',
    privacyPolicyUrl: 'https://windoce.com/privacy/',
  },
  'es-MX': {
    name: 'FinTwin: Ingresos y Recibos',
    subtitle: 'Comprobantes leídos por IA',
    promotionalText: 'Comparte tu link de pago: tus clientes suben su captura, la IA la lee, frena los repetidos y tu equipo aprueba con su propio PIN.',
    description: `FinTwin mantiene en orden los registros de ingresos de tu empresa, sin escribir a mano.

Comparte tu link de pago o tu QR. Quien te pagó sube su captura con el número de confirmación. FinTwin lee el monto, la fecha y el código, frena los repetidos y la deja lista para que tu equipo la apruebe.

QUÉ PUEDES HACER
• Compartir un link de pago o un QR para que tus clientes suban sus capturas.
• Dejar que la IA lea cada comprobante y llene los datos.
• Detectar comprobantes repetidos antes de que se cuenten dos veces.
• Aprobar o rechazar varios a la vez con tu PIN de 4 números.
• Recibir un aviso en el celular cuando llega una captura nueva.
• Registrar salidas con su factura adjunta.
• Anotar los gastos de la comisión con el ticket de compra, ordenados por categoría.
• Tener varias cuentas en un solo lugar: sucursales, clientes o áreas del negocio.
• Invitar validadores a tu equipo, cada uno con su propio PIN.

IMPORTANTE
FinTwin es una herramienta de registro. No mueve, no guarda, no envía ni recibe dinero, y no es un banco ni un servicio de pagos.

Desarrollado por Windoce LLC.`,
    keywords: 'comprobantes,facturas,ingresos,registro,empresa,repetidos,equipo,aprobar,gastos,contabilidad',
    supportUrl: 'https://windoce.com/',
    marketingUrl: 'https://fintwin.windoce.com/',
    privacyPolicyUrl: 'https://windoce.com/privacy/',
  },
};

const [info] = (await asc('GET', `/v1/apps/${APP}/appInfos`)).data;
await asc('PATCH', `/v1/appInfos/${info.id}`, {
  data: {
    type: 'appInfos',
    id: info.id,
    relationships: {
      primaryCategory: { data: { type: 'appCategories', id: 'BUSINESS' } },
      secondaryCategory: { data: { type: 'appCategories', id: 'PRODUCTIVITY' } },
    },
  },
});

const infoLocs = (await asc('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`)).data;
for (const [locale, t] of Object.entries(TEXTOS)) {
  const attrs = { name: t.name, subtitle: t.subtitle, privacyPolicyUrl: t.privacyPolicyUrl };
  const ya = infoLocs.find((l) => l.attributes.locale === locale);
  if (ya) await asc('PATCH', `/v1/appInfoLocalizations/${ya.id}`, { data: { type: 'appInfoLocalizations', id: ya.id, attributes: attrs } });
  else
    await asc('POST', '/v1/appInfoLocalizations', {
      data: { type: 'appInfoLocalizations', attributes: { locale, ...attrs }, relationships: { appInfo: { data: { type: 'appInfos', id: info.id } } } },
    });
}

// Clasificación por edad: nada sensible. Los comprobantes son privados de cada empresa (no es contenido público).
const edad = (await asc('GET', `/v1/appInfos/${info.id}/ageRatingDeclaration`)).data;
const BOOLEANOS = new Set(['advertising', 'gambling', 'lootBox', 'healthOrWellnessTopics', 'messagingAndChat', 'parentalControls', 'ageAssurance', 'socialMedia', 'socialMediaAgeRestricted', 'unrestrictedWebAccess', 'userGeneratedContent']);
const OMITIR = new Set(['kidsAgeBand', 'gracRatingClassificationNumber', 'developerAgeRatingInfoUrl']);
const respuestas = Object.fromEntries(
  Object.keys(edad.attributes)
    .filter((k) => !OMITIR.has(k) && !k.startsWith('ageRatingOverride') && k !== 'koreaAgeRatingOverride')
    .map((k) => [k, BOOLEANOS.has(k) ? false : 'NONE']),
);
await asc('PATCH', `/v1/ageRatingDeclarations/${edad.id}`, { data: { type: 'ageRatingDeclarations', id: edad.id, attributes: respuestas } });

await asc('PATCH', `/v1/apps/${APP}`, {
  data: { type: 'apps', id: APP, attributes: { contentRightsDeclaration: 'DOES_NOT_USE_THIRD_PARTY_CONTENT' } },
});

const [version] = (await asc('GET', `/v1/apps/${APP}/appStoreVersions?filter[platform]=IOS`)).data;
await asc('PATCH', `/v1/appStoreVersions/${version.id}`, {
  data: { type: 'appStoreVersions', id: version.id, attributes: { copyright: '2026 Windoce LLC' } },
});
const verLocs = (await asc('GET', `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).data;
for (const [locale, t] of Object.entries(TEXTOS)) {
  const attrs = { description: t.description, promotionalText: t.promotionalText, keywords: t.keywords.slice(0, 100), supportUrl: t.supportUrl, marketingUrl: t.marketingUrl };
  const ya = verLocs.find((l) => l.attributes.locale === locale);
  if (ya) await asc('PATCH', `/v1/appStoreVersionLocalizations/${ya.id}`, { data: { type: 'appStoreVersionLocalizations', id: ya.id, attributes: attrs } });
  else
    await asc('POST', '/v1/appStoreVersionLocalizations', {
      data: { type: 'appStoreVersionLocalizations', attributes: { locale, ...attrs }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } },
    });
}

// Datos para el revisor: el mismo usuario de prueba que tiene Google Play.
const revision = {
  contactFirstName: 'Pedro',
  contactLastName: 'Llerena',
  contactEmail: 'go@windoce.com',
  contactPhone: telefono,
  demoAccountName: correoRevisor,
  demoAccountPassword: claveRevisor,
  demoAccountRequired: true,
  notes: [
    'FinTwin is a business record-keeping tool: companies collect payment receipts from their clients, AI reads them, duplicates are blocked and the team approves them with a personal PIN. It does not move or hold money.',
    'Sign in with the account above. Tap "New account" (a ledger inside the app, not a new user), type any name and any 4-digit PIN.',
    'Native features: push notifications when a client uploads a receipt, the iOS share sheet for the payment link (menu ⋮ → Payment link and QR → Share link), camera and photo library to attach receipts, invoices and purchase tickets, and an offline screen.',
    'Users can delete their account in the app (account menu → Delete my user). Support: go@windoce.com.',
  ].join('\n'),
};
const det = await asc('GET', `/v1/appStoreVersions/${version.id}/appStoreReviewDetail`).catch(() => null);
if (det?.data) await asc('PATCH', `/v1/appStoreReviewDetails/${det.data.id}`, { data: { type: 'appStoreReviewDetails', id: det.data.id, attributes: revision } });
else
  await asc('POST', '/v1/appStoreReviewDetails', {
    data: { type: 'appStoreReviewDetails', attributes: revision, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } },
  });

console.log('Ficha cargada: textos en-US y es-MX, categoría, edad, derechos, copyright y revisor.');
