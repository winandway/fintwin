import { z } from 'zod';
import { MIN_CLAVE } from '../shared/reglas';
import { correoConfirmar, correoRestablecer, enviarCorreo } from './correo';
import { hashSecret, newId, randomToken, sha256Hex, verifySecret } from './crypto';
import type { Env } from './env';
import { clientIp, getCookie, HttpError, json, readJson, type Ctx } from './http';
import { borrarCasosDe } from './casos';
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
  sin_correo: number;
}

function cookieSesion(token: string, maxAgeSeg: number): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeg}`;
}

export async function usuarioActual(ctx: Ctx): Promise<Usuario | null> {
  const token = getCookie(ctx.req, COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const fila = await ctx.env.DB.prepare(
    `SELECT u.id, u.email, u.nombre, u.idioma, u.confirmado_en, u.sin_correo FROM sesiones s
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

/** Quien entra con código no tiene contraseña para volver: su sesión dura un año. */
export async function abrirSesion(env: Env, usuarioId: string, now: number, dias = SESION_DIAS): Promise<string> {
  const token = randomToken();
  await env.DB.prepare('INSERT INTO sesiones (token_hash, usuario_id, expira_en, creado_en) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), usuarioId, now + dias * DIA, now)
    .run();
  return cookieSesion(token, dias * 24 * 3600);
}

/**
 * Persona sin correo ni contraseña: la que entra con el código que le dio el dueño o la que
 * paga con el link escribiendo solo su nombre. Queda confirmada; su correo es un marcador interno.
 */
export async function crearUsuarioSinCorreo(env: Env, nombre: string, idioma: 'en' | 'es', now: number): Promise<string> {
  const id = newId();
  await env.DB.prepare(
    `INSERT INTO usuarios (id, email, nombre, clave_hash, idioma, confirmado_en, creado_en, sin_correo)
     VALUES (?, ?, ?, '', ?, ?, ?, 1)`,
  )
    .bind(id, `sin-correo-${id}@fintwin.invalid`, nombre, idioma, now, now)
    .run();
  return id;
}

/** Seis números al azar para confirmar el correo escribiéndolos en la app. */
function codigoSeisNumeros(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, '0');
}

const hashCodigo = (usuarioId: string, codigo: string) => sha256Hex(`codigo:${usuarioId}:${codigo}`);

/**
 * Confirmar el correo: un enlace y un código de seis números, los dos de un solo uso y con la
 * misma vigencia. El código se escribe dentro de la app, sin salir al navegador.
 */
async function crearConfirmacion(env: Env, usuarioId: string, now: number): Promise<{ token: string; codigo: string }> {
  const token = await crearToken(env, usuarioId, 'confirmar', 2 * DIA, now);
  const codigo = codigoSeisNumeros();
  await env.DB.prepare('INSERT INTO tokens (token_hash, usuario_id, tipo, expira_en, creado_en) VALUES (?, ?, ?, ?, ?)')
    .bind(await hashCodigo(usuarioId, codigo), usuarioId, 'confirmar', now + 2 * DIA, now)
    .run();
  return { token, codigo };
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
  const { token, codigo } = await crearConfirmacion(ctx.env, id, ctx.now);
  const enviado = await mandar(ctx, correoConfirmar(ctx.env, datos.email, datos.nombre, token, codigo, datos.idioma));
  return json({ ok: true, correo_enviado: enviado }, 201);
}

async function marcarConfirmado(ctx: Ctx, usuarioId: string): Promise<Response> {
  await ctx.env.DB.batch([
    ctx.env.DB.prepare('UPDATE usuarios SET confirmado_en = COALESCE(confirmado_en, ?) WHERE id = ?').bind(ctx.now, usuarioId),
    ctx.env.DB.prepare("UPDATE tokens SET usado_en = ? WHERE usuario_id = ? AND tipo = 'confirmar' AND usado_en IS NULL").bind(
      ctx.now,
      usuarioId,
    ),
  ]);
  const cookie = await abrirSesion(ctx.env, usuarioId, ctx.now);
  return json({ ok: true }, 200, { 'set-cookie': cookie });
}

