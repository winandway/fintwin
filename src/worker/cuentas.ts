import { z } from 'zod';
import { aCentavos, PIN_RE } from '../shared/reglas';
import { exigirUsuario, type Usuario } from './auth';
import { hashSecret, newId, newSlug, randomToken, sha256Hex, verifySecret } from './crypto';
import type { Env } from './env';
import { HttpError, json, readJson, type Ctx } from './http';
import { exigirNoBloqueado, limpiarIntentos, sumarIntento } from './limites';
import { categoriaValida, fechaValida, leerImagen, textoCorto } from './archivos';
import { listarAccesos } from './accesos';

export type Rol = 'dueno' | 'validador';

interface Membresia {
  cuenta_id: string;
  rol: Rol;
  pin_hash: string;
  nombre: string;
  comision_pct: number;
  link_slug: string;
  exigir_confirmacion: number;
  creado_en: number;
  clave_validar_hash: string | null;
  clave_validar_por: string | null;
  clave_validar_en: number | null;
}

const pinSchema = z.string().regex(PIN_RE);

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, 'datos_invalidos', { campos: r.error.issues.map((i) => i.path.join('.')) });
  return r.data;
}

export async function membresia(env: Env, cuentaId: string, usuarioId: string): Promise<Membresia> {
  const m = await env.DB.prepare(
    `SELECT m.cuenta_id, m.rol, m.pin_hash, c.nombre, c.comision_pct, c.link_slug, c.exigir_confirmacion, c.creado_en,
       c.clave_validar_hash, c.clave_validar_por, c.clave_validar_en FROM miembros m
     JOIN cuentas c ON c.id = m.cuenta_id
     WHERE m.cuenta_id = ? AND m.usuario_id = ? AND c.archivada_en IS NULL`,
  )
    .bind(cuentaId, usuarioId)
    .first<Membresia>();
  if (!m) throw new HttpError(404, 'cuenta_no_encontrada');
  return m;
}

export function exigirRol(m: Membresia, ...roles: Rol[]): void {
  if (!roles.includes(m.rol)) throw new HttpError(403, 'sin_permiso');
}

/** PIN personal con límite: 5 fallos en 15 minutos bloquean 15 minutos. */
export async function verificarPin(env: Env, u: Usuario, m: Membresia, pin: string, now: number): Promise<void> {
  const clave = `pin:${u.id}:${m.cuenta_id}`;
  await exigirNoBloqueado(env, clave, now);
  if (!PIN_RE.test(pin) || !(await verifySecret(pin, m.pin_hash))) {
    const quedan = await sumarIntento(env, clave, now, 5, 15, 15);
    throw new HttpError(401, 'pin_incorrecto', { quedan });
  }
  await limpiarIntentos(env, clave);
}

/**
 * Para VALIDAR (aprobar, rechazar, poner en espera, aceptar una repetida). Si la cuenta tiene
 * clave única, se pide esa y no el PIN personal: así el que creó la cuenta no puede validar si
 * la clave la puso otra persona. Mismo límite: 5 fallos en 15 minutos. Candado C-CLAVE-UNICA-1.
 */
export async function verificarClaveValidar(env: Env, u: Usuario, m: Membresia, pin: string, now: number): Promise<void> {
  if (!m.clave_validar_hash) return verificarPin(env, u, m, pin, now);
  const clave = `pinv:${u.id}:${m.cuenta_id}`;
  await exigirNoBloqueado(env, clave, now);
  if (!PIN_RE.test(pin) || !(await verifySecret(pin, m.clave_validar_hash))) {
    const quedan = await sumarIntento(env, clave, now, 5, 15, 15);
    throw new HttpError(401, 'clave_unica_incorrecta', { quedan });
  }
  await limpiarIntentos(env, clave);
}

/** Lo que la pantalla necesita saber de la clave única (nunca la clave). */
export async function estadoClaveUnica(env: Env, m: Membresia, yo: string) {
  if (!m.clave_validar_por) return { activa: false, por_mi: false, nombre: null, en: null };
  const quien = await env.DB.prepare('SELECT nombre FROM usuarios WHERE id = ?').bind(m.clave_validar_por).first<{ nombre: string }>();
  return { activa: true, por_mi: m.clave_validar_por === yo, nombre: quien?.nombre ?? null, en: m.clave_validar_en };
}

