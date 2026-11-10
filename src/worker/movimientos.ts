import { z } from 'zod';
import { aCentavos, normalizarConfirmacion } from '../shared/reglas';
import { exigirUsuario } from './auth';
import { leerImagen, textoCorto } from './archivos';
import { avisarCapturaNueva } from './avisos';
import { buscarRepetida, columnasLectura, historialDeUso, lecturaDe, SQL_COLUMNAS_LECTURA } from './capturas';
import { newId } from './crypto';
import { exigirRol, membresia, verificarClaveValidar } from './cuentas';
import { HttpError, json, readJson, type Ctx } from './http';
import { racionar } from './limites';
import { LECTURA_VACIA } from './ocr';

// La pantalla de la cuenta del FinTwin original: movimientos por mes, registrar comprobante con
// lectura y aviso de repetida, cancelar, poner en espera, historial de uso y clientes.

/** Inicio del mes local (según el desfase del teléfono, en minutos) en milisegundos UTC. */
function inicioMes(y: number, m: number, tz: number): number {
  return Date.UTC(y, m, 1) + tz * 60000;
}

function desfase(ctx: Ctx): number {
  const tz = Number(ctx.url.searchParams.get('tz') ?? 0);
  return Number.isFinite(tz) && Math.abs(tz) <= 14 * 60 ? Math.round(tz) : 0;
}

const SQL_MOVIMIENTO = `SELECT k.id, k.tipo, k.estado, k.en_espera, k.monto_cent, k.comision_cent, k.fecha_pago, k.confirmacion,
    k.pagador, k.pagador_correo, k.beneficiario, k.beneficiario_correo, k.plataforma, k.lectura_estado, k.monto_leido_cent,
    k.motivo, k.notas, k.comercio, k.categoria, k.lectura, k.via, k.archivo_clave IS NOT NULL AS tiene_archivo,
    k.creado_en, k.revisado_en, s.nombre AS subido_por_nombre, r.nombre AS revisado_por_nombre,
    CASE WHEN k.tipo = 'ingreso' THEN (SELECT COUNT(*) FROM comprobantes o WHERE o.id <> k.id AND o.tipo = 'ingreso'
      AND ((k.archivo_hash IS NOT NULL AND o.archivo_hash = k.archivo_hash)
        OR (k.confirmacion_norm IS NOT NULL AND o.confirmacion_norm = k.confirmacion_norm))) ELSE 0 END AS repetidas
  FROM comprobantes k
  LEFT JOIN usuarios s ON s.id = k.subido_por
  LEFT JOIN usuarios r ON r.id = k.revisado_por`;

/**
 * Los movimientos del periodo elegido (un mes o «todo») con sus cifras, más el total histórico y la
 * lista de meses con movimientos. Igual que el original: pendientes y en espera no suman nunca.
 */
