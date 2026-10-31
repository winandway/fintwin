// Llave de avisos (APNs) en Expo (31 oct 2026): la primera compilación de iPhone se hace sin configurar
// avisos (pediría el Apple ID); esta pieza carga después la llave guardada en ~/.config/fintwin/apple-apns
// y la conecta a las credenciales de la app, por la API de Expo. Si la llave ya existe en la cuenta, la reutiliza.
// Uso: node scripts/tiendas/llave-avisos-expo.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROYECTO = '@windoce-llc/fintwin';
const dir = join(homedir(), '.config/fintwin');
const token = readFileSync(join(dir, 'expo-token'), 'utf8').trim();
const carpeta = join(dir, 'apple-apns');
const keyId = readFileSync(join(carpeta, 'key-id'), 'utf8').trim();
const p8 = readFileSync(join(carpeta, readdirSync(carpeta).find((f) => f.endsWith('.p8'))), 'utf8');

async function gql(query, variables = {}) {
  const r = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

const { app } = await gql(
  `query($n: String!) { app { byFullName(fullName: $n) {
      ownerAccount { id name }
      iosAppCredentials { id appleTeam { id appleTeamIdentifier }
        appleAppIdentifier { bundleIdentifier } pushKey { id keyIdentifier } } } } }`,
  { n: PROYECTO },
);
const cuenta = app.byFullName.ownerAccount;
const credenciales = app.byFullName.iosAppCredentials[0];
if (!credenciales) throw new Error('La app todavía no tiene credenciales de iPhone en Expo (falta la primera compilación).');
if (credenciales.pushKey) {
  console.log(`Ya tiene llave de avisos: ${credenciales.pushKey.keyIdentifier}. Nada que hacer.`);
  process.exit(0);
}

const { account } = await gql(
  `query($n: String!) { account { byName(accountName: $n) {
      applePushKeysPaginated(first: 50) { edges { node { id keyIdentifier } } } } } }`,
  { n: cuenta.name },
);
let llave = account.byName.applePushKeysPaginated.edges.map((e) => e.node).find((k) => k.keyIdentifier === keyId);
if (!llave) {
  const d = await gql(
    `mutation($i: ApplePushKeyInput!, $a: ID!) { applePushKey { createApplePushKey(applePushKeyInput: $i, accountId: $a) { id keyIdentifier } } }`,
    { i: { appleTeamId: credenciales.appleTeam.id, keyIdentifier: keyId, keyP8: p8 }, a: cuenta.id },
  );
  llave = d.applePushKey.createApplePushKey;
  console.log(`Llave de avisos subida a Expo: ${llave.keyIdentifier}.`);
}
await gql(`mutation($c: ID!, $k: ID!) { iosAppCredentials { setPushKey(id: $c, pushKeyId: $k) { id } } }`, {
  c: credenciales.id,
  k: llave.id,
});
console.log(`Llave ${llave.keyIdentifier} conectada a ${credenciales.appleAppIdentifier.bundleIdentifier}.`);
