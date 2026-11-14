# Candados de FinTwin

Lo que ya funciona y no puede romperse sin que salte una alarma. Cada candado
tiene su prueba, comprobada en rojo (se metió el fallo a propósito y la prueba falló).

| Candado | Qué protege | Prueba | Qué NO tocar |
|---|---|---|---|
| C-REPETIDOS-1 | El mismo número de confirmación o la misma imagen no entran dos veces, en ninguna cuenta, mientras el primero no esté rechazado | `test/worker/cuentas.test.ts` → «el mismo número…», «la misma imagen…» | Los índices únicos parciales de `schema.sql` y la consulta previa en `pagar.ts` |
| C-PIN-1 | Revisar, anotar salidas, invitar y cambiar ajustes exigen el PIN personal; 5 fallos bloquean 15 min | «cinco PIN malos…», «con PIN ajeno…» | `verificarPin` en `cuentas.ts` |
| C-LOTE-1 | Dos validadores no aprueban el mismo comprobante: cada UPDATE solo toma lo que sigue pendiente | «aprueba en lote…» (segunda pasada da `ya_revisados`) | `WHERE estado = 'pendiente' RETURNING id` |
| C-CAPTURA-PRIVADA-1 | La imagen solo la ven quien la subió y el equipo; nunca por dirección pública | «la imagen solo la ven…» | `verArchivo` en `pagar.ts` |
| C-BORRADOR-1 | Todo formulario guarda lo escrito y no guarda contraseñas ni PIN | `test/app/pantallas.test.tsx` → «borrador…» | `useBorrador` y su lista de sensibles |
| C-CORREO-1 | Si un correo no sale, queda escrito en la tabla `errores` | «si el correo no sale…» | `mandar()` en `auth.ts` |
| C-PANTALLAS-1 | Toda dirección de pantalla (/login, /home, /pay/…) abre la app. Antes se pedía /index.html y los estáticos devolvían un desvío 307 a la portada (28 oct 2026) | «las rutas de la app devuelven la página…» (el simulador desvía /index.html igual que el sitio) | Pedir «/» en el respaldo de `index.ts` |
| C-FACTURA-1 | Toda salida lleva factura y todo gasto de la comisión lleva ticket; el mismo archivo no entra dos veces; un gasto no pasa de la comisión disponible (28 oct 2026) | `test/worker/cuentas.test.ts` → «salidas…», «gastos de la comisión…» (comprobado en rojo) | `leerImagen` en `archivos.ts` y el tope en `gastos.ts` |
| C-CASOS-AYUDA-1 | Casos de ayuda en la app (1 nov 2026): la persona escribe con hasta 3 capturas (jpg, png, webp, heic, 10 MB) y ve las respuestas como chat; nadie más ve su caso; al borrar el usuario se borran sus casos y capturas | `test/worker/casos.test.ts` → «casos de ayuda de la persona» | `casos.ts` (`tipoAdjunto`, `casoPropio`, `borrarCasosDe`) |
| C-GERENTE-1 | La puerta del gerente de correo (`/datos/gerente/tickets` y `/responder`): sin `GERENTE_SECRETO` no existe, comparación en tiempo constante, 30 por minuto por IP, no entrega correo ni datos de pago; responder avisa al celular y manda el correo y dice si alguno falló. Comprobado en rojo quitando la comparación | `test/worker/casos.test.ts` → «puerta del gerente de correo» | `exigirGerente` en `casos.ts`; la excepción de la cabecera `x-fintwin` para `/datos/gerente/` en `index.ts` |
| C-ADJUNTO-FIRMADO-1 | Las capturas de los casos solo se ven con enlace firmado con `ARCHIVOS_FIRMA` que vale 8 días; firma tocada o vencida da 403. Comprobado en rojo | «el enlace de la captura no sirve…» | `verAdjunto` y `urlAdjunto` en `casos.ts` |
| C-ACCESO-CODIGO-1 | Entrar sin correo (1 nov 2026): el dueño agrega a quien sube o revisa y le da un código de 8 letras; sirve una sola vez (el UPDATE lo gasta y la membresía solo entra si el código quedó gastado por esa persona), vence en 7 días, 10 malos por IP bloquean 15 min; «otro código» lleva a la misma persona; quitar el acceso la saca. Quien entra así no crea negocios. Comprobado en rojo quitando el gasto del código | `test/worker/accesos.test.ts` → «acceso por código» | `entrarConCodigo` en `accesos.ts` |
| C-CONFIRMAR-CODIGO-1 | Confirmar el correo con un código de 6 números escrito en la app (nadie sale al navegador). 5 malos bloquean 15 min; reenviar anula el anterior. Abrir otra vez el enlace ya usado dice «ya está confirmado» (antes decía «venció o ya se usó» y Richard creyó que estaba roto) | «confirmar el correo con código…» y `auth.test.ts` | `crearConfirmacion`, `confirmarCodigo` y el 409 `ya_confirmado` en `auth.ts` |
| C-LINK-SIN-CUENTA-1 | El link de pago pide solo el nombre: crea una persona sin correo con sesión de un año | «el link de pago sin cuenta…» | `invitadoDelLink` en `accesos.ts` |
| C-REPETIDAS-1 | Igual al FinTwin original (1 nov 2026): una captura repetida (misma imagen o mismo número de confirmación, sin contar rechazadas) en la MISMA cuenta no entra nunca, ni con PIN; si el uso anterior es de OTRA cuenta, solo entra con «Aceptar igual» + PIN. El aviso mira primero la cuenta actual (antes ofrecía «Aceptar igual» cuando el uso más reciente era de otra cuenta). En el link de pago, repetida en cualquier cuenta no entra y se avisa al elegir la foto. De otras empresas no se muestra ni nombre ni monto. Comprobado en rojo dos veces | `test/worker/movimientos.test.ts` → «una captura repetida en la MISMA cuenta…» y «repetida de otra cuenta…» | `buscarRepetida` e `historialDeUso` en `capturas.ts`; `leerEnCuenta` y `registrarEnCuenta` en `movimientos.ts`. NO volver a poner índice único en `confirmacion_norm` ni en `archivo_hash`: rompe «Aceptar igual» |
| C-PUNTOS-1 | Puntos de color de cada movimiento como el original: aprobado verde; con la captura usada 1–2 veces más, amarillo; 3 o más, naranja; pendiente naranja con reloj; en espera rojo con triángulo; rechazado rojo con X. `repetidas` cuenta en todas las cuentas | «repetida de otra cuenta…» (`repetidas` = 1) | `PuntoEstado` en `components/Comprobantes.tsx`; la subconsulta `repetidas` en `movimientos.ts` |
| C-LECTURA-UNA-VEZ-1 | La captura se lee con IA al elegirla y la lectura queda guardada por la huella de la imagen: al enviar no se paga otra lectura. La imagen liviana se sube ORIGINAL para que la misma captura tenga la misma huella en cualquier teléfono | «con IA: lee la captura…» (`llamadasIA` no cambia) | `lecturaDe` en `capturas.ts`; `imagenParaSubir` en `lib/imagen.ts` |
| C-EN-ESPERA-1 | «En espera»: un aprobado vuelve a pendiente con `en_espera = 1`, sale del total, aparece en «Por revisar» y vuelve con «Ya llegó — confirmar» y el PIN; no se puede cancelar | «en espera sale del total…» | `ponerEnEspera` en `movimientos.ts`; `revisar` pone `en_espera = 0` |
| C-BORRAR-LEJOS-1 | Borrar el usuario NUNCA va pegado a «Cerrar sesión» (Richard, 2 nov 2026: «alguien puede borrar su cuenta por error»). El menú del nombre tiene Mi perfil, Ayuda y Cerrar sesión; borrar vive en «Mi perfil» dentro de los tres puntos y pide escribir BORRAR (DELETE en inglés); el servidor tampoco borra sin esa palabra, ni a quien no tiene contraseña. Comprobado en rojo los dos | `test/app/borrar.test.tsx` y `auth.test.ts` → «borrar mi usuario…» | `MenuCuenta` en `Layout.tsx`, `pages/Perfil.tsx`, `DeleteAccount` en `Publicas.tsx`, `borrarUsuario` en `auth.ts` |

