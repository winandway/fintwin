import { aCentavos } from '../shared/reglas';
import { exigirUsuario, registrarError } from './auth';
import { categoriaValida, fechaValida, leerImagen, textoCorto } from './archivos';
import { newId } from './crypto';
import { exigirRol, membresia, verificarPin } from './cuentas';
import { HttpError, json, type Ctx } from './http';
import { racionar } from './limites';
import { iaDisponible, leerTicket } from './ocr';

/** La IA lee un ticket o factura para llenar el formulario. No guarda nada. */
export async function leerTicketEndpoint(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  await membresia(ctx.env, ctx.params.id ?? '', u.id);
  const { archivo } = await leerImagen(ctx, 'archivo_invalido');
  if (!iaDisponible(ctx.env)) return json({ lectura_ia: false, lectura: null });
  await racionar(ctx.env, `ticket:${u.id}`, ctx.now, 60, 60);
  try {
    return json({ lectura_ia: true, lectura: await leerTicket(ctx.env, archivo.bytes, archivo.mime) });
  } catch (e) {
    await registrarError(ctx.env, ctx.url.pathname, `lectura de ticket: ${String(e)}`, ctx.now);
    return json({ lectura_ia: true, lectura: null });
  }
}

async function totales(ctx: Ctx, cuentaId: string) {
  const fila = await ctx.env.DB.prepare(
    `SELECT
       (SELECT COALESCE(SUM(comision_cent), 0) FROM comprobantes WHERE cuenta_id = ? AND tipo = 'ingreso' AND estado = 'aprobado') AS generada_cent,
       (SELECT COALESCE(SUM(monto_cent), 0) FROM gastos_comision WHERE cuenta_id = ?) AS gastada_cent`,
  )
    .bind(cuentaId, cuentaId)
    .first<{ generada_cent: number; gastada_cent: number }>();
  const generada = fila?.generada_cent ?? 0;
  const gastada = fila?.gastada_cent ?? 0;
  return { generada_cent: generada, gastada_cent: gastada, disponible_cent: generada - gastada };
}

/** La comisión de la cuenta y en qué se gastó, con la contabilidad del mes por categoría. */
export async function verComision(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  exigirRol(m, 'dueno');
  const t = await totales(ctx, m.cuenta_id);
  const d = new Date(ctx.now);
  const desdeMes = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const gastos = await ctx.env.DB.prepare(
    `SELECT g.id, g.monto_cent, g.comercio, g.categoria, g.fecha, g.nota, g.creado_en, u.nombre AS registrado_por_nombre
     FROM gastos_comision g LEFT JOIN usuarios u ON u.id = g.registrado_por
     WHERE g.cuenta_id = ? ORDER BY g.creado_en DESC LIMIT 200`,
  )
    .bind(m.cuenta_id)
    .all();
  const porCategoria = await ctx.env.DB.prepare(
    `SELECT COALESCE(categoria, '') AS categoria, SUM(monto_cent) AS total_cent, COUNT(*) AS cantidad
     FROM gastos_comision WHERE cuenta_id = ? AND creado_en >= ? GROUP BY 1 ORDER BY total_cent DESC`,
  )
    .bind(m.cuenta_id, desdeMes)
    .all();
  return json({ ...t, gastos: gastos.results, por_categoria_mes: porCategoria.results });
}

/** Un gasto pagado con la comisión: ticket obligatorio, PIN y monto dentro de lo disponible. */
export async function registrarGasto(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  exigirRol(m, 'dueno');
  const { form, archivo } = await leerImagen(ctx, 'ticket_requerido');
  const montoCent = aCentavos(String(form.get('monto') ?? ''));
  if (!montoCent) throw new HttpError(400, 'monto_invalido');
  await verificarPin(ctx.env, u, m, String(form.get('pin') ?? ''), ctx.now);
  const usado = await ctx.env.DB.prepare('SELECT id FROM gastos_comision WHERE archivo_hash = ?').bind(archivo.hash).first();
  if (usado) throw new HttpError(409, 'ticket_repetido');
  const t = await totales(ctx, m.cuenta_id);
  if (montoCent > t.disponible_cent) throw new HttpError(400, 'comision_insuficiente', { disponible_cent: t.disponible_cent });

  const id = newId();
  const clave = `gastos/${m.cuenta_id}/${id}.${archivo.ext}`;
  await ctx.env.BUCKET.put(clave, archivo.bytes, { httpMetadata: { contentType: archivo.mime } });
  try {
    await ctx.env.DB.prepare(
      `INSERT INTO gastos_comision (id, cuenta_id, registrado_por, monto_cent, comercio, categoria, fecha, nota,
         archivo_clave, archivo_tipo, archivo_hash, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id, m.cuenta_id, u.id, montoCent, textoCorto(form.get('comercio')), categoriaValida(form.get('categoria')),
        fechaValida(form.get('fecha')), textoCorto(form.get('nota'), 200), clave, archivo.mime, archivo.hash, ctx.now,
      )
      .run();
  } catch (e) {
    await ctx.env.BUCKET.delete(clave);
    if (String(e).includes('UNIQUE')) throw new HttpError(409, 'ticket_repetido');
    throw e;
  }
  return json({ ok: true, id }, 201);
}

/** El ticket de un gasto: solo para el equipo de la cuenta. */
export async function verArchivoGasto(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const fila = await ctx.env.DB.prepare(
    `SELECT g.archivo_clave, g.archivo_tipo FROM gastos_comision g
     JOIN miembros m ON m.cuenta_id = g.cuenta_id AND m.usuario_id = ?
     WHERE g.id = ?`,
  )
    .bind(u.id, ctx.params.id ?? '')
    .first<{ archivo_clave: string; archivo_tipo: string }>();
  if (!fila) throw new HttpError(404, 'no_encontrado');
  const obj = await ctx.env.BUCKET.get(fila.archivo_clave);
  if (!obj) throw new HttpError(404, 'no_encontrado');
  return new Response(obj.body, { headers: { 'content-type': fila.archivo_tipo, 'cache-control': 'private, max-age=3600' } });
}
