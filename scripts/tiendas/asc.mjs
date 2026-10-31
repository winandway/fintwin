// Conexión a la API de App Store Connect con la llave de la cuenta de Windoce LLC, guardada en
// ~/.config/fintwin/apple-asc (nunca en el repositorio). La usan los demás guiones de esta carpeta.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

const D = join(os.homedir(), '.config', 'fintwin', 'apple-asc');
const leer = (f) => fs.readFileSync(join(D, f), 'utf8').trim();
const b64 = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
export function token() {
  const n = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'ES256', kid: leer('key-id'), typ: 'JWT' });
  const p = b64({ iss: leer('issuer-id'), iat: n, exp: n + 900, aud: 'appstoreconnect-v1' });
  const s = crypto
    .sign('sha256', Buffer.from(`${h}.${p}`), {
      key: fs.readFileSync(join(D, 'AuthKey.p8')),
      dsaEncoding: 'ieee-p1363',
    })
    .toString('base64url');
  return `${h}.${p}.${s}`;
}
export async function asc(metodo, ruta, cuerpo) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${ruta}`, {
    method: metodo,
    headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  const j = texto ? JSON.parse(texto) : null;
  if (r.status >= 400)
    throw new Error(`${metodo} ${ruta} → ${r.status} ${JSON.stringify(j?.errors?.[0] ?? j)}`);
  return j;
}