/**
 * Crear la clave única (si nadie la ha creado) con el PIN personal, o cambiarla (solo quien la
 * creó, con la clave actual). Una vez creada, nadie más puede cambiarla ni verla.
 */
export async function claveUnica(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  exigirRol(m, 'dueno', 'validador');
  const datos = parse(z.object({ pin: z.string().optional(), actual: z.string().optional(), nueva: pinSchema }), await readJson(ctx.req));
  const hash = await hashSecret(datos.nueva);
  if (!m.clave_validar_hash) {
    await verificarPin(ctx.env, u, m, datos.pin ?? '', ctx.now);
    // Si dos personas la crean a la vez, gana la primera.
    const r = await ctx.env.DB.prepare(
      'UPDATE cuentas SET clave_validar_hash = ?, clave_validar_por = ?, clave_validar_en = ? WHERE id = ? AND clave_validar_hash IS NULL RETURNING id',
    )
      .bind(hash, u.id, ctx.now, m.cuenta_id)
      .all();
    if (!r.results.length) throw new HttpError(409, 'clave_unica_de_otro');
    return json({ ok: true, creada: true });
  }
  if (m.clave_validar_por !== u.id) throw new HttpError(403, 'clave_unica_de_otro');
  await verificarClaveValidar(ctx.env, u, m, datos.actual ?? '', ctx.now);
  await ctx.env.DB.prepare('UPDATE cuentas SET clave_validar_hash = ?, clave_validar_en = ? WHERE id = ? AND clave_validar_por = ?')
    .bind(hash, ctx.now, m.cuenta_id, u.id)
    .run();
  return json({ ok: true, creada: false });
}

interface Resumen {
  ingresos_cent: number;
  comision_cent: number;
  salidas_cent: number;
  pendientes: number;
}

