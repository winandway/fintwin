# Publicar FinTwin en el App Store (iPhone)

Receta de FinTwin, hecha el 31 de octubre de 2026 a partir de la de Tumbite. Escrita para que otra sesión,
sin memoria, pueda repetirla sola.

## Datos fijos

| Qué | Valor |
| --- | --- |
| Cuenta de Apple Developer | go@windoce.com, equipo `7KM9P6R682` (Windoce LLC) |
| App en App Store Connect | número `6829195734`, nombre «FinTwin: Receipts & Income» |
| Identificador (Bundle ID) | `com.windoce.fintwin` (id en el portal `QKW4N2UT94`, con notificaciones) |
| Proyecto de Expo | `@windoce-llc/fintwin`, id `3933d24c-8bf5-432c-93f9-5449f4623c6a` |
| Código de la app | carpeta `mobile/` (Expo SDK 58 con un WebView sobre fintwin.windoce.com) |

## Las llaves (nunca en el repositorio)

| Llave | Dónde vive |
| --- | --- |
| API de App Store Connect | `~/.config/fintwin/apple-asc/` (`AuthKey.p8`, `key-id`, `issuer-id`, `team-id`) |
| Avisos de Apple (APNs) | `~/.config/fintwin/apple-apns/` (`AuthKey_CFDY5FCDCF.p8`, `key-id`) |
| Token de Expo | `~/.config/fintwin/expo-token` |
| Cuenta del revisor | `~/.config/windoce-hub/fintwin-reviewer` |

Carpetas 700, archivos 600. Las dos llaves de Apple son de la cuenta y sirven para todas las apps.

## Lo único que necesita a Richard

La sesión de App Store Connect abierta en su Chrome, para los dos pasos sin API: **crear la app** y
**la privacidad de la app**. Nunca se escribe su contraseña.

## Los pasos, en orden

1. **Identificador**: `node scripts/tiendas/identificador-ios.mjs` (lo registra con notificaciones).
2. **Crear la app** en su Chrome (Apps → «+» → Nueva app). Ojo: los menús de esa pantalla no toman el valor
   con el relleno automático; se fijan por JavaScript con el «setter» nativo y los eventos `input` y `change`.
3. **Textos de permiso** en `mobile/app.json` → `ios.infoPlist`: cámara y fotos (la app sube comprobantes),
   y `ITSAppUsesNonExemptEncryption: false`. Se comprueba dentro de `mobile/` con
   `npx expo config --type introspect`: tienen que salir los dos `NS…UsageDescription`. Si falta uno,
   Apple rechaza la subida con el error 90683.
4. **Compilar con EAS**, dentro de `mobile/`:

   ```bash
   cd /Users/windocellc/FinTwin/mobile && EXPO_TOKEN=$(cat ~/.config/fintwin/expo-token) EXPO_ASC_API_KEY_PATH=~/.config/fintwin/apple-asc/AuthKey.p8 EXPO_ASC_KEY_ID=$(cat ~/.config/fintwin/apple-asc/key-id) EXPO_ASC_ISSUER_ID=$(cat ~/.config/fintwin/apple-asc/issuer-id) EXPO_APPLE_TEAM_ID=7KM9P6R682 EXPO_APPLE_TEAM_TYPE=COMPANY_OR_ORGANIZATION EXPO_NO_CAPABILITY_SYNC=1 npx eas-cli build --platform ios --profile production --non-interactive --wait
   ```

   - La **primera** vez pidió credenciales en modo interactivo y se respondió con `expect`. A la pregunta
     de los avisos hay que bajar con la flecha hasta «No, don't ask again» (escribir «n» elige «Sí» y luego
     pide la contraseña del Apple ID). Desde entonces `eas.json` lleva
     `"promptToConfigurePushNotifications": false` y corre sin preguntas.
   - El número de compilación lo sube Expo solo (`autoIncrement`, versión remota).
   - El plan de Expo avisó que va por el 80 % de las compilaciones del mes: no gastar compilaciones de prueba.
5. **Llave de avisos en Expo**: `node scripts/tiendas/llave-avisos-expo.mjs`. La conecta a las credenciales
   de la app por la API de Expo (reutiliza la de la cuenta si ya estaba subida). Sin esto, los avisos de
   «captura nueva» no llegan a los iPhone.
6. **Subir a Apple**: se agregan a `eas.json` → `submit.production.ios` las tres claves `ascApiKeyPath`,
   `ascApiKeyIssuerId` y `ascApiKeyId` SOLO durante el envío, se corre
   `npx eas-cli submit --platform ios --latest --profile production --non-interactive --wait`, y se
   restaura el archivo enseguida. No se commitea nunca con esas claves.
7. **Comprobar que Apple la aceptó**: Expo dice «subida» aunque Apple la rechace después. La verdad está en
   `GET /v1/apps/6829195734/buildUploads` (`COMPLETE` o `FAILED` con sus errores) y luego en
   `GET /v1/builds` (`processingState` tiene que llegar a `VALID`).
8. **Ficha**: `node scripts/tiendas/ficha-app-store.mjs` (inglés y español, categorías Negocios y
   Productividad, clasificación por edad, derechos de contenido, copyright y datos del revisor con la cuenta
   de prueba).
9. **Precio y países**: `node scripts/tiendas/precio-disponibilidad.mjs` (gratis, 175 países).
10. **Capturas**: `node scripts/tiendas/capturas-app-store.mjs` sube las de `docs/capturas-tiendas/ios/en` y
    `ios/es` (1320×2868, `APP_IPHONE_67`, siete por idioma). La app no admite tableta, así que no lleva iPad.
    Si se vuelven a subir las mismas imágenes, Apple las rechaza como repetidas.
11. **Privacidad de la app** en su Chrome (no hay API). Lo que FinTwin recoge de verdad, sacado del código:
    nombre, correo, otra información financiera (montos de comprobantes), fotos (las capturas) e ID de
    usuario. Los cinco con propósito «Funcionalidad de la app», **vinculados** a la identidad y **sin**
    seguimiento. Después «Publicar».
12. **Adjuntar y enviar a revisión**: `node scripts/tiendas/enviar-revision-ios.mjs`. Adjunta la compilación
    VALID más nueva a la versión en preparación y la envía. Queda en `WAITING_FOR_REVIEW`.

## El riesgo de la guía 4.2 (app que solo envuelve una web)

Apple rechaza las apps que son solo una página web metida en un marco. FinTwin lleva funciones nativas que
la web no tiene, y las notas para el revisor las explican: avisos al celular cuando entra una captura nueva
(tocar el aviso abre la cuenta), compartir el link de pago con la hoja nativa del iPhone, cámara y fotos para
los comprobantes, y una pantalla propia sin conexión con botón de reintentar. Si Apple la rechaza por 4.2,
la respuesta es reforzar esas funciones, no discutir.

## Diferencias con Google Play

- Apple revisa en uno a tres días y avisa a go@windoce.com.
- Apple no cancela la revisión si se sube otra compilación a TestFlight; Google sí.

## Estado

- 31 de octubre de 2026: versión 1.0 (compilación 3) enviada a revisión, en `WAITING_FOR_REVIEW`.
