# FinTwin igual al original

> 1 de noviembre de 2026. Richard pidió que la app nueva funcione igual que el FinTwin que hicimos dentro de
> Windoce Hub: las mismas funciones, las mismas pantallas. Se leyó el código fuente del original completo
> (solo lectura, sin tocar nada de Windoce Hub) y se copió aquí lo que faltaba.

Fuente del original: carpeta `~/windoce-hub`. La pantalla de la cuenta está en `src/pages/IncomeViewPage.tsx`.
La app está en `src/components/fintwin/` y `src/pages/ReviewInboxPage.tsx` / `PayersPage.tsx`. El link de pago
está en `src/pages/PayerUploadPage.tsx` y la lectura con IA en `supabase/functions/analyze-receipt/`.

## Lo que se copió

| Del original | Dónde quedó en la app nueva |
|---|---|
| Lectura con IA: la misma instrucción, palabra por palabra; Gemini 2.5 Flash, temperatura 0, sin razonamiento, filtros apagados; llave de respaldo con 429/403 y un reintento a los 500 ms; el primer objeto JSON completo | `src/worker/ocr.ts` |
| Lee monto, número, quién envía y su correo, quién recibe y su correo, dirección, fecha, plataforma y confianza; estado success / partial / failed | `ocr.ts` → `interpretar` |
| La IA lee al ELEGIR la foto, no al enviar; el monto sale siempre de la captura actual | `/datos/cuentas/:id/leer-captura`, `/datos/pagar/:slug/leer` |
| Panel de lectura verde, amarillo o celeste tranquilizador con sus tres pasos | `components/Comprobantes.tsx` → `PanelLectura` |
| Repetidas por imagen y por número en TODAS las cuentas, sin contar rechazadas | `worker/capturas.ts` → `buscarRepetida` |
| Panel rojo «Captura duplicada» con «Historial de uso», «Cancelar» y «Aceptar igual» + PIN | `AvisoDuplicada`, `RegistrarComprobante` |
| En la misma cuenta nunca entra dos veces | `registrarEnCuenta` (409 `repetida_misma_cuenta`) |
| Puntos de color: verde, amarillo (1–2 repetidas), naranja (3+), naranja con reloj, rojo | `PuntoEstado` |
| «Captura repetida (N usos en total)» dentro de cada movimiento, con «← este» | `HistorialRepetida` |
| Confirmación «ENTRADA de dinero / Esto NO es una salida» antes de registrar | `RegistrarComprobante` |
| Estado «En espera» (en revisión del banco): sale del total, se libera con «Ya llegó — confirmar» + PIN | `ponerEnEspera` |
| Cancelar un pendiente: queda rechazado con su motivo y suma en «Cancelados» | `cancelar` |
| Pantalla de la cuenta: total histórico con «hace X», selector de mes y «Control general», insignias MES EN CURSO / MES ANTERIOR / TODO EL HISTÓRICO, cifras Bruto, Comisión (lo que queda), Este mes, Salidas, Cancelados | `pages/Account.tsx` |
| Movimientos con buscador (monto, código, nombres, correos, plataforma, notas y palabras «pendiente», «aprobado», «retiro», «espera»…), un solo movimiento abierto a la vez, código en grande «Tocar para copiar», datos detectados, imagen ampliable dentro de la app | `FilaMovimiento` |
| Exportar movimientos (todo el histórico) | menú de la cuenta → «Exportar movimientos» |
| Bandeja «Por revisar»: miniatura, «Sin número de confirmación», «Por link de pago», «En espera», «La captura dice $X», seleccionar todos con su total, aprobar o rechazar en lote con PIN y motivo opcional | `pages/Revisar.tsx` → `Review` |
| «Clientes que te pagan» con buscador, total aprobado, por revisar y rechazados | `pages/Revisar.tsx` → `Clients` |
| Inicio: «Total registrado en tus cuentas», aviso ámbar de pendientes, cada cuenta con «N por revisar» o «Al día» y su menú (Por revisar, Link de pago, Clientes, Abrir cuenta), «A quién le pago» con «Pagar», «Mis pagos enviados», menú con Actualizar y Cerrar sesión (borrar el usuario va aparte, en «Mi perfil», dentro de los tres puntos y escribiendo BORRAR) | `pages/Home.tsx` |
| Link de pago: QR, copiar, WhatsApp con el texto listo, «Exigir número de confirmación», cambiar el link | `pages/Equipo.tsx` → `PayLink` |
| Pantalla de quien paga: «Le estás pagando a», guía de la captura, «1. Sube la captura del pago», lo leído, recuadro rojo si falta el número, «2. Revisa el monto», nota, «Confirmo que este pago es para…», pie «FinTwin no mueve dinero» | `pages/Publicas.tsx` → `Pay` |
| Comisión: hoy, ayer, este mes, por día, por mes con lo que queda, por categoría | `pages/Comision.tsx` |

## Lo que se mejoró sobre el original (a propósito)

1. **«Aceptar igual» en la misma cuenta.** En el original se aceptaba con la contraseña y luego el servidor
   lo rechazaba en silencio. Aquí se dice claro: «Ya está registrada en esta cuenta: no puede entrar dos veces».
2. **El link de pago avisa la repetida al elegir la foto**, no solo al enviar.
3. **El monto leído se guarda aparte**, así la alarma «La captura dice $X» sí funciona para lo que llega por link
   (en el original nunca salía).
4. **«En espera» tiene su punto rojo propio** (en el original salía naranja como pendiente).
5. **La huella de la imagen no depende de la IA**: si la IA falla, la repetida igual se detecta.
6. **De otras empresas no se muestra ni el nombre ni el monto** en el historial de usos (el original era de una
   sola empresa; FinTwin es para muchas).
7. PIN por persona y con hash (el original tenía un PIN por cuenta en texto plano), español neutro con tildes e
   inglés primero.

## Lo que el original tenía y aquí no aplica

- **Página pública de la cuenta con PIN de privacidad del link.** En la app nueva cada cuenta se abre con la sesión
  de su equipo (dueño, quien revisa o quien sube con su código), así que no hay link público que proteger.
- **Pausa «La IA se quedó sin créditos».** Era un interruptor del administrador para clientes atrasados. Si hace
  falta, se agrega al panel del gerente.
- **Conectar una cuenta con link + PIN.** Lo reemplaza el código de acceso que da el dueño.

## Cómo se comprueba

- `npm run verify` en verde (82 pruebas). Las de este trabajo están en `test/worker/movimientos.test.ts`.
- Probado en el navegador a tamaño celular con una captura real: lectura correcta, repetida frenada en la misma
  cuenta, «Aceptar igual» en otra cuenta, punto amarillo y su historial, bandeja con «La captura dice».
- Guía pública: Docs → «Capturas repetidas y colores de cada movimiento» (en inglés y español).