async function resumen(env: Env, cuentaId: string, desde?: number, hasta?: number): Promise<Resumen> {
  const rango = desde !== undefined && hasta !== undefined;
  const fila = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN tipo = 'ingreso' AND estado = 'aprobado' THEN monto_cent END), 0) AS ingresos_cent,
       COALESCE(SUM(CASE WHEN tipo = 'ingreso' AND estado = 'aprobado' THEN comision_cent END), 0) AS comision_cent,
       COALESCE(SUM(CASE WHEN tipo = 'salida' AND estado = 'aprobado' THEN monto_cent END), 0) AS salidas_cent,
       COALESCE(SUM(CASE WHEN tipo = 'ingreso' AND estado = 'pendiente' THEN 1 END), 0) AS pendientes
     FROM comprobantes WHERE cuenta_id = ?${rango ? ' AND COALESCE(revisado_en, creado_en) >= ? AND COALESCE(revisado_en, creado_en) < ?' : ''}`,
  )
    .bind(...(rango ? [cuentaId, desde, hasta] : [cuentaId]))
    .first<Resumen>();
  return fila ?? { ingresos_cent: 0, comision_cent: 0, salidas_cent: 0, pendientes: 0 };
}

function rangoMes(mes: string): [number, number] {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) throw new HttpError(400, 'mes_invalido');
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  return [Date.UTC(y, mo, 1), Date.UTC(y, mo + 1, 1)];
}

function mesActual(now: number): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- cuentas

export async function crearCuenta(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  // El negocio lo abre quien administra el dinero, con su correo confirmado.
  if (u.sin_correo === 1) throw new HttpError(403, 'requiere_correo');
  const datos = parse(
    z.object({ nombre: z.string().trim().min(2).max(80), pin: pinSchema, comision_pct: z.number().min(0).max(50).default(0) }),
    await readJson(ctx.req),
  );
  const total = await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM cuentas WHERE dueno_id = ? AND archivada_en IS NULL')
    .bind(u.id)
    .first<{ n: number }>();
  if ((total?.n ?? 0) >= 50) throw new HttpError(400, 'limite_cuentas');
  const id = newId();
  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      'INSERT INTO cuentas (id, nombre, comision_pct, link_slug, dueno_id, creado_en) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(id, datos.nombre, datos.comision_pct, newSlug(), u.id, ctx.now),
    ctx.env.DB.prepare(
      "INSERT INTO miembros (cuenta_id, usuario_id, rol, pin_hash, creado_en) VALUES (?, ?, 'dueno', ?, ?)",
    ).bind(id, u.id, await hashSecret(datos.pin), ctx.now),
  ]);
  return json({ ok: true, id }, 201);
}

export async function listarCuentas(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const { results } = await ctx.env.DB.prepare(
    `SELECT c.id, c.nombre, c.comision_pct, m.rol,
       COALESCE(SUM(CASE WHEN k.tipo = 'ingreso' AND k.estado = 'aprobado' THEN k.monto_cent - k.comision_cent END), 0)
       - COALESCE(SUM(CASE WHEN k.tipo = 'salida' AND k.estado = 'aprobado' THEN k.monto_cent END), 0) AS total_cent,
       COALESCE(SUM(CASE WHEN k.tipo = 'ingreso' AND k.estado = 'pendiente' THEN 1 END), 0) AS pendientes
     FROM miembros m JOIN cuentas c ON c.id = m.cuenta_id
     LEFT JOIN comprobantes k ON k.cuenta_id = c.id
     WHERE m.usuario_id = ? AND c.archivada_en IS NULL
     GROUP BY c.id ORDER BY c.creado_en`,
  )
    .bind(u.id)
    .all();
  return json({ cuentas: results });
}

export async function verCuenta(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  const general = await resumen(ctx.env, m.cuenta_id);
  const mes = ctx.url.searchParams.get('mes') ?? mesActual(ctx.now);
  const [desde, hasta] = rangoMes(mes);
  const delMes = await resumen(ctx.env, m.cuenta_id, desde, hasta);
  return json({
    cuenta: {
      id: m.cuenta_id,
      nombre: m.nombre,
      comision_pct: m.comision_pct,
      link_slug: m.link_slug,
      exigir_confirmacion: m.exigir_confirmacion === 1,
      creado_en: m.creado_en,
    },
    rol: m.rol,
    clave_unica: await estadoClaveUnica(ctx.env, m, u.id),
    resumen: {
      ...general,
      total_cent: general.ingresos_cent - general.comision_cent - general.salidas_cent,
    },
    mes: { mes, ...delMes, total_cent: delMes.ingresos_cent - delMes.comision_cent - delMes.salidas_cent },
  });
}

export async function listarComprobantes(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  const vista = ctx.url.searchParams.get('vista') === 'historial' ? 'historial' : 'pendientes';
  const offset = Math.max(0, Number(ctx.url.searchParams.get('desde') ?? 0) || 0);
  const mes = ctx.url.searchParams.get('mes');
  const filtros: string[] = ['k.cuenta_id = ?'];
  const params: (string | number)[] = [m.cuenta_id];
  if (vista === 'pendientes') filtros.push("k.estado = 'pendiente' AND k.tipo = 'ingreso'");
  else filtros.push("k.estado <> 'pendiente'");
  if (mes) {
    const [desde, hasta] = rangoMes(mes);
    filtros.push('k.creado_en >= ? AND k.creado_en < ?');
    params.push(desde, hasta);
  }
  const { results } = await ctx.env.DB.prepare(
    `SELECT k.id, k.tipo, k.estado, k.monto_cent, k.comision_cent, k.fecha_pago, k.confirmacion, k.pagador,
       k.beneficiario, k.motivo, k.notas, k.comercio, k.categoria, k.lectura, k.archivo_clave IS NOT NULL AS tiene_archivo, k.creado_en, k.revisado_en,
       k.en_espera, k.via, k.plataforma, k.monto_leido_cent,
       s.nombre AS subido_por_nombre, CASE WHEN s.sin_correo = 1 THEN NULL ELSE s.email END AS subido_por_email, r.nombre AS revisado_por_nombre
     FROM comprobantes k
     LEFT JOIN usuarios s ON s.id = k.subido_por
     LEFT JOIN usuarios r ON r.id = k.revisado_por
     WHERE ${filtros.join(' AND ')}
     ORDER BY k.creado_en ${vista === 'pendientes' ? 'ASC' : 'DESC'} LIMIT ${vista === 'pendientes' ? 501 : 51} OFFSET ?`,
  )
    .bind(...params, offset)
    .all();
  const tope = vista === 'pendientes' ? 500 : 50;
  const filas = results.slice(0, tope);
  return json({ comprobantes: filas, hay_mas: results.length > tope, siguiente: offset + filas.length });
}

/** Aprobar o rechazar en lote. Cada fila solo cambia si sigue pendiente: dos validadores no chocan. */
export async function revisar(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  exigirRol(m, 'dueno', 'validador');
  const datos = parse(
    z.object({
      ids: z.array(z.string().min(1).max(64)).min(1).max(500),
      accion: z.enum(['aprobar', 'rechazar']),
      pin: z.string(),
      motivo: z.string().max(200).optional(),
    }),
    await readJson(ctx.req),
  );
  await verificarClaveValidar(ctx.env, u, m, datos.pin, ctx.now);
  const estado = datos.accion === 'aprobar' ? 'aprobado' : 'rechazado';
  const pct = datos.accion === 'aprobar' ? m.comision_pct : 0;
  const db = ctx.env.DB;
  const resultados = await db.batch<{ id: string }>(
    [...new Set(datos.ids)].map((id) =>
      db
        .prepare(
          `UPDATE comprobantes SET estado = ?, revisado_por = ?, revisado_en = ?, en_espera = 0,
             comision_cent = CAST(ROUND(monto_cent * ? / 100.0) AS INTEGER),
             motivo = CASE WHEN ? = 'rechazado' THEN COALESCE(?, 'Rechazado en la revisión') ELSE motivo END
           WHERE id = ? AND cuenta_id = ? AND tipo = 'ingreso' AND estado = 'pendiente' RETURNING id`,
        )
        .bind(estado, u.id, ctx.now, pct, estado, datos.motivo?.trim() || null, id, m.cuenta_id),
    ),
  );
  const hechos = resultados.flatMap((r) => r.results.map((f) => f.id));
  return json({ ok: true, hechos, ya_revisados: datos.ids.length - hechos.length });
}

/** Toda salida lleva su factura (desde el 28 oct 2026). Llega como formulario con la imagen. */
export async function registrarSalida(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  exigirRol(m, 'dueno');
  const { form, archivo } = await leerImagen(ctx, 'factura_requerida');
  const montoCent = aCentavos(String(form.get('monto') ?? ''));
  const motivo = String(form.get('motivo') ?? '').trim().slice(0, 200);
  const pin = String(form.get('pin') ?? '');
  if (!montoCent) throw new HttpError(400, 'monto_invalido');
  if (motivo.length < 2) throw new HttpError(400, 'datos_invalidos', { campos: ['motivo'] });
  await verificarPin(ctx.env, u, m, pin, ctx.now);
  // Freno de repetidas: la misma salida en los últimos 10 minutos pide confirmación.
  if (form.get('confirmar_repetida') !== '1') {
    const igual = await ctx.env.DB.prepare(
      `SELECT id FROM comprobantes WHERE cuenta_id = ? AND tipo = 'salida' AND monto_cent = ? AND creado_en > ? LIMIT 1`,
    )
      .bind(m.cuenta_id, montoCent, ctx.now - 10 * 60000)
      .first();
    if (igual) throw new HttpError(409, 'salida_repetida');
  }
  const repetida = await ctx.env.DB.prepare(
    "SELECT id FROM comprobantes WHERE archivo_hash = ? AND estado <> 'rechazado' LIMIT 1",
  )
    .bind(archivo.hash)
    .first();
  if (repetida) throw new HttpError(409, 'factura_repetida');
  const id = newId();
  const clave = `salidas/${m.cuenta_id}/${id}.${archivo.ext}`;
  await ctx.env.BUCKET.put(clave, archivo.bytes, { httpMetadata: { contentType: archivo.mime } });
  try {
    await ctx.env.DB.prepare(
      `INSERT INTO comprobantes (id, cuenta_id, subido_por, tipo, estado, monto_cent, motivo, comercio, categoria,
         fecha_pago, archivo_clave, archivo_hash, archivo_tipo, revisado_por, revisado_en, creado_en)
       VALUES (?, ?, ?, 'salida', 'aprobado', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id, m.cuenta_id, u.id, montoCent, motivo, textoCorto(form.get('comercio')), categoriaValida(form.get('categoria')),
        fechaValida(form.get('fecha')), clave, archivo.hash, archivo.mime, u.id, ctx.now, ctx.now,
      )
      .run();
  } catch (e) {
    await ctx.env.BUCKET.delete(clave);
    if (String(e).includes('UNIQUE')) throw new HttpError(409, 'factura_repetida');
    throw e;
  }
  return json({ ok: true, id }, 201);
}