Variables del sitio para soporte: `GERENTE_SECRETO` (copia en `~/.config/gerente-correo/soporte-fintwin`) y
`ARCHIVOS_FIRMA` (copia en `~/.config/fintwin/archivos-firma`). El canario `/datos/salud` dice `soporte: ok` cuando están las dos.

Antes de un rollback o una actualización grande de paquetes: `npm run verify` en verde.

## C-MENUS-COMPLETOS-1 — el menú de tres puntos del inicio lleva todo (3 nov 2026)

- **Qué pasaba:** Richard grabó el video de Apple y vio que el menú de tres puntos del inicio solo tenía «Actualizar
  totales» y «Cerrar sesión», y en la primera pantalla (sin cuentas) no había menú. Comparado con la web, «le faltaban
  botones».
- **Qué se hizo:** el menú del inicio es uno solo (`menu` en `src/app/pages/Home.tsx`) y sale con y sin cuentas:
  Actualizar totales, Nueva cuenta (no a quien entró con código), Mi perfil, Ayuda y soporte, Docs y, separado por una
  línea, Cerrar sesión. El menú del nombre suma Docs. El menú ≡ de la cuenta suma «Gastos de la comisión» (dueño).
  `MenuPuntos` acepta `separado` para la línea.
- **No tocar:** borrar el usuario sigue FUERA de estos menús (C-BORRAR-LEJOS-1).
- **Cómo se comprueba:** `test/app/menus.test.tsx` (se puso en rojo quitando «Mi perfil»).

