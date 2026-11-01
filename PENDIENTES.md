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

- [ ] 👤 **Llave de Gemini** (variable `GEMINI_API_KEY` en el panel de YaDominios Cloud). Sin ella la
  lectura con IA está apagada y quien paga escribe el monto y el número a mano. No hay ninguna llave de
  Gemini válida guardada en la máquina.
- [ ] 👤 **Richard crea su propia cuenta en FinTwin** para comprobar que llegan los correos.
- [ ] Turnstile apagado (faltan las claves), guía pública en Docs.

## Cuenta del revisor (Apple y Google)

Correo y contraseña en `~/.config/windoce-hub/fintwin-reviewer`. Tiene la cuenta «Demo Store», PIN 1234,
un comprobante aprobado y uno pendiente. **No borrarla** ni grabar el video con ella.
