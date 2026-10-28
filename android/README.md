# FinTwin — app Android (versión independiente)

App de Google Play que abre `https://fintwin.windoce.com/home` en pantalla completa
(Trusted Web Activity con Bubblewrap). Toda la lógica vive en la web: publicar la
web (push a `main`) actualiza la app sin pasar por la tienda.

- Paquete: `com.windoce.ingresos` (el mismo de la ficha que ya está en Google Play).
- Versión preparada: **1.1.0 (código 2)**, que cambia de `windoce.com/app` a
  `fintwin.windoce.com`. Se sube como **actualización** de la misma ficha cuando
  Google apruebe la 1.0.0.
- Llave de subida: `~/.config/windoce-hub/fintwin-upload.jks` y su
  `fintwin-upload.properties` (fuera del repo; nunca se commitea).
- Huellas autorizadas: `public/.well-known/assetlinks.json` (las mismas de la 1.0.0).

## Compilar

```bash
cd /Users/windocellc/FinTwin/android && bash build.sh
```

Sube `appVersionCode` en `twa-manifest.json` antes de cada versión nueva. El
`.aab` queda en esta carpeta (ignorado por git) y una copia en
`~/Documents/Windoce-respaldos/fintwin-android/`.