## C-TURNSTILE-1 — escudo anti-robots en entrar, registrarse y recuperar la clave (8 nov 2026)

- **Qué faltaba:** el código del escudo existía, pero estaba apagado porque no había claves.
- **Qué se hizo:** widget `fintwin-turnstile` (modo administrado, hosts fintwin.windoce.com y fintwin.sitios.dev)
  creado en la cuenta de Cloudflare de Windoce con el token que tiene permiso Turnstile
  (`~/.config/nube-privada/cloudflare-turnstile-token`). Claves en `~/.config/fintwin/turnstile-sitio` y
  `turnstile-secreta` (600, nunca al repo), cargadas en el sitio como `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`
  (secreto) con la llave de IA. El servidor comprueba el pase ANTES de mirar la contraseña (`verificarTurnstile` en
  `auth.ts`); sin claves se apaga; si Cloudflare no responde, deja pasar y lo deja en el log.
- **Canario:** `/datos/salud` → `turnstile: ok` y `variables: ok` (zod en `env-check.ts`; una sola clave cargada da
  `error` y nombra la variable, nunca el valor).
- **Cómo se comprueba:** `test/worker/turnstile.test.ts` (rojo comprobado quitando la verificación) y
  `e2e/vivo.spec.ts` en el Action, que abre /login y /signup en vivo y exige el recuadro de Cloudflare.
- **No tocar:** el CSP de `withSecurityHeaders` permite `challenges.cloudflare.com` en script y frame: si se quita,
  el recuadro desaparece y nadie puede entrar. Guía pública: /docs/sign-in-security-check.

## C-BLINDAJE-1 — las 6 capas de la regla global, revisadas el 8 nov 2026

| Capa | Estado | Dónde |
|---|---|---|
| 1. Tipos y estilo | ✅ TypeScript estricto (strict, noUncheckedIndexedAccess, noImplicitOverride), ESLint con plugin de seguridad, Prettier | `tsconfig*.json`, `eslint.config.js` |
| 2. Pruebas | ✅ Vitest + Testing Library; **msw** en las pruebas de pantallas con `onUnhandledFrame: 'error'` (agregado hoy); el servidor simula toda la red y falla ante una llamada no simulada; **Playwright** de punta a punta en vivo (agregado hoy); umbrales de cobertura fijados en el piso actual (88 % de líneas) y **90 %** en auth, crypto, accesos, movimientos, pagar, capturas y borradores | `test/`, `e2e/`, `vitest.config.ts` |
| 3. Dependencias y secretos | ✅ `npm audit` alto en verify; gitleaks en pre-commit, en CI y ahora también en `npm run verify` (si está instalado); Dependabot semanal; `.env*` ignorado con `.env.example` | `package.json`, `.github/` |
| 4. Seguridad en el aire | ✅ zod en todas las entradas; variables del sitio revisadas con zod en el canario (hoy); cabeceras CSP, HSTS, nosniff, X-Frame, Referrer y Permissions; límite de intentos; Turnstile encendido | `env-check.ts`, `http.ts`, `limites.ts` |
| 5. Compuertas | ✅ husky pre-commit (gitleaks + lint + pruebas) y pre-push (`npm run verify`); el Action corre lo mismo | `.husky/`, `.github/workflows/publicar.yml` |
| 6. Producción | ✅ humo en vivo tras publicar (salud con versión, rutas en 200) + Playwright en vivo | Action, trabajo «humo» |

