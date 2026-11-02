import { z } from 'zod';
import { PIN_RE } from '../shared/reglas';
import { abrirSesion, crearUsuarioSinCorreo, exigirUsuario, usuarioActual } from './auth';
import { hashSecret, newId, sha256Hex } from './crypto';
import { membresia, exigirRol, verificarPin } from './cuentas';
import type { Env } from './env';
import { clientIp, HttpError, json, readJson, type Ctx } from './http';
import { exigirNoBloqueado, racionar, sumarIntento } from './limites';

// Acceso por código (1 nov 2026). El dueño agrega a una persona con su nombre y lo que va a
// hacer (subir capturas o revisar), y le pasa un código. La persona lo escribe en la app y entra:
// sin correo, sin contraseña. El código sirve una vez y vence en 7 días; si la persona cambia
// de celular, el dueño le da otro código y entra a la misma cuenta de siempre.

export type RolAcceso = 'subidor' | 'validador';

const VIGENCIA = 7 * 24 * 3600 * 1000;
const SESION_DIAS = 365;
// Sin 0, O, 1, I ni L: se dicta por teléfono sin confusiones.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function nuevoCodigo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const c = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

/** «abcd 2345», «ABCD-2345» y «abcd2345» son el mismo código. */
export function normalizarCodigo(valor: string): string {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const hashDe = (codigo: string) => sha256Hex(`acceso:${normalizarCodigo(codigo)}`);

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, 'datos_invalidos', { campos: r.error.issues.map((i) => i.path.join('.')) });
  return r.data;
}

// ---------------------------------------------------------------- el dueño

export async function listarAccesos(env: Env, cuentaId: string, now: number) {
  const { results } = await env.DB.prepare(
    `SELECT id, nombre, rol, usuario_id IS NOT NULL AS activo,
       (codigo_hash IS NOT NULL AND codigo_expira_en > ?) AS codigo_pendiente, codigo_expira_en, creado_en
     FROM accesos WHERE cuenta_id = ? AND anulado_en IS NULL ORDER BY creado_en`,
  )
    .bind(now, cuentaId)
    .all<{ id: string; nombre: string; rol: RolAcceso; activo: number; codigo_pendiente: number; codigo_expira_en: number | null }>();
  return results.map((a) => ({ ...a, activo: a.activo === 1, codigo_pendiente: a.codigo_pendiente === 1 }));
}