export async function confirmar(ctx: Ctx): Promise<Response> {
  const { token } = parse(z.object({ token: z.string() }), await readJson(ctx.req));
  try {
    return await marcarConfirmado(ctx, await usarToken(ctx.env, token, 'confirmar', ctx.now));
  } catch (e) {
    // Abrir otra vez el enlace de un correo que ya quedó confirmado no es un error para la persona.
    if (e instanceof HttpError && /^[0-9a-f]{64}$/.test(token)) {
      const ya = await ctx.env.DB.prepare(
        `SELECT 1 FROM tokens t JOIN usuarios u ON u.id = t.usuario_id
         WHERE t.token_hash = ? AND u.confirmado_en IS NOT NULL AND u.borrado_en IS NULL`,
      )
        .bind(await sha256Hex(token))
        .first();
      if (ya) throw new HttpError(409, 'ya_confirmado');
    }
    throw e;
  }
}

/** Confirmar escribiendo en la app el código de seis números del correo. 5 fallos bloquean 15 minutos. */
export async function confirmarCodigo(ctx: Ctx): Promise<Response> {
  const datos = parse(z.object({ email: emailSchema, codigo: z.string().trim() }), await readJson(ctx.req));
  const clave = `codigo:${datos.email}`;
  await exigirNoBloqueado(ctx.env, clave, ctx.now);
  const u = await ctx.env.DB.prepare('SELECT id, confirmado_en FROM usuarios WHERE email = ? AND borrado_en IS NULL')
    .bind(datos.email)
    .first<{ id: string; confirmado_en: number | null }>();
  if (u?.confirmado_en) throw new HttpError(409, 'ya_confirmado');
  const valido = u && /^\d{6}$/.test(datos.codigo)
    ? await ctx.env.DB.prepare(
        `UPDATE tokens SET usado_en = ? WHERE token_hash = ? AND usuario_id = ? AND tipo = 'confirmar'
         AND usado_en IS NULL AND expira_en > ? RETURNING usuario_id`,
      )
        .bind(ctx.now, await hashCodigo(u.id, datos.codigo), u.id, ctx.now)
        .first()
    : null;
  if (!u || !valido) {
    const quedan = await sumarIntento(ctx.env, clave, ctx.now, 5, 15, 15);
    throw new HttpError(400, 'codigo_incorrecto', { quedan });
  }
  await limpiarIntentos(ctx.env, clave);
  return marcarConfirmado(ctx, u.id);
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
    const { token, codigo } = await crearConfirmacion(ctx.env, u.id, ctx.now);
    await mandar(ctx, correoConfirmar(ctx.env, email, u.nombre, token, codigo, u.idioma));
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
  const sinCorreo = u.sin_correo === 1;
  return json({ usuario: { id: u.id, email: sinCorreo ? null : u.email, nombre: u.nombre, idioma: u.idioma, sin_correo: sinCorreo } });
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
 * empresa quedan en el registro de esa empresa, sin su nombre ni su correo. Sus casos de
 * ayuda y sus capturas se borran.
 */
export async function borrarUsuario(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  // Quien entró con código no tiene contraseña: le basta su sesión abierta.
  if (u.sin_correo !== 1) {
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
  }
  const db = ctx.env.DB;
  const casos = await borrarCasosDe(ctx.env, u.id);
  await db.batch([
    ...casos,
    db.prepare('UPDATE cuentas SET archivada_en = ? WHERE dueno_id = ? AND archivada_en IS NULL').bind(ctx.now, u.id),
    db.prepare('DELETE FROM miembros WHERE cuenta_id IN (SELECT id FROM cuentas WHERE dueno_id = ?)').bind(u.id),
    db.prepare('DELETE FROM miembros WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM beneficiarios WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM tokens WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM dispositivos WHERE usuario_id = ?').bind(u.id),
    db.prepare('UPDATE accesos SET anulado_en = ?, codigo_hash = NULL WHERE usuario_id = ? AND anulado_en IS NULL').bind(ctx.now, u.id),
    db.prepare('UPDATE accesos SET anulado_en = ?, codigo_hash = NULL WHERE cuenta_id IN (SELECT id FROM cuentas WHERE dueno_id = ?) AND anulado_en IS NULL').bind(ctx.now, u.id),
    db.prepare(
      `UPDATE usuarios SET email = ?, nombre = 'Deleted user', clave_hash = '', confirmado_en = NULL, borrado_en = ?, sin_correo = 0
       WHERE id = ?`,
    ).bind(`deleted-${u.id}@fintwin.invalid`, ctx.now, u.id),
  ]);
  return json({ ok: true }, 200, { 'set-cookie': cookieSesion('', 0) });
}
