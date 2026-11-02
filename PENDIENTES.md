# Pendientes de FinTwin

> Al día el 1 de noviembre de 2026. Se ejecuta en orden; lo marcado 👤 depende de Richard.

## Tiendas

- [ ] 👤 **Apple (iPhone) — video para la revisión.** Apple rechazó la versión 1.0 por la guía 2.1
  («falta información»): pide un video grabado en un iPhone físico. Las notas con todo lo demás ya están
  cargadas. Guion: `docs/videos/revision-apple/GUION-VIDEO-APPLE.md`. Richard graba y pasa el video por
  AirDrop a la Mac (queda en Descargas).
- [ ] **Apple — reenviar.** Con el video: App Store Connect (Chrome de Richard) → Revisión de apps → la
  entrega rechazada → «Responder al equipo de revisión de apps», adjuntar el video y decir que las notas
  traen lo demás. Después `node scripts/tiendas/enviar-revision-ios.mjs` (no hace falta compilación
  nueva: la 3 ya está VALID). Receta completa: `docs/PUBLICAR-EN-APPLE.md`.
- [ ] **Google Play — versión 1.1.0** en revisión desde el 29 de octubre. Sale sola al aprobarse. Detalle:
  `docs/LISTO-PARA-GOOGLE.md`.

## Producto

- [x] **Llave de Gemini** (1 nov 2026): cargada como `GEMINI_API_KEY` en el sitio. Es la llave prepago del
  proyecto overbank (torplanet1@gmail.com); datos de recarga en `~/.config/fintwin/proveedores-ia.md`.
  Comprobada con una captura real de Wells Fargo: monto y confirmación leídos bien. La salud dice `lectura_ia: ok`.
- [ ] 👤 **Richard crea su propia cuenta en FinTwin** para comprobar que llegan los correos.
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