export async function crearAcceso(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  exigirRol(m, 'dueno');
  const datos = parse(
    z.object({ nombre: z.string().trim().min(2).max(80), rol: z.enum(['subidor', 'validador']), pin: z.string() }),
    await readJson(ctx.req),
  );
  await verificarPin(ctx.env, u, m, datos.pin, ctx.now);
  const total = await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM accesos WHERE cuenta_id = ? AND anulado_en IS NULL')
    .bind(m.cuenta_id)
    .first<{ n: number }>();
  if ((total?.n ?? 0) >= 200) throw new HttpError(400, 'limite_accesos');
  const id = newId();
  const codigo = nuevoCodigo();
  await ctx.env.DB.prepare(
    `INSERT INTO accesos (id, cuenta_id, nombre, rol, codigo_hash, codigo_expira_en, creado_por, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, m.cuenta_id, datos.nombre, datos.rol, await hashDe(codigo), ctx.now + VIGENCIA, u.id, ctx.now)
    .run();
  return json({ ok: true, id, codigo, nombre: datos.nombre, rol: datos.rol, expira_en: ctx.now + VIGENCIA }, 201);
}

async function accesoDeLaCuenta(ctx: Ctx) {
  const u = await exigirUsuario(ctx);
  const m = await membresia(ctx.env, ctx.params.id ?? '', u.id);
  exigirRol(m, 'dueno');
  const a = await ctx.env.DB.prepare('SELECT id, nombre, rol, usuario_id FROM accesos WHERE id = ? AND cuenta_id = ? AND anulado_en IS NULL')
    .bind(ctx.params.acceso ?? '', m.cuenta_id)
    .first<{ id: string; nombre: string; rol: RolAcceso; usuario_id: string | null }>();
  if (!a) throw new HttpError(404, 'acceso_no_encontrado');
  const { pin } = parse(z.object({ pin: z.string() }), await readJson(ctx.req));
  await verificarPin(ctx.env, u, m, pin, ctx.now);
  return { m, a };
}

/** Otro código para la misma persona (cambió de celular, cerró sesión). El anterior deja de servir. */
export async function otroCodigo(ctx: Ctx): Promise<Response> {
  const { a } = await accesoDeLaCuenta(ctx);
  const codigo = nuevoCodigo();
  await ctx.env.DB.prepare('UPDATE accesos SET codigo_hash = ?, codigo_expira_en = ? WHERE id = ?')
    .bind(await hashDe(codigo), ctx.now + VIGENCIA, a.id)
    .run();
  return json({ ok: true, id: a.id, codigo, nombre: a.nombre, rol: a.rol, expira_en: ctx.now + VIGENCIA });
}

/** Quitar el acceso: la persona deja de ver la cuenta y el código deja de servir. */
export async function quitarAcceso(ctx: Ctx): Promise<Response> {
  const { m, a } = await accesoDeLaCuenta(ctx);
  const db = ctx.env.DB;
  await db.batch([
    db.prepare('UPDATE accesos SET anulado_en = ?, codigo_hash = NULL WHERE id = ?').bind(ctx.now, a.id),
    ...(a.usuario_id
      ? [
          db.prepare("DELETE FROM miembros WHERE cuenta_id = ? AND usuario_id = ? AND rol <> 'dueno'").bind(m.cuenta_id, a.usuario_id),
          db.prepare('DELETE FROM beneficiarios WHERE cuenta_id = ? AND usuario_id = ?').bind(m.cuenta_id, a.usuario_id),
        ]
      : []),
  ]);
  return json({ ok: true });
}

// ---------------------------------------------------------------- la persona

interface Vigente {
  id: string;
  cuenta_id: string;
  nombre: string;
  rol: RolAcceso;
  usuario_id: string | null;
  codigo_hash: string;
  cuenta_nombre: string;
  link_slug: string;
}

/** Busca el código con límite por IP: 10 códigos malos en 15 minutos bloquean 15 minutos. */
async function buscarCodigo(ctx: Ctx, codigo: string): Promise<Vigente> {
  const clave = `acceso-ip:${clientIp(ctx.req)}`;
  await exigirNoBloqueado(ctx.env, clave, ctx.now);
  const norm = normalizarCodigo(codigo);
  const a =
    norm.length === 8
      ? await ctx.env.DB.prepare(
          `SELECT a.id, a.cuenta_id, a.nombre, a.rol, a.usuario_id, a.codigo_hash, c.nombre AS cuenta_nombre, c.link_slug
           FROM accesos a JOIN cuentas c ON c.id = a.cuenta_id
           WHERE a.codigo_hash = ? AND a.codigo_expira_en > ? AND a.anulado_en IS NULL AND c.archivada_en IS NULL`,
        )
          .bind(await hashDe(norm), ctx.now)
          .first<Vigente>()
      : null;
  if (!a) {
    const quedan = await sumarIntento(ctx.env, clave, ctx.now, 10, 15, 15);
    throw new HttpError(400, 'codigo_acceso_invalido', { quedan });
  }
  return a;
}

/** Antes de entrar: a qué negocio da acceso y si hace falta crear un PIN. */
export async function verCodigo(ctx: Ctx): Promise<Response> {
  const { codigo } = parse(z.object({ codigo: z.string().max(40) }), await readJson(ctx.req));
  const a = await buscarCodigo(ctx, codigo);
  return json({ cuenta_nombre: a.cuenta_nombre, nombre: a.nombre, rol: a.rol, pide_pin: a.rol === 'validador' });
}

export async function entrarConCodigo(ctx: Ctx): Promise<Response> {
  const datos = parse(
    z.object({ codigo: z.string().max(40), pin: z.string().optional(), idioma: z.enum(['en', 'es']).default('en') }),
    await readJson(ctx.req),
  );
  const a = await buscarCodigo(ctx, datos.codigo);
  if (a.rol === 'validador' && !PIN_RE.test(datos.pin ?? '')) throw new HttpError(400, 'falta_pin');
  await racionar(ctx.env, `acceso-cuenta:${a.cuenta_id}`, ctx.now, 60, 60);

  // La persona de siempre si el código es un reemplazo; si no, quien ya tenga sesión abierta;
  // si no, una persona nueva solo con su nombre.
  const actual = await usuarioActual(ctx);
  const usuarioId = a.usuario_id ?? actual?.id ?? (await crearUsuarioSinCorreo(ctx.env, a.nombre, datos.idioma, ctx.now));
  const db = ctx.env.DB;
  const [marcado] = await db.batch<{ id: string }>([
    // El código se gasta aquí; dos celulares con el mismo código: entra solo el primero.
    db
      .prepare('UPDATE accesos SET usuario_id = ?, codigo_hash = NULL, codigo_expira_en = NULL WHERE id = ? AND codigo_hash = ? RETURNING id')
      .bind(usuarioId, a.id, a.codigo_hash),
    a.rol === 'validador'
      ? db
          .prepare(
            `INSERT INTO miembros (cuenta_id, usuario_id, rol, pin_hash, creado_en)
             SELECT ?, ?, 'validador', ?, ? WHERE EXISTS (SELECT 1 FROM accesos WHERE id = ? AND usuario_id = ? AND codigo_hash IS NULL)
             ON CONFLICT (cuenta_id, usuario_id) DO UPDATE SET pin_hash = excluded.pin_hash WHERE miembros.rol <> 'dueno'`,
          )
          .bind(a.cuenta_id, usuarioId, await hashSecret(datos.pin!), ctx.now, a.id, usuarioId)
      : db
          .prepare(
            `INSERT INTO beneficiarios (usuario_id, cuenta_id, agregado_en)
             SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM accesos WHERE id = ? AND usuario_id = ? AND codigo_hash IS NULL)
             ON CONFLICT DO NOTHING`,
          )
          .bind(usuarioId, a.cuenta_id, ctx.now, a.id, usuarioId),
  ]);
  if (!marcado?.results.length) throw new HttpError(400, 'codigo_acceso_invalido');
  const destino = a.rol === 'validador' ? `/accounts/${a.cuenta_id}` : `/pay/${a.link_slug}`;
  const cookie = actual?.id === usuarioId ? null : await abrirSesion(ctx.env, usuarioId, ctx.now, SESION_DIAS);
  return json({ ok: true, destino, rol: a.rol }, 200, cookie ? { 'set-cookie': cookie } : {});
}

/** Quien paga con el link entra solo con su nombre: sin correo, sin contraseña. */
export async function invitadoDelLink(ctx: Ctx): Promise<Response> {
  const datos = parse(
    z.object({ nombre: z.string().trim().min(2).max(80), idioma: z.enum(['en', 'es']).default('en') }),
    await readJson(ctx.req),
  );
  const slug = ctx.params.slug ?? '';
  const cuenta = /^[a-z0-9]{12}$/.test(slug)
    ? await ctx.env.DB.prepare('SELECT id FROM cuentas WHERE link_slug = ? AND archivada_en IS NULL').bind(slug).first<{ id: string }>()
    : null;
  if (!cuenta) throw new HttpError(404, 'link_invalido');
  await racionar(ctx.env, `invitado:${clientIp(ctx.req)}`, ctx.now, 10, 60);
  const id = await crearUsuarioSinCorreo(ctx.env, datos.nombre, datos.idioma, ctx.now);
  await ctx.env.DB.prepare('INSERT INTO beneficiarios (usuario_id, cuenta_id, agregado_en) VALUES (?, ?, ?)')
    .bind(id, cuenta.id, ctx.now)
    .run();
  const cookie = await abrirSesion(ctx.env, id, ctx.now, SESION_DIAS);
  return json({ ok: true }, 201, { 'set-cookie': cookie });
}
