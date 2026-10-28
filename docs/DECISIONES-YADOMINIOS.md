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

## Segunda respuesta (28 oct 2026): sitio creado

- ✅ Sitio `fintwin` activo en https://fintwin.sitios.dev (plan Galaxia, base y almacén). Comprobado con `estado_del_sitio`.
- ✅ Llave de IA en `~/.config/fintwin/yadominios-llave-ia` y token del sitio en
  `~/.config/fintwin/yadominios-token-sitio` (los dos 600, nunca al repo).
- Llave: `POST https://yapanel.yadominios.com/api/sitio/v1/<herramienta>` con
  `Authorization: Bearer <llave>`. También MCP en `/api/sitio/mcp`.
  Herramientas: `estado_del_sitio`, `leer_registro`, `consultar_base`, `leer_correos`,
  `guardar_variable {clave, valor, secreto}`, `listar_variables`, `subir_archivo` (10 MB).
- Las variables se aplican al **republicar**.
- Dominios libres: getfintwin.com (14 USD/año, recomendado), usefintwin.com (14), fintwin.io (68).
  Sin dominio, el correo a usuarios responde `from_ajeno` o `dominio_sin_activar`: no es un fallo del código.
- `schema.sql` va en la **raíz de yapanel-build** (el Action lo copia). Se ejecuta entero
  cuando cambia su huella: todo `IF NOT EXISTS`, `ALTER TABLE ADD COLUMN` al final,
  nunca `DROP` ni `DELETE`. Correcciones de datos únicas, por `consultar_base`.
- Las excepciones del `_worker.js` no llegan al registro: guardarlas en una tabla propia.
- Límites: `_worker.js` 10 MB comprimido / 64 MB sin comprimir; estáticos 25 MB por archivo;
  20 GB entre base y almacén; 300 correos al día. En yapanel-build solo lo compilado.
- Turnstile solo sirve en web o WebView (la app es TWA, así que sí sirve). Widget en la
  cuenta de Cloudflare de Windoce, con hosts fintwin.sitios.dev y el dominio final.

## Tercera respuesta (28 oct 2026): sin comprar dominio

- Richard decidió NO comprar dominio. Se usa **fintwin.windoce.com** (subdominio de la empresa).
- YaDominios lo conectó (zona en la misma cuenta de Cloudflare): registro A `fintwin` → 192.0.2.1
  con proxy. ✅ https://fintwin.windoce.com responde 200.
- Correo activado bajo el subdominio (SPF, DKIM y MX de rebotes en `cf-bounce.fintwin`,
  DMARC `p=reject`). No toca el Google Workspace de windoce.com. Prueba enviada y entregada.
- ✅ `MAIL_FROM = no-reply@fintwin.windoce.com` cargada con la llave y sitio republicado.
- Dirección oficial en assetlinks.json, enlaces de correos y la app: fintwin.windoce.com.
  fintwin.sitios.dev sigue respondiendo; si se quiere, 301 por cabecera Host en el `_worker.js`.