export async function ajustesCuenta(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  exigirRol(m, 'dueno');
  const datos = parse(
    z.object({ nombre: z.string().trim().min(2).max(80), comision_pct: z.number().min(0).max(50), pin: z.string() }),
    await readJson(ctx.req),
  );
  await verificarPin(ctx.env, u, m, datos.pin, ctx.now);
  await ctx.env.DB.prepare('UPDATE cuentas SET nombre = ?, comision_pct = ? WHERE id = ?')
    .bind(datos.nombre, datos.comision_pct, m.cuenta_id)
    .run();
  return json({ ok: true });
}

export async function rotarLink(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  exigirRol(m, 'dueno');
  const { pin } = parse(z.object({ pin: z.string() }), await readJson(ctx.req));
  await verificarPin(ctx.env, u, m, pin, ctx.now);
  const slug = newSlug();
  await ctx.env.DB.prepare('UPDATE cuentas SET link_slug = ? WHERE id = ?').bind(slug, m.cuenta_id).run();
  return json({ ok: true, link_slug: slug });
}

export async function cambiarMiPin(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  const datos = parse(z.object({ actual: z.string(), nuevo: pinSchema }), await readJson(ctx.req));
  await verificarPin(ctx.env, u, m, datos.actual, ctx.now);
  await ctx.env.DB.prepare('UPDATE miembros SET pin_hash = ? WHERE cuenta_id = ? AND usuario_id = ?')
    .bind(await hashSecret(datos.nuevo), m.cuenta_id, u.id)
    .run();
  return json({ ok: true });
}

