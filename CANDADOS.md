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

Variables del sitio para soporte: `GERENTE_SECRETO` (copia en `~/.config/gerente-correo/soporte-fintwin`) y
`ARCHIVOS_FIRMA` (copia en `~/.config/fintwin/archivos-firma`). El canario `/datos/salud` dice `soporte: ok` cuando están las dos.

Antes de un rollback o una actualización grande de paquetes: `npm run verify` en verde.
