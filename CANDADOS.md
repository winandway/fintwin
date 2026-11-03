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
