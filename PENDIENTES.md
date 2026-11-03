# Pendientes de FinTwin

> Al día el 3 de noviembre de 2026. Se ejecuta en orden; lo marcado 👤 depende de Richard.

## Tiendas

- [x] **Apple (iPhone) — reenviada el 3 nov 2026** con el video de Richard (grabado en su iPhone: registro,
  código del correo, cuenta, captura leída, aprobar con PIN y borrar el usuario con DELETE). Video achicado a
  11 MB y adjuntado a la información para el revisor por API (`scripts/tiendas/adjuntar-video-revision.mjs`);
  entrega marcada resuelta y reenviada (`enviar-revision-ios.mjs` ya sabe reenviar una rechazada). Estado:
  WAITING_FOR_REVIEW. Apple responde a go@windoce.com en uno a tres días.
- [x] **Google Play — aprobada** (Richard lo confirmó el 3 nov 2026).
- [x] Menú de tres puntos del inicio completo (3 nov 2026): Actualizar, Nueva cuenta, Mi perfil, Ayuda, Docs y Cerrar sesión, también la primera vez. Candado C-MENUS-COMPLETOS-1.
- [x] **Llave de Gemini** (1 nov 2026): cargada como `GEMINI_API_KEY` en el sitio. Es la llave prepago del
  proyecto overbank (torplanet1@gmail.com); datos de recarga en `~/.config/fintwin/proveedores-ia.md`.
  Comprobada con una captura real de Wells Fargo: monto y confirmación leídos bien. La salud dice `lectura_ia: ok`.
- [x] Richard creó su propia cuenta, le llegó el correo con el código, subió una captura y borró la cuenta (3 nov 2026).
- [x] Entrada simple (1 nov 2026): el correo se confirma con un código de 6 números dentro de la app; el dueño
  agrega a quien sube o revisa con un código de acceso (sin correo); el link de pago pide solo el nombre. Guía en
  Docs «Agrega a tu equipo con un código de acceso». El guion del video de Apple quedó con este flujo.
- [x] Casos de ayuda en la app y puerta del gerente de correo (1 nov 2026). Guía pública en Docs.
- [x] **Igual al FinTwin original** (1 nov 2026): pantalla de la cuenta, repetidas con historial y «Aceptar igual»,
  puntos de colores, en espera, cancelar, bandeja «Por revisar», «Clientes que te pagan», exportar, comisión por
  día y por mes, link de pago con lectura al elegir la foto. Comparación completa en `docs/IGUAL-AL-ORIGINAL.md`.
- [ ] Turnstile apagado (faltan las claves), guía pública en Docs.

## Cuenta del revisor (Apple y Google)

Correo y contraseña en `~/.config/windoce-hub/fintwin-reviewer`. Tiene la cuenta «Demo Store», PIN 1234,
un comprobante aprobado y uno pendiente. **No borrarla** ni grabar el video con ella.
