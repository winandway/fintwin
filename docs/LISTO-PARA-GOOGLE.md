# FinTwin — versión 1.1.0 enviada a Google Play

**Estado (29 oct 2026): la 1.1.0 ENVIADA A REVISIÓN.** Richard pidió no esperar la aprobación de la 1.0.0. Al enviar, Google reinició la revisión que estaba en curso desde el 28 oct, y ahora revisa directamente la 1.1.0 junto con las instrucciones nuevas del revisor y la URL nueva para borrar la cuenta (https://fintwin.windoce.com/delete-account). Las notas de la versión van en en-US, es-419 y es-US.

Preparado el 28 oct 2026. La 1.0.0 que está en revisión abre `windoce.com/app`.
La **1.1.0** ya está construida y firmada, y abre **https://fintwin.windoce.com**.
Se sube como actualización de la misma ficha (paquete `com.windoce.ingresos`).

## Lo que ya está listo

- ✅ FinTwin independiente en vivo en https://fintwin.windoce.com (base, archivos y correo propios).
- ✅ Todas las reglas nuevas de Windoce Hub llevadas a FinTwin:
  - toda salida exige factura;
  - los gastos de la comisión llevan su ticket, leído por IA, con la contabilidad por categoría;
  - aviso cuando una salida deja el total en contra, y el total en rojo;
  - la guía de la captura con el número de confirmación;
  - el freno de repetidos.
- ✅ `assetlinks.json` publicado en fintwin.windoce.com con las mismas huellas de la 1.0.0.
- ✅ Archivo para subir: `FinTwin-1.1.0.aab` (código de versión 2), en
  `Documentos/Windoce-respaldos/fintwin-android/`.

## Pasos el día que Google apruebe

1. ✅ **Usuario del revisor en la app nueva (hecho el 28 oct 2026):** el mismo correo
   (go+fintwin@windoce.com) y la misma contraseña de la 1.0.0, ya confirmado. Es
   el mismo usuario, copiado a la base de FinTwin. La contraseña está en
   `~/.config/windoce-hub/fintwin-reviewer`. Solo hay que cambiar las instrucciones
   del revisor en Play Console (Contenido de la app → Acceso a la app) por:
   `Open the app and tap "Sign in". Use the test email and password below. Tap "New account", give it a name and a 4-digit PIN of your choice. Inside the account you will see its receipts, totals and the menu (⋮) with Payment link and QR, Team, Record outflow and Commission expenses. Share the payment link to upload a sample receipt, then approve it with the PIN.`
2. **Play Console → Producción → Crear versión →** subir `FinTwin-1.1.0.aab`.
3. **Notas de la versión** (copiar tal cual):
   - en-US: `New home for FinTwin: faster, with receipts required on every outflow and commission expenses read by AI.`
   - es-419: `FinTwin estrena casa: más rápida, con factura obligatoria en cada salida y gastos de la comisión leídos por IA.`
4. **Ficha y contenido de la app:** cambiar «Borrar cuenta» a
   `https://fintwin.windoce.com/delete-account`. La política de privacidad sigue en
   `https://windoce.com/privacy/`.
5. **Revisar** que la app abra sin barra de dirección arriba. Si aparece, falta una
   huella en `public/.well-known/assetlinks.json` de FinTwin.

## Lo que hay que saber

- Las cuentas que alguien haya creado dentro de la 1.0.0 (en windoce.com) **no pasan
  solas** a la app nueva: son dos sistemas distintos. Los clientes de siempre
  (Bley, Frygood) siguen en sus links de windoce.com, sin cambios.
- La lectura con IA en FinTwin necesita la clave `GEMINI_API_KEY` en el sitio. Sin
  ella, todo funciona: la persona escribe el monto y el número a mano.
