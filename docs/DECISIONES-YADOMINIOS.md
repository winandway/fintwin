# Lo que respondió la sesión de YaDominios Cloud (28 oct 2026)

## Pasos y quién los hace

| # | Quién | Qué |
|---|---|---|
| 1 | IA | Repositorio público `winandway/fintwin` con `main` y `yapanel-build` (con al menos un `index.html`). ✅ 28 oct 2026 |
| 2 | YaDominios | Crea el sitio `fintwin` en la cuenta torplanet1, plan Galaxia, conectado a la rama `yapanel-build`. Queda en https://fintwin.sitios.dev con `env.DB` y `env.BUCKET` |
| 3 | YaDominios | Crea la llave de Acceso para IA (lectura y escritura) y la deja en `~/.config/fintwin/yadominios-llave-ia` |
| 4 | Richard | Decide el dominio (sugerido: getfintwin.com; fintwin.com y fintwin.app están tomados). YaDominios lo registra, lo conecta y activa los correos (SPF y DKIM solos) |

**El dominio se decide ANTES de sacar la app nueva de Android:** la app queda
atada a la dirección que abre.

## Correo

- Galaxia: 300 correos al día por sitio. Hay «correos extra» en el panel.
- Sin dominio conectado, solo salen avisos al dueño de la cuenta: las
  confirmaciones y recuperaciones de los usuarios necesitan dominio.
- `POST https://yapanel.yadominios.com/api/hosting/correo/enviar` con
  `{ sitio, token, from: { address, name }, to: [{ address }], subject, text, html? }`.
  `reply_to` en texto plano. Remitente del dominio conectado (`no-reply@<dominio>`).
  Sin dominio activado responde 409 `dominio_sin_activar`.

## Respuestas técnicas

- `public/.well-known/assetlinks.json` se publica y se sirve como `application/json`.
  Si el `_worker.js` atiende todo, lo que no sea `/datos` va a `env.ASSETS.fetch(request)`.
- Usuarios y sesiones: no vienen hechos; se programan en el `_worker.js`.
- Gemini desde el `_worker.js`: sin restricciones de salida. Clave como secreto
  del panel (tarjeta del sitio → Variables de entorno).
- Aprobar en lote: `env.DB.batch([...])` (todo o nada) y cada sentencia
  `UPDATE ... WHERE id = ? AND estado = 'pendiente' RETURNING id`. La base
  atiende una consulta a la vez. `BEGIN`/`COMMIT` sueltos no se admiten.

## Trampas que hay que respetar

1. PIN y contraseña: **hash** PBKDF2 con sal, nunca cifrado.
2. PIN de 4 números: límite de intentos por persona y por cuenta, con bloqueo temporal.
3. Sin KV: los intentos van en una tabla de `env.DB` con su fecha; se borran al entrar bien.
4. Capturas privadas: nunca por dirección pública del almacén; las entrega el
   `_worker.js` solo a la empresa dueña y sus validadores, con sesión.
5. Antes de guardar una captura: tipo real (solo imágenes) y menos de 10 MB.
6. Página fija para borrar la cuenta, en inglés: `/delete-account`.
7. Rutas del servidor bajo `/datos`, nunca `/api/`.