Deuda anotada, sin tocar para no romper: el formateo automático de lo tocado (lint-staged + Prettier) no se enciende porque
el código viejo no está formateado con Prettier y reformatearlo entero está prohibido; sesión (`sesion.tsx`, 56 %),
cuentas (85 %) y gastos (89 %) todavía no llegan al 90 % y quedan en su piso. FinTwin no tiene sitio de pruebas aparte
(staging): publica directo, con verify + humo + Playwright como compuerta.

## C-BORRADOR-DUENO-1 — el borrador no se pisa cuando la sesión carga tarde (8 nov 2026)

- **Qué pasaba:** `useBorrador` arma la llave con el id del usuario. Si el formulario se abría antes de que cargara la
  sesión (llave «anonimo») y luego llegaba el usuario, se guardaba vacío encima de su borrador y se perdía.
- **Qué se hizo:** al cambiar de dueño se trae el borrador del dueño nuevo, y lo ya escrito en pantalla manda.
  También guardan borrador ahora la nota de «En espera» de un movimiento y el motivo de rechazo en la revisión por lote
  (el PIN nunca). El aviso «Recuperamos lo que estabas escribiendo» va fuera de la etiqueta del campo.
- **Cómo se comprueba:** `test/app/borradores-dialogos.test.tsx` (rojo comprobado quitando el arreglo) y
  `test/app/blindaje.test.tsx` (ningún campo de contraseña fuera de `CampoClave`, rojo comprobado).
- Formularios SIN borrador a propósito: códigos de un solo uso, PIN, contraseña nueva y la palabra BORRAR.

## C-GOOGLE-PLAY-1 — botón oficial de Google Play en la portada y el pie (8 nov 2026)

- **Qué es:** FinTwin ya es pública en Google Play (paquete `com.windoce.ingresos`). La web muestra el distintivo
  oficial «Get it on Google Play» / «Disponible en Google Play» en la portada (debajo de los botones de entrar) y
  en el pie de todas las páginas, con la línea legal de marca de Google LLC.
- **Cómo se hizo:** componente `src/app/components/GooglePlay.tsx`. Las imágenes son las oficiales de Google
  (`play.google.com/intl/en_us/badges/static/images/badges/{en,es}_badge_web_generic.png`), solo recortadas al
  borde negro, sin recolorear ni deformar: `public/google-play-en.png` y `public/google-play-es.png`. El enlace
  lleva `&hl=en|es` según el idioma. Dentro de la app del celular (`esApp()`) no se muestra, ni la línea legal.
- **Cómo se comprueba:** `test/app/google-play.test.tsx` (rojo comprobado cambiando el paquete) y la prueba en
  vivo de `e2e/vivo.spec.ts`.
- **Qué NO tocar:** no cambiar el diseño del distintivo ni bajarlo de 40 px de alto (normas de marca de Google).
- **También en el HTML del servidor (8 nov 2026):** la web se pinta en el navegador, así que el HTML que bajaban
  Google y quien entra sin JavaScript no traía el enlace. Ahora `index.html` lleva dentro de `#root` una portada
  mínima con los dos distintivos y el enlace a la ficha; React la reemplaza al cargar. Prueba: `index.html` debe
  contener la ficha (vitest) y el HTML en vivo de `/` también (e2e).

## C-HISTORIAL-PAGADOR-1 — quien paga ve sus capturas y su estado (10 nov 2026)

- **Qué es:** en el link de pago (`/pay/:slug`), debajo del formulario y en la pantalla de «Captura enviada»,
  sale «Tus capturas enviadas aquí»: en proceso (barra gris que se mueve), procesado (verde, tipo de pago e ID del
  pago = número de confirmación) o no aprobado (rojo, con el motivo). Se vuelve a mirar cada 30 s mientras haya
  alguna en proceso (solo lectura; no escribe nada en la base).
- **Cómo se hizo:** `GET /datos/mis-pagos` devuelve además `link_slug`, `plataforma`, `revisado_en` y `motivo`
  (el motivo SOLO si está rechazado). Componente `src/app/components/HistorialPagos.tsx`, filtra por el slug.
  Animación `enproceso` en `src/app/index.css`.
- **Cómo se comprueba:** `test/worker/clave-unica.test.ts` (bloque «historial de quien paga», rojo comprobado
  quitando `link_slug`) y `test/app/historial-pagos.test.tsx`.
- **Qué NO tocar:** lo aprobado va en verde y lo rechazado en rojo (regla global). No mostrar notas internas del
  equipo a quien paga: solo el motivo de rechazo.

