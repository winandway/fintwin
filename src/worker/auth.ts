import { z } from 'zod';
import { MIN_CLAVE } from '../shared/reglas';
import { correoConfirmar, correoRestablecer, enviarCorreo } from './correo';
import { hashSecret, newId, randomToken, sha256Hex, verifySecret } from './crypto';
import type { Env } from './env';
import { clientIp, getCookie, HttpError, json, readJson, type Ctx } from './http';
import { exigirNoBloqueado, limpiarIntentos, racionar, sumarIntento } from './limites';

export const COOKIE = 'ft_sesion';
const DIA = 24 * 60 * 60 * 1000;
const SESION_DIAS = 30;

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  idioma: 'en' | 'es';
  confirmado_en: number | null;
}

function cookieSesion(token: string, maxAgeSeg: number): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeg}`;
}

export async function usuarioActual(ctx: Ctx): Promise<Usuario | null> {
  const token = getCookie(ctx.req, COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const fila = await ctx.env.DB.prepare(
    `SELECT u.id, u.email, u.nombre, u.idioma, u.confirmado_en FROM sesiones s
     JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.token_hash = ? AND s.expira_en > ? AND u.borrado_en IS NULL`,
  )
    .bind(await sha256Hex(token), ctx.now)
    .first<Usuario>();
  return fila ?? null;
}

export async function exigirUsuario(ctx: Ctx): Promise<Usuario> {
  const u = await usuarioActual(ctx);
  if (!u) throw new HttpError(401, 'sin_sesion');
  return u;
}

async function abrirSesion(env: Env, usuarioId: string, now: number): Promise<string> {
  const token = randomToken();
  await env.DB.prepare('INSERT INTO sesiones (token_hash, usuario_id, expira_en, creado_en) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), usuarioId, now + SESION_DIAS * DIA, now)
    .run();
  return cookieSesion(token, SESION_DIAS * 24 * 3600);
}

async function crearToken(env: Env, usuarioId: string, tipo: 'confirmar' | 'restablecer', vigenciaMs: number, now: number) {
  const token = randomToken();
  // Un enlace nuevo anula los anteriores del mismo tipo.
  await env.DB.batch([
    env.DB.prepare('UPDATE tokens SET usado_en = ? WHERE usuario_id = ? AND tipo = ? AND usado_en IS NULL').bind(
      now,
      usuarioId,
      tipo,
    ),
    env.DB.prepare(
      'INSERT INTO tokens (token_hash, usuario_id, tipo, expira_en, creado_en) VALUES (?, ?, ?, ?, ?)',
    ).bind(await sha256Hex(token), usuarioId, tipo, now + vigenciaMs, now),
  ]);
  return token;
}

async function usarToken(env: Env, token: string, tipo: 'confirmar' | 'restablecer', now: number): Promise<string> {
  if (!/^[0-9a-f]{64}$/.test(token)) throw new HttpError(400, 'enlace_invalido');
  const fila = await env.DB.prepare(
    `UPDATE tokens SET usado_en = ? WHERE token_hash = ? AND tipo = ? AND usado_en IS NULL AND expira_en > ?
     RETURNING usuario_id`,
  )
    .bind(now, await sha256Hex(token), tipo, now)
    .first<{ usuario_id: string }>();
  if (!fila) throw new HttpError(400, 'enlace_vencido');
  return fila.usuario_id;
}

export async function registrarError(env: Env, ruta: string, mensaje: string, now: number): Promise<void> {
  try {
    await env.DB.prepare('INSERT INTO errores (ruta, mensaje, creado_en) VALUES (?, ?, ?)')
      .bind(ruta, mensaje.slice(0, 2000), now)
      .run();
  } catch (e) {
    console.error('no se pudo guardar el error', e);
  }
}

async function mandar(ctx: Ctx, correo: Parameters<typeof enviarCorreo>[1]): Promise<boolean> {
  const ok = await enviarCorreo(ctx.env, correo);
  if (!ok) await registrarError(ctx.env, ctx.url.pathname, `correo no enviado a ${correo.to}: ${correo.subject}`, ctx.now);
  return ok;
}

/** Escudo anti-robots. Apagado si no está configurado; si Cloudflare no responde, deja pasar. */
async function verificarTurnstile(ctx: Ctx, token: unknown): Promise<void> {
  const secret = ctx.env.TURNSTILE_SECRET_KEY;
  if (!secret) return;
  if (typeof token !== 'string' || !token) throw new HttpError(400, 'verificacion_robot');
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token, remoteip: clientIp(ctx.req) }),
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean };
    if (!data.success) throw new HttpError(400, 'verificacion_robot');
  } catch (e) {
    if (e instanceof HttpError) throw e;
    console.error('turnstile no respondió, se deja pasar', e);
  }
}

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(200));
const claveSchema = z.string().min(MIN_CLAVE).max(200);
const idiomaSchema = z.enum(['en', 'es']).default('en');

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, 'datos_invalidos', { campos: r.error.issues.map((i) => i.path.join('.')) });
  return r.data;
}

export async function registro(ctx: Ctx): Promise<Response> {
  const body = await readJson(ctx.req);
  const datos = parse(
    z.object({
      nombre: z.string().trim().min(2).max(80),
      email: emailSchema,
      clave: claveSchema,
      idioma: idiomaSchema,
      turnstile: z.string().optional(),
    }),
    body,
  );
  await verificarTurnstile(ctx, datos.turnstile);
  await racionar(ctx.env, `registro:${clientIp(ctx.req)}`, ctx.now, 10, 60);

  const existe = await ctx.env.DB.prepare('SELECT id, confirmado_en FROM usuarios WHERE email = ?')
    .bind(datos.email)
    .first<{ id: string; confirmado_en: number | null }>();
  if (existe?.confirmado_en) throw new HttpError(409, 'correo_en_uso');

  const id = existe?.id ?? newId();
  const claveHash = await hashSecret(datos.clave);
  if (existe) {
    // Se registró antes y nunca confirmó: se actualiza y se manda otro enlace.
    await ctx.env.DB.prepare('UPDATE usuarios SET nombre = ?, clave_hash = ?, idioma = ? WHERE id = ?')
      .bind(datos.nombre, claveHash, datos.idioma, id)
      .run();
  } else {
    await ctx.env.DB.prepare(
      'INSERT INTO usuarios (id, email, nombre, clave_hash, idioma, creado_en) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(id, datos.email, datos.nombre, claveHash, datos.idioma, ctx.now)
      .run();
  }
  const token = await crearToken(ctx.env, id, 'confirmar', 2 * DIA, ctx.now);
  const enviado = await mandar(ctx, correoConfirmar(ctx.env, datos.email, datos.nombre, token, datos.idioma));
  return json({ ok: true, correo_enviado: enviado }, 201);
}

export async function confirmar(ctx: Ctx): Promise<Response> {
  const { token } = parse(z.object({ token: z.string() }), await readJson(ctx.req));
  const usuarioId = await usarToken(ctx.env, token, 'confirmar', ctx.now);
  await ctx.env.DB.prepare('UPDATE usuarios SET confirmado_en = COALESCE(confirmado_en, ?) WHERE id = ?')
    .bind(ctx.now, usuarioId)
    .run();
  const cookie = await abrirSesion(ctx.env, usuarioId, ctx.now);
  return json({ ok: true }, 200, { 'set-cookie': cookie });
}

export async function reenviarConfirmacion(ctx: Ctx): Promise<Response> {
  const { email } = parse(z.object({ email: emailSchema }), await readJson(ctx.req));
  await racionar(ctx.env, `correo:${email}`, ctx.now, 3, 60);
  const u = await ctx.env.DB.prepare(
    'SELECT id, nombre, idioma FROM usuarios WHERE email = ? AND confirmado_en IS NULL AND borrado_en IS NULL',
  )
    .bind(email)
    .first<{ id: string; nombre: string; idioma: 'en' | 'es' }>();
  if (u) {
    const token = await crearToken(ctx.env, u.id, 'confirmar', 2 * DIA, ctx.now);
    await mandar(ctx, correoConfirmar(ctx.env, email, u.nombre, token, u.idioma));
  }
  // Misma respuesta exista o no: no se revela qué correos están registrados.
  return json({ ok: true });
}

export async function entrar(ctx: Ctx): Promise<Response> {
  const datos = parse(
    z.object({ email: emailSchema, clave: z.string().min(1).max(200), turnstile: z.string().optional() }),
    await readJson(ctx.req),
  );
  await verificarTurnstile(ctx, datos.turnstile);
  const claveEmail = `login:${datos.email}`;
  const claveIp = `login-ip:${clientIp(ctx.req)}`;
  await exigirNoBloqueado(ctx.env, claveEmail, ctx.now);
  await exigirNoBloqueado(ctx.env, claveIp, ctx.now);

  const u = await ctx.env.DB.prepare(
    'SELECT id, clave_hash, confirmado_en FROM usuarios WHERE email = ? AND borrado_en IS NULL',
  )
    .bind(datos.email)
    .first<{ id: string; clave_hash: string; confirmado_en: number | null }>();
  const ok = u ? await verifySecret(datos.clave, u.clave_hash) : false;
  if (!u || !ok) {
    const quedan = await sumarIntento(ctx.env, claveEmail, ctx.now, 8, 15, 15);
    await sumarIntento(ctx.env, claveIp, ctx.now, 40, 15, 15);
    throw new HttpError(401, 'credenciales', { quedan });
  }
  if (!u.confirmado_en) throw new HttpError(403, 'correo_sin_confirmar');
  await limpiarIntentos(ctx.env, claveEmail);
  const cookie = await abrirSesion(ctx.env, u.id, ctx.now);
  return json({ ok: true }, 200, { 'set-cookie': cookie });
}

export async function salir(ctx: Ctx): Promise<Response> {
  const token = getCookie(ctx.req, COOKIE);
  if (token) await ctx.env.DB.prepare('DELETE FROM sesiones WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return json({ ok: true }, 200, { 'set-cookie': cookieSesion('', 0) });
}

export async function olvide(ctx: Ctx): Promise<Response> {
  const datos = parse(z.object({ email: emailSchema, turnstile: z.string().optional() }), await readJson(ctx.req));
  await verificarTurnstile(ctx, datos.turnstile);
  await racionar(ctx.env, `correo:${datos.email}`, ctx.now, 3, 60);
  const u = await ctx.env.DB.prepare('SELECT id, nombre, idioma FROM usuarios WHERE email = ? AND borrado_en IS NULL')
    .bind(datos.email)
    .first<{ id: string; nombre: string; idioma: 'en' | 'es' }>();
  if (u) {
    const token = await crearToken(ctx.env, u.id, 'restablecer', 60 * 60 * 1000, ctx.now);
    await mandar(ctx, correoRestablecer(ctx.env, datos.email, u.nombre, token, u.idioma));
  }
  return json({ ok: true });
}

export async function restablecer(ctx: Ctx): Promise<Response> {
  const datos = parse(z.object({ token: z.string(), clave: claveSchema }), await readJson(ctx.req));
  const usuarioId = await usarToken(ctx.env, datos.token, 'restablecer', ctx.now);
  // Cambiar la contraseña cierra todas las sesiones abiertas; el correo queda confirmado
  // porque la persona demostró que lo recibe.
  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      'UPDATE usuarios SET clave_hash = ?, confirmado_en = COALESCE(confirmado_en, ?) WHERE id = ?',
    ).bind(await hashSecret(datos.clave), ctx.now, usuarioId),
    ctx.env.DB.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(usuarioId),
  ]);
  const u = await ctx.env.DB.prepare('SELECT email FROM usuarios WHERE id = ?').bind(usuarioId).first<{ email: string }>();
  if (u) await limpiarIntentos(ctx.env, `login:${u.email}`);
  const cookie = await abrirSesion(ctx.env, usuarioId, ctx.now);
  return json({ ok: true }, 200, { 'set-cookie': cookie });
}

export async function yo(ctx: Ctx): Promise<Response> {
  const u = await usuarioActual(ctx);
  if (!u) return json({ usuario: null });
  return json({ usuario: { id: u.id, email: u.email, nombre: u.nombre, idioma: u.idioma } });
}

export async function cambiarIdioma(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const { idioma } = parse(z.object({ idioma: z.enum(['en', 'es']) }), await readJson(ctx.req));
  await ctx.env.DB.prepare('UPDATE usuarios SET idioma = ? WHERE id = ?').bind(idioma, u.id).run();
  return json({ ok: true });
}

/**
 * Borrar mi usuario (lo exige Google Play). Se borran sus datos personales y sus
 * sesiones; sus cuentas propias se archivan. Los comprobantes que mandó a otra
 * empresa quedan en el registro de esa empresa, sin su nombre ni su correo.
 */
export async function borrarUsuario(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const { clave } = parse(z.object({ clave: z.string().min(1) }), await readJson(ctx.req));
  const fila = await ctx.env.DB.prepare('SELECT clave_hash FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ clave_hash: string }>();
  const claveIntentos = `borrar:${u.id}`;
  await exigirNoBloqueado(ctx.env, claveIntentos, ctx.now);
  if (!fila || !(await verifySecret(clave, fila.clave_hash))) {
    await sumarIntento(ctx.env, claveIntentos, ctx.now, 5, 15, 15);
    throw new HttpError(401, 'credenciales');
  }
  const db = ctx.env.DB;
  await db.batch([
    db.prepare('UPDATE cuentas SET archivada_en = ? WHERE dueno_id = ? AND archivada_en IS NULL').bind(ctx.now, u.id),
    db.prepare('DELETE FROM miembros WHERE cuenta_id IN (SELECT id FROM cuentas WHERE dueno_id = ?)').bind(u.id),
    db.prepare('DELETE FROM miembros WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM beneficiarios WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM tokens WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM dispositivos WHERE usuario_id = ?').bind(u.id),
    db.prepare(
      `UPDATE usuarios SET email = ?, nombre = 'Deleted user', clave_hash = '', confirmado_en = NULL, borrado_en = ?
       WHERE id = ?`,
    ).bind(`deleted-${u.id}@fintwin.invalid`, ctx.now, u.id),
  ]);
  return json({ ok: true }, 200, { 'set-cookie': cookieSesion('', 0) });
}