export async function movimientos(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  const tz = desfase(ctx);
  const periodo = ctx.url.searchParams.get('periodo') ?? 'mes';
  const local = new Date(ctx.now - tz * 60000);
  const actual = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}`;
  const elegido = periodo === 'todo' ? 'todo' : /^\d{4}-\d{2}$/.test(periodo) ? periodo : actual;
  const [ya, ma] = actual.split('-').map(Number) as [number, number];
  const mesDesde = inicioMes(ya, ma - 1, tz);
  const mesHasta = inicioMes(ya, ma, tz);
  let desde = 0;
  let hasta = Number.MAX_SAFE_INTEGER;
  if (elegido !== 'todo') {
    const [y, mo] = elegido.split('-').map(Number) as [number, number];
    desde = inicioMes(y, mo - 1, tz);
    hasta = inicioMes(y, mo, tz);
  }
  const db = ctx.env.DB;
  const [filas, cifras, historico, gastado, meses] = await db.batch([
    db.prepare(`${SQL_MOVIMIENTO} WHERE k.cuenta_id = ? AND k.creado_en >= ? AND k.creado_en < ? ORDER BY k.creado_en DESC, k.id DESC LIMIT 2000`).bind(
      m.cuenta_id, desde, hasta,
    ),
    db.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo = 'ingreso' AND estado = 'aprobado' THEN monto_cent END), 0) AS bruto_cent,
         COALESCE(SUM(CASE WHEN tipo = 'ingreso' AND estado = 'aprobado' THEN comision_cent END), 0) AS comision_cent,
         COALESCE(SUM(CASE WHEN tipo = 'salida' AND estado = 'aprobado' THEN monto_cent END), 0) AS salidas_cent,
         COALESCE(SUM(CASE WHEN estado = 'rechazado' THEN monto_cent END), 0) AS cancelados_cent
       FROM comprobantes WHERE cuenta_id = ? AND creado_en >= ? AND creado_en < ?`,
    ).bind(m.cuenta_id, desde, hasta),
    db.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo = 'ingreso' AND estado = 'aprobado' THEN monto_cent - comision_cent END), 0)
         - COALESCE(SUM(CASE WHEN tipo = 'salida' AND estado = 'aprobado' THEN monto_cent END), 0) AS total_cent,
         COALESCE(SUM(CASE WHEN tipo = 'ingreso' AND estado = 'aprobado' AND creado_en >= ? AND creado_en < ? THEN monto_cent END), 0) AS este_mes_cent,
         COALESCE(SUM(CASE WHEN tipo = 'ingreso' AND estado = 'pendiente' THEN 1 END), 0) AS pendientes,
         MAX(creado_en) AS ultimo
       FROM comprobantes WHERE cuenta_id = ?`,
    ).bind(mesDesde, mesHasta, m.cuenta_id),
    db.prepare('SELECT COALESCE(SUM(monto_cent), 0) AS gastado_cent FROM gastos_comision WHERE cuenta_id = ? AND creado_en >= ? AND creado_en < ?').bind(
      m.cuenta_id, desde, hasta,
    ),
    db.prepare(
      `SELECT DISTINCT strftime('%Y-%m', (creado_en - ? * 60000) / 1000, 'unixepoch') AS mes FROM comprobantes WHERE cuenta_id = ? ORDER BY mes DESC`,
    ).bind(tz, m.cuenta_id),
  ]);
  const c = (cifras?.results[0] ?? {}) as Record<string, number>;
  const h = (historico?.results[0] ?? {}) as Record<string, number | null>;
  const listaMeses = [...new Set([actual, ...((meses?.results ?? []) as { mes: string }[]).map((x) => x.mes)])].sort().reverse();
  return json({
    periodo: elegido,
    mes_actual: actual,
    meses: listaMeses,
    movimientos: filas?.results ?? [],
    cifras: {
      bruto_cent: c.bruto_cent ?? 0,
      comision_cent: c.comision_cent ?? 0,
      comision_queda_cent: Math.max(0, (c.comision_cent ?? 0) - (((gastado?.results[0] ?? {}) as { gastado_cent?: number }).gastado_cent ?? 0)),
      salidas_cent: c.salidas_cent ?? 0,
      cancelados_cent: c.cancelados_cent ?? 0,
    },
    total_cent: h.total_cent ?? 0,
    este_mes_cent: h.este_mes_cent ?? 0,
    pendientes: h.pendientes ?? 0,
    ultimo: h.ultimo ?? null,
  });
}

/**
 * Leer la captura dentro de la cuenta, antes de registrarla: lo leído, y si ya se usó antes (en
 * cualquier cuenta, sin contar rechazadas), el aviso con todo su historial.
 */
export async function leerEnCuenta(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  await racionar(ctx.env, `leer:${u.id}`, ctx.now, 40, 60);
  const { archivo } = await leerImagen(ctx, 'archivo_invalido');
  const lectura = await lecturaDe(ctx.env, archivo, m.nombre, ctx.now);
  // Primero en esta misma cuenta (ahí nunca entra dos veces); si no, en cualquier otra.
  const repetida =
    (await buscarRepetida(ctx.env, archivo.hash, lectura?.confirmacion ?? null, m.cuenta_id)) ??
    (await buscarRepetida(ctx.env, archivo.hash, lectura?.confirmacion ?? null));
  const historial = repetida ? await historialDeUso(ctx.env, archivo.hash, lectura?.confirmacion ?? null, u.id) : [];
  return json({
    lectura_ia: lectura !== null,
    lectura,
    repetida: repetida ? { creado_en: repetida.creado_en, coincide: repetida.coincide, misma_cuenta: repetida.cuenta_id === m.cuenta_id } : null,
    historial,
  });
}

/**
 * Registrar un comprobante desde la cuenta: queda pendiente. Si la captura ya se usó en ESTA cuenta,
 * no entra. Si se usó en otra, solo entra con «Aceptar igual» y el PIN de quien la sube.
 */
export async function registrarEnCuenta(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  await racionar(ctx.env, `subir:${u.id}`, ctx.now, 30, 60);
  const { form, archivo } = await leerImagen(ctx, 'archivo_invalido');
  const lectura = await lecturaDe(ctx.env, archivo, m.nombre, ctx.now);
  const montoCent = aCentavos(String(form.get('monto') ?? '')) ?? lectura?.monto_cent ?? null;
  if (!montoCent || montoCent > 1_000_000_000) throw new HttpError(400, 'monto_invalido');
  const confirmacion = lectura?.confirmacion ?? null;

  const enEsta = await buscarRepetida(ctx.env, archivo.hash, confirmacion, m.cuenta_id);
  if (enEsta) throw new HttpError(409, 'repetida_misma_cuenta', { historial: await historialDeUso(ctx.env, archivo.hash, confirmacion, u.id) });
  const enOtra = await buscarRepetida(ctx.env, archivo.hash, confirmacion);
  if (enOtra) {
    if (form.get('aceptar_repetida') !== '1') {
      throw new HttpError(409, 'captura_repetida', { historial: await historialDeUso(ctx.env, archivo.hash, confirmacion, u.id) });
    }
    await verificarClaveValidar(ctx.env, u, m, String(form.get('pin') ?? ''), ctx.now);
  }

  const id = newId();
  const clave = `comprobantes/${m.cuenta_id}/${id}.${archivo.ext}`;
  await ctx.env.BUCKET.put(clave, archivo.bytes, { httpMetadata: { contentType: archivo.mime } });
  await ctx.env.DB.prepare(
    `INSERT INTO comprobantes (id, cuenta_id, subido_por, tipo, estado, monto_cent, confirmacion, confirmacion_norm,
       ${SQL_COLUMNAS_LECTURA}, notas, lectura, via, archivo_clave, archivo_hash, archivo_tipo, creado_en)
     VALUES (?, ?, ?, 'ingreso', 'pendiente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cuenta', ?, ?, ?, ?)`,
  )
    .bind(
      id, m.cuenta_id, u.id, montoCent, confirmacion, normalizarConfirmacion(confirmacion),
      ...columnasLectura(lectura ?? { ...LECTURA_VACIA }), textoCorto(form.get('notas'), 300), lectura ? 'ia' : 'manual',
      clave, archivo.hash, archivo.mime, ctx.now,
    )
    .run();
  await avisarCapturaNueva(ctx.env, { id: m.cuenta_id, nombre: m.nombre }, montoCent, u.nombre, ctx.now);
  return json({ ok: true, id }, 201);
}

async function movimientoDe(ctx: Ctx, cuentaId: string) {
  const k = await ctx.env.DB.prepare(
    'SELECT id, tipo, estado, en_espera, monto_cent, archivo_hash, confirmacion FROM comprobantes WHERE id = ? AND cuenta_id = ?',
  )
    .bind(ctx.params.mov ?? '', cuentaId)
    .first<{ id: string; tipo: string; estado: string; en_espera: number; monto_cent: number; archivo_hash: string | null; confirmacion: string | null }>();
  if (!k) throw new HttpError(404, 'no_encontrado');
  return k;
}

/** Cancelar un pendiente: queda rechazado con su motivo; no se borra nada. */
export async function cancelar(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  const k = await movimientoDe(ctx, m.cuenta_id);
  const r = await ctx.env.DB.prepare(
    `UPDATE comprobantes SET estado = 'rechazado', motivo = 'Cancelado antes de aprobar', revisado_por = ?, revisado_en = ?
     WHERE id = ? AND estado = 'pendiente' AND en_espera = 0 RETURNING id`,
  )
    .bind(u.id, ctx.now, k.id)
    .all();
  if (!r.results.length) throw new HttpError(409, 'ya_procesado');
  return json({ ok: true });
}

/** «En espera»: un aprobado que todavía no se da por bueno sale del total hasta que se confirme con PIN. */
export async function ponerEnEspera(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  exigirRol(m, 'dueno', 'validador');
  const datos = z.object({ pin: z.string(), nota: z.string().max(200).optional() }).safeParse(await readJson(ctx.req));
  if (!datos.success) throw new HttpError(400, 'datos_invalidos');
  await verificarClaveValidar(ctx.env, u, m, datos.data.pin, ctx.now);
  const k = await movimientoDe(ctx, m.cuenta_id);
  const nota = datos.data.nota?.trim();
  const r = await ctx.env.DB.prepare(
    `UPDATE comprobantes SET estado = 'pendiente', en_espera = 1, revisado_por = ?, revisado_en = ?,
       notas = CASE WHEN ? IS NULL THEN notas WHEN notas IS NULL OR notas = '' THEN ? ELSE notas || char(10) || ? END
     WHERE id = ? AND tipo = 'ingreso' AND estado = 'aprobado' RETURNING id`,
  )
    .bind(u.id, ctx.now, nota || null, nota || null, nota || null, k.id)
    .all();
  if (!r.results.length) throw new HttpError(409, 'ya_procesado');
  return json({ ok: true });
}

/** Todos los usos de la captura de un movimiento (para el bloque «Captura repetida»). */
export async function usos(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  const k = await movimientoDe(ctx, m.cuenta_id);
  return json({ usos: await historialDeUso(ctx.env, k.archivo_hash, k.confirmacion, u.id) });
}

/**
 * «Clientes que te pagan»: por usuario de quien subió o, si no, por el nombre que leyó la IA.
 */
export async function clientes(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  const { results } = await ctx.env.DB.prepare(
    `SELECT
       CASE WHEN s.sin_correo = 0 AND k.via = 'link' THEN 'u:' || k.subido_por
            WHEN k.pagador IS NOT NULL AND trim(k.pagador) <> '' THEN 'n:' || upper(trim(k.pagador))
            WHEN k.via = 'link' THEN 'u:' || k.subido_por
            ELSE 'x' END AS clave,
       MAX(CASE WHEN k.via = 'link' THEN s.nombre END) AS nombre_usuario,
       MAX(k.pagador) AS nombre_leido,
       MAX(CASE WHEN s.sin_correo = 0 AND k.via = 'link' THEN 1 ELSE 0 END) AS tiene_usuario,
       MAX(CASE WHEN k.via = 'link' THEN 1 ELSE 0 END) AS por_link,
       COUNT(*) AS comprobantes,
       COALESCE(SUM(CASE WHEN k.estado = 'aprobado' THEN k.monto_cent END), 0) AS aprobado_cent,
       COALESCE(SUM(CASE WHEN k.estado = 'pendiente' THEN 1 END), 0) AS por_revisar,
       COALESCE(SUM(CASE WHEN k.estado = 'rechazado' THEN 1 END), 0) AS rechazados,
       MAX(k.creado_en) AS ultimo
     FROM comprobantes k LEFT JOIN usuarios s ON s.id = k.subido_por
     WHERE k.cuenta_id = ? AND k.tipo = 'ingreso'
     GROUP BY clave ORDER BY ultimo DESC LIMIT 500`,
  )
    .bind(m.cuenta_id)
    .all<Record<string, string | number | null>>();
  return json({
    clientes: results.map((r) => ({
      clave: r.clave,
      nombre: (r.nombre_usuario as string | null) ?? (r.nombre_leido as string | null) ?? null,
      tiene_usuario: r.tiene_usuario === 1,
      por_link: r.por_link === 1,
      comprobantes: r.comprobantes,
      aprobado_cent: r.aprobado_cent,
      por_revisar: r.por_revisar,
      rechazados: r.rechazados,
      ultimo: r.ultimo,
    })),
  });
}

/** El dueño decide si el link de pago exige el número de confirmación. */
export async function exigirConfirmacion(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  exigirRol(m, 'dueno');
  const datos = z.object({ valor: z.boolean() }).safeParse(await readJson(ctx.req));
  if (!datos.success) throw new HttpError(400, 'datos_invalidos');
  await ctx.env.DB.prepare('UPDATE cuentas SET exigir_confirmacion = ? WHERE id = ?').bind(datos.data.valor ? 1 : 0, m.cuenta_id).run();
  return json({ ok: true });
}