## C-CLAVE-UNICA-1 — una sola clave para validar (10 nov 2026)

- **Por qué:** quien crea la cuenta en FinTwin muchas veces no es el dueño de la cuenta del banco (p. ej. el
  negocio en Venezuela y la cuenta que recibe en EE. UU.). Con el PIN de cada uno, el creador podía aprobar
  capturas sin que el dueño del banco viera si el dinero llegó.
- **Cómo funciona:** columnas `cuentas.clave_validar_hash/por/en`. `POST /datos/cuentas/:id/clave-unica`:
  crear (si no existe) con el PIN personal, o cambiar (solo `clave_validar_por`, con la clave actual). La creación
  es condicional (`WHERE clave_validar_hash IS NULL`): si dos la crean a la vez, gana la primera.
  `verificarClaveValidar` (en `cuentas.ts`) se usa en revisar (aprobar/rechazar), poner en espera y «Aceptar
  igual» una repetida: con clave única activa, el PIN personal NO sirve. Límite: 5 fallos / 15 min.
  El dueño no puede quitar a quien la tiene (`tiene_la_clave_unica`, en equipo y en accesos). Si esa persona
  sale sola, la clave se borra y se vuelve al PIN de cada uno. La pantalla usa `useEtiquetaValidar` para pedir
  «la clave única» en vez de «tu PIN». `verCuenta` devuelve `clave_unica` sin la clave.
- **Cómo se comprueba:** `test/worker/clave-unica.test.ts` (rojo comprobado haciendo que valide con el PIN
  personal). Guía pública `/docs/validation-key`.
- **Qué NO tocar:** nunca devolver el hash ni permitir a otra persona cambiarla o borrarla. Si se pierde, se
  atiende por soporte.

## C-TIPO-PAGO-1 — selector de tipo de pago en el link (13 nov 2026)

- **Qué es:** en el link de pago, debajo del monto, «Tipo de pago (opcional)»: Zelle, bolívares, dólares,
  transferencia, PayPal, tarjeta u «Otro» con el nombre escrito (máx. 40 letras). Lo ve el equipo en la revisión
  y en el detalle del movimiento, y quien pagó en su historial.
- **Cómo se hizo:** lista y regla `TIPOS_PAGO` / `tipoPagoAGuardar` en `src/shared/reglas.ts` (la misma para las
  pantallas y el servidor). Columna `comprobantes.tipo_pago` (clave, u `otro:<texto>`). `subirCaptura` responde
  422 `tipo_pago_otro` si eligió «Otro» sin escribir. Se muestra con `tipoPagoBonito` (`Comprobantes.tsx`).
  Va en el borrador del formulario (no se pierde al cerrar).
- **Cómo se comprueba:** `test/worker/tipo-pago.test.ts` (rojo comprobado guardando null) y
  `test/app/tipo-pago.test.tsx` (rojo comprobado sin mandar el campo). Guía pública `/docs/payment-type`.
- **Qué NO tocar:** es opcional; no volverlo obligatorio sin que Richard lo pida.

## C-CAMARA-1 — «Tomar foto» en toda casilla de imagen (13 nov 2026, regla global del 9 nov)

- **Qué es:** cada casilla de imagen tiene «Subir desde archivos» y «Tomar foto». Celular y app: cámara trasera
  del sistema (`<input capture="environment">`). Computadora: cámara web en una ventanita con «Capturar».
  Sin cámara o sin permiso, lo dice en palabras y se sigue pudiendo subir desde archivos.
- **Cómo se hizo:** UNA pieza: `src/app/lib/camara.ts` + `src/app/components/BotonCamara.tsx`
  (`BotonCamara` y `SubirOFoto`). La foto entra por la MISMA función `elegir` de cada casilla (misma validación y
  compresión). Casillas: link de pago, registrar en la cuenta, ticket de salidas y gastos de comisión, adjuntos
  de Ayuda.
- **Cómo se comprueba:** `test/app/camara.test.tsx`: recorre todos los `.tsx` de `src/app` y se pone en ROJO si
  una casilla `type="file" accept="image…"` no tiene su `<SubirOFoto>`/`<BotonCamara>` (comprobado quitándola
  de Ayuda). Guía pública `/docs/take-photo`.
- **Qué NO tocar:** toda casilla de imagen nueva lleva `SubirOFoto`. La cámara se abre una sola vez por ventana
  (las funciones del padre van por ref; si no, se reinicia con cada pintada).