// ---------------------------------------------------------------- equipo

export async function verEquipo(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  const miembros = await ctx.env.DB.prepare(
    // Quien entró con código aparece en «accesos», no aquí; su correo es un marcador interno.
    `SELECT m.usuario_id, m.rol, m.creado_en, u.nombre, CASE WHEN u.sin_correo = 1 THEN NULL ELSE u.email END AS email
     FROM miembros m JOIN usuarios u ON u.id = m.usuario_id
     WHERE m.cuenta_id = ? AND NOT EXISTS (
       SELECT 1 FROM accesos a WHERE a.cuenta_id = m.cuenta_id AND a.usuario_id = m.usuario_id AND a.anulado_en IS NULL)
     ORDER BY m.rol = 'dueno' DESC, m.creado_en`,
  )
    .bind(m.cuenta_id)
    .all();
  const invitaciones =
    m.rol === 'dueno'
      ? (
          await ctx.env.DB.prepare(
            `SELECT id, rol, expira_en, creado_en FROM invitaciones
             WHERE cuenta_id = ? AND usada_en IS NULL AND anulada_en IS NULL AND expira_en > ? ORDER BY creado_en DESC`,
          )
            .bind(m.cuenta_id, ctx.now)
            .all()
        ).results
      : [];
  const accesos = m.rol === 'dueno' ? await listarAccesos(ctx.env, m.cuenta_id, ctx.now) : [];
  return json({ rol: m.rol, yo: u.id, miembros: miembros.results, invitaciones, accesos });
}

export async function crearInvitacion(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  exigirRol(m, 'dueno');
  const { pin } = parse(z.object({ pin: z.string() }), await readJson(ctx.req));
  await verificarPin(ctx.env, u, m, pin, ctx.now);
  const token = randomToken(16);
  await ctx.env.DB.prepare(
    `INSERT INTO invitaciones (id, token_hash, cuenta_id, rol, creado_por, expira_en, creado_en)
     VALUES (?, ?, ?, 'validador', ?, ?, ?)`,
  )
    .bind(newId(), await sha256Hex(token), m.cuenta_id, u.id, ctx.now + 7 * 24 * 3600 * 1000, ctx.now)
    .run();
  return json({ ok: true, token }, 201);
}

export async function anularInvitacion(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  exigirRol(m, 'dueno');
  const { invitacion_id } = parse(z.object({ invitacion_id: z.string() }), await readJson(ctx.req));
  await ctx.env.DB.prepare('UPDATE invitaciones SET anulada_en = ? WHERE id = ? AND cuenta_id = ? AND usada_en IS NULL')
    .bind(ctx.now, invitacion_id, m.cuenta_id)
    .run();
  return json({ ok: true });
}

export async function quitarMiembro(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  exigirRol(m, 'dueno');
  const datos = parse(z.object({ usuario_id: z.string(), pin: z.string() }), await readJson(ctx.req));
  if (datos.usuario_id === u.id) throw new HttpError(400, 'no_puedes_quitarte');
  if (datos.usuario_id === m.clave_validar_por) throw new HttpError(400, 'tiene_la_clave_unica');
  await verificarPin(ctx.env, u, m, datos.pin, ctx.now);
  await ctx.env.DB.prepare("DELETE FROM miembros WHERE cuenta_id = ? AND usuario_id = ? AND rol <> 'dueno'")
    .bind(m.cuenta_id, datos.usuario_id)
    .run();
  return json({ ok: true });
}

export async function salirDelEquipo(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  if (m.rol === 'dueno') throw new HttpError(400, 'dueno_no_sale');
  const db = ctx.env.DB;
  await db.batch([
    db.prepare('DELETE FROM miembros WHERE cuenta_id = ? AND usuario_id = ?').bind(m.cuenta_id, u.id),
    // Si se va quien tenía la clave única, la clave se va con esa persona: se vuelve al PIN de cada uno.
    db
      .prepare('UPDATE cuentas SET clave_validar_hash = NULL, clave_validar_por = NULL, clave_validar_en = NULL WHERE id = ? AND clave_validar_por = ?')
      .bind(m.cuenta_id, u.id),
  ]);
  return json({ ok: true });
}

async function invitacionVigente(env: Env, token: string, now: number) {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  return env.DB.prepare(
    `SELECT i.id, i.cuenta_id, i.rol, c.nombre AS cuenta_nombre, u.nombre AS invita
     FROM invitaciones i JOIN cuentas c ON c.id = i.cuenta_id JOIN usuarios u ON u.id = i.creado_por
     WHERE i.token_hash = ? AND i.usada_en IS NULL AND i.anulada_en IS NULL AND i.expira_en > ? AND c.archivada_en IS NULL`,
  )
    .bind(await sha256Hex(token), now)
    .first<{ id: string; cuenta_id: string; rol: Rol; cuenta_nombre: string; invita: string }>();
}

export async function verInvitacion(ctx: Ctx): Promise<Response> {
  const inv = await invitacionVigente(ctx.env, ctx.params.token ?? '', ctx.now);
  if (!inv) return json({ valida: false });
  return json({ valida: true, cuenta_nombre: inv.cuenta_nombre, invita: inv.invita, rol: inv.rol });
}

export async function aceptarInvitacion(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const { pin } = parse(z.object({ pin: pinSchema }), await readJson(ctx.req));
  const inv = await invitacionVigente(ctx.env, ctx.params.token ?? '', ctx.now);
  if (!inv) throw new HttpError(400, 'invitacion_vencida');
  const ya = await ctx.env.DB.prepare('SELECT 1 FROM miembros WHERE cuenta_id = ? AND usuario_id = ?')
    .bind(inv.cuenta_id, u.id)
    .first();
  if (ya) throw new HttpError(409, 'ya_eres_miembro');
  const db = ctx.env.DB;
  const [marcada] = await db.batch<{ id: string }>([
    db
      .prepare('UPDATE invitaciones SET usada_por = ?, usada_en = ? WHERE id = ? AND usada_en IS NULL RETURNING id')
      .bind(u.id, ctx.now, inv.id),
    db
      .prepare(
        `INSERT INTO miembros (cuenta_id, usuario_id, rol, pin_hash, creado_en)
         SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM invitaciones WHERE id = ? AND usada_por = ?)`,
      )
      .bind(inv.cuenta_id, u.id, inv.rol, await hashSecret(pin), ctx.now, inv.id, u.id),
  ]);
  if (!marcada?.results.length) throw new HttpError(400, 'invitacion_vencida');
  return json({ ok: true, cuenta_id: inv.cuenta_id });
}
