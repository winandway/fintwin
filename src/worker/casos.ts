import { z } from 'zod';
import { exigirUsuario, registrarError } from './auth';
import { avisarUsuario } from './avisos';
import { appUrl, correoRespuestaCaso, enviarCorreo } from './correo';
import { newId, sha256Hex } from './crypto';
import type { Env } from './env';
import { clientIp, HttpError, json, readJson, type Ctx } from './http';
import { racionar } from './limites';

/**
 * C-CASOS-AYUDA (1 nov 2026, pedido de Richard por la sesión de su correo): la persona abre
 * casos de ayuda dentro de la app, con hasta 3 capturas, y ve las respuestas como un chat.
 * El gerente de correo los lee y los contesta por /datos/gerente con su secreto.
 * Las capturas viven en el almacén y solo se ven con un enlace firmado que vale 8 días.
 */
export const MAX_ADJUNTO = 10 * 1024 * 1024;
export const MAX_ADJUNTOS = 3;
const VIGENCIA_S = 8 * 24 * 60 * 60;

export const numeroDeCaso = (id: string) => id.slice(0, 8).toUpperCase();

/** JPG, PNG, WebP o HEIC (lo que manda el iPhone), por sus primeros bytes, no por lo que dice. */
export function tipoAdjunto(b: Uint8Array): { mime: string; ext: string } | null {
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b[0] === 0x89 && ascii(1, 3) === 'PNG') return { mime: 'image/png', ext: 'png' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (ascii(4, 4) === 'ftyp' && ['heic', 'heix', 'mif1', 'msf1', 'heim', 'heis'].includes(ascii(8, 4)))
    return { mime: 'image/heic', ext: 'heic' };
  return null;
}

async function firmar(env: Env, texto: string): Promise<string> {
  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.ARCHIVOS_FIRMA ?? ''),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(texto));
  return btoa(String.fromCharCode(...new Uint8Array(firma)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** El enlace firmado, o null si falta la llave de firma (nunca un enlace sin firma). */
export async function urlAdjunto(env: Env, id: string, now: number): Promise<string | null> {
  if (!env.ARCHIVOS_FIRMA) return null;
  const exp = Math.floor(now / 1000) + VIGENCIA_S;
  return `${appUrl(env)}/datos/adjuntos/${id}?exp=${exp}&firma=${await firmar(env, `${id}.${exp}`)}`;
}

/** Tiempo constante: se recorre todo, sin cortar en el primer carácter distinto. */
function iguales(a: string, b: string): boolean {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

interface FilaCaso {
  id: string;
  usuario_id: string;
  asunto: string;
  estado: 'abierto' | 'respondido' | 'cerrado';
  creado_en: number;
  actualizado_en: number;
}

interface Adjunto {
  nombre: string;
  tipo: string;
  url: string | null;
}

interface Mensaje {
  de: 'cliente' | 'soporte';
  fecha: string;
  texto: string;
  adjuntos: Adjunto[];
}

/** Los mensajes de cada caso, con sus capturas firmadas. */
async function mensajesDe(env: Env, ids: string[], now: number): Promise<Map<string, Mensaje[]>> {
  const mapa = new Map<string, Mensaje[]>();
  if (!ids.length) return mapa;
  const lista = JSON.stringify(ids);
  const [mensajes, adjuntos] = await Promise.all([
    env.DB.prepare(
      `SELECT id, caso_id, de, texto, creado_en FROM caso_mensajes
       WHERE caso_id IN (SELECT value FROM json_each(?)) ORDER BY creado_en, rowid`,
    )
      .bind(lista)
      .all<{ id: string; caso_id: string; de: 'cliente' | 'soporte'; texto: string; creado_en: number }>(),
    env.DB.prepare(
      `SELECT id, mensaje_id, nombre, tipo FROM caso_adjuntos
       WHERE caso_id IN (SELECT value FROM json_each(?)) ORDER BY creado_en, rowid`,
    )
      .bind(lista)
      .all<{ id: string; mensaje_id: string; nombre: string; tipo: string }>(),
  ]);
  const porMensaje = new Map<string, Adjunto[]>();
  for (const a of adjuntos.results) {
    const l = porMensaje.get(a.mensaje_id) ?? [];
    l.push({ nombre: a.nombre, tipo: a.tipo, url: await urlAdjunto(env, a.id, now) });
    porMensaje.set(a.mensaje_id, l);
  }
  for (const m of mensajes.results) {
    const l = mapa.get(m.caso_id) ?? [];
    l.push({
      de: m.de,
      fecha: new Date(m.creado_en).toISOString(),
      texto: m.texto,
      adjuntos: porMensaje.get(m.id) ?? [],
    });
    mapa.set(m.caso_id, l);
  }
  return mapa;
}

// ───────────────────────── La persona, con su sesión ─────────────────────────

const esquemaNuevo = z.object({ asunto: z.string().trim().min(3).max(120), texto: z.string().trim().min(1).max(4000) });
const esquemaMensaje = z.object({ texto: z.string().trim().min(1).max(4000) });

interface Archivo {
  nombre: string;
  bytes: Uint8Array;
  mime: string;
  ext: string;
}

/** Lee el formulario y sus capturas. Revisa cantidad, tamaño y tipo REAL antes de guardar nada. */
async function leerFormulario(ctx: Ctx): Promise<{ form: FormData; archivos: Archivo[] }> {
  let form: FormData;
  try {
    form = await ctx.req.formData();
  } catch {
    throw new HttpError(400, 'datos_invalidos');
  }
  const files = form.getAll('adjuntos').filter((f): f is File => typeof f !== 'string' && f.size > 0);
  if (files.length > MAX_ADJUNTOS) throw new HttpError(400, 'demasiados_adjuntos');
  const archivos: Archivo[] = [];
  for (const f of files) {
    if (f.size > MAX_ADJUNTO) throw new HttpError(413, 'archivo_grande');
    const bytes = new Uint8Array(await f.arrayBuffer());
    const tipo = tipoAdjunto(bytes);
    if (!tipo) throw new HttpError(415, 'no_es_imagen');
    const base = (f.name || 'captura').replace(/[^\w.\- ]+/g, '').slice(0, 60) || 'captura';
    archivos.push({ nombre: base, bytes, ...tipo });
  }
  return { form, archivos };
}

function campos(form: FormData, ...nombres: string[]): Record<string, unknown> {
  return Object.fromEntries(nombres.map((n) => [n, form.get(n) ?? '']));
}

/** Guarda el mensaje y sus capturas. Si la base falla, las capturas se borran del almacén. */
async function guardarMensaje(
  ctx: Ctx,
  casoId: string,
  texto: string,
  archivos: Archivo[],
  antes: D1PreparedStatement[],
): Promise<void> {
  const db = ctx.env.DB;
  const mensajeId = newId();
  const claves: string[] = [];
  const filas: D1PreparedStatement[] = [];
  for (const a of archivos) {
    const id = newId();
    const clave = `casos/${casoId}/${id}.${a.ext}`;
    await ctx.env.BUCKET.put(clave, a.bytes, { httpMetadata: { contentType: a.mime } });
    claves.push(clave);
    filas.push(
      db
        .prepare(
          'INSERT INTO caso_adjuntos (id, caso_id, mensaje_id, nombre, tipo, clave, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(id, casoId, mensajeId, a.nombre, a.mime, clave, ctx.now),
    );
  }
  try {
    await db.batch([
      ...antes,
      db
        .prepare("INSERT INTO caso_mensajes (id, caso_id, de, texto, creado_en) VALUES (?, ?, 'cliente', ?, ?)")
        .bind(mensajeId, casoId, texto, ctx.now),
      ...filas,
    ]);
  } catch (e) {
    for (const c of claves) await ctx.env.BUCKET.delete(c);
    throw e;
  }
}

export async function crearCaso(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  await racionar(ctx.env, `casos:${u.id}`, ctx.now, 20, 60);
  const { form, archivos } = await leerFormulario(ctx);
  const r = esquemaNuevo.safeParse(campos(form, 'asunto', 'texto'));
  if (!r.success) throw new HttpError(400, 'datos_invalidos', { campos: r.error.issues.map((i) => i.path.join('.')) });
  const id = newId();
  await guardarMensaje(ctx, id, r.data.texto, archivos, [
    ctx.env.DB.prepare(
      "INSERT INTO casos (id, usuario_id, asunto, estado, creado_en, actualizado_en) VALUES (?, ?, ?, 'abierto', ?, ?)",
    ).bind(id, u.id, r.data.asunto, ctx.now, ctx.now),
  ]);
  return json({ ok: true, id, numero: numeroDeCaso(id) }, 201);
}

export async function misCasos(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const { results } = await ctx.env.DB.prepare(
    `SELECT id, asunto, estado, actualizado_en FROM casos WHERE usuario_id = ? ORDER BY actualizado_en DESC LIMIT 100`,
  )
    .bind(u.id)
    .all<{ id: string; asunto: string; estado: string; actualizado_en: number }>();
  return json({ casos: results.map((c) => ({ ...c, numero: numeroDeCaso(c.id) })) });
}

async function casoPropio(ctx: Ctx, usuarioId: string): Promise<FilaCaso> {
  const c = await ctx.env.DB.prepare('SELECT * FROM casos WHERE id = ? AND usuario_id = ?')
    .bind(ctx.params.id ?? '', usuarioId)
    .first<FilaCaso>();
  if (!c) throw new HttpError(404, 'caso_no_encontrado');
  return c;
}

export async function verCaso(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const c = await casoPropio(ctx, u.id);
  const mensajes = await mensajesDe(ctx.env, [c.id], ctx.now);
  return json({
    caso: { id: c.id, numero: numeroDeCaso(c.id), asunto: c.asunto, estado: c.estado, creado_en: c.creado_en },
    mensajes: mensajes.get(c.id) ?? [],
  });
}

/** La persona escribe otra vez: el caso vuelve a quedar abierto para soporte. */
export async function escribirEnCaso(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const c = await casoPropio(ctx, u.id);
  await racionar(ctx.env, `casos:${u.id}`, ctx.now, 20, 60);
  const { form, archivos } = await leerFormulario(ctx);
  const r = esquemaMensaje.safeParse(campos(form, 'texto'));
  if (!r.success) throw new HttpError(400, 'datos_invalidos', { campos: ['texto'] });
  await guardarMensaje(ctx, c.id, r.data.texto, archivos, [
    ctx.env.DB.prepare("UPDATE casos SET estado = 'abierto', actualizado_en = ? WHERE id = ?").bind(ctx.now, c.id),
  ]);
  return json({ ok: true }, 201);
}

/** La captura, solo con su enlace firmado y vigente. */
export async function verAdjunto(ctx: Ctx): Promise<Response> {
  const id = ctx.params.id ?? '';
  const exp = ctx.url.searchParams.get('exp') ?? '';
  const firma = ctx.url.searchParams.get('firma') ?? '';
  const vigente = ctx.env.ARCHIVOS_FIRMA && /^\d{1,12}$/.test(exp) && Number(exp) * 1000 > ctx.now;
  if (!vigente || !iguales(await firmar(ctx.env, `${id}.${exp}`), firma)) throw new HttpError(403, 'enlace_vencido');
  const fila = await ctx.env.DB.prepare('SELECT clave, tipo FROM caso_adjuntos WHERE id = ?')
    .bind(id)
    .first<{ clave: string; tipo: string }>();
  const obj = fila ? await ctx.env.BUCKET.get(fila.clave) : null;
  if (!fila || !obj) throw new HttpError(404, 'no_encontrado');
  return new Response(obj.body, {
    headers: { 'content-type': fila.tipo, 'cache-control': 'private, max-age=3600', 'content-disposition': 'inline' },
  });
}

/** Al borrar el usuario se borran sus casos y sus capturas. */
export async function borrarCasosDe(env: Env, usuarioId: string): Promise<D1PreparedStatement[]> {
  const { results } = await env.DB.prepare(
    'SELECT a.clave FROM caso_adjuntos a JOIN casos c ON c.id = a.caso_id WHERE c.usuario_id = ?',
  )
    .bind(usuarioId)
    .all<{ clave: string }>();
  for (const a of results) await env.BUCKET.delete(a.clave);
  const deUsuario = 'SELECT id FROM casos WHERE usuario_id = ?';
  return [
    env.DB.prepare(`DELETE FROM caso_adjuntos WHERE caso_id IN (${deUsuario})`).bind(usuarioId),
    env.DB.prepare(`DELETE FROM caso_mensajes WHERE caso_id IN (${deUsuario})`).bind(usuarioId),
    env.DB.prepare('DELETE FROM casos WHERE usuario_id = ?').bind(usuarioId),
  ];
}

// ───────────────────────── El gerente de correo, con su secreto ─────────────────────────

/** Se comparan los hashes, en tiempo constante. Sin la variable, la puerta no existe para nadie. */
async function exigirGerente(ctx: Ctx): Promise<void> {
  // 30 por minuto: racionar deja pasar la llamada que cierra la ventana, por eso va 29.
  await racionar(ctx.env, `gerente:${clientIp(ctx.req)}`, ctx.now, 29, 1);
  const esperado = ctx.env.GERENTE_SECRETO;
  const cabecera = ctx.req.headers.get('authorization') ?? '';
  if (!esperado || !cabecera.startsWith('Bearer ')) throw new HttpError(401, 'no_autorizado');
  const [a, b] = await Promise.all([sha256Hex(cabecera.slice(7)), sha256Hex(esperado)]);
  if (!iguales(a, b)) throw new HttpError(401, 'no_autorizado');
}

export async function gerenteTickets(ctx: Ctx): Promise<Response> {
  await exigirGerente(ctx);
  const todos = ctx.url.searchParams.get('estado') === 'todos';
  const { results } = await ctx.env.DB.prepare(
    `SELECT c.id, c.asunto, c.estado, c.creado_en, u.nombre, u.idioma FROM casos c
     JOIN usuarios u ON u.id = c.usuario_id
     WHERE u.borrado_en IS NULL ${todos ? '' : "AND c.estado = 'abierto'"}
     ORDER BY c.actualizado_en DESC LIMIT 100`,
  ).all<{ id: string; asunto: string; estado: string; creado_en: number; nombre: string; idioma: string }>();
  const mensajes = await mensajesDe(
    ctx.env,
    results.map((c) => c.id),
    ctx.now,
  );
  // Sin correo, pagos ni datos financieros: nombre, idioma, asunto y el chat.
  return json({
    tickets: results.map((c) => ({
      id: c.id,
      numero: numeroDeCaso(c.id),
      app: 'fintwin',
      cliente_nombre: c.nombre,
      idioma: c.idioma === 'es' ? 'es' : 'en',
      asunto: c.asunto,
      estado: c.estado,
      creado: new Date(c.creado_en).toISOString(),
      mensajes: mensajes.get(c.id) ?? [],
    })),
  });
}

const esquemaRespuesta = z.object({
  texto: z.string().trim().min(1).max(4000),
  plantilla: z
    .string()
    .regex(/^P[1-9]$/)
    .optional(),
  cerrar: z.boolean().default(false),
});

export async function gerenteResponder(ctx: Ctx): Promise<Response> {
  await exigirGerente(ctx);
  const r = esquemaRespuesta.safeParse(await readJson(ctx.req));
  if (!r.success) throw new HttpError(400, 'datos_invalidos', { campos: r.error.issues.map((i) => i.path.join('.')) });
  const db = ctx.env.DB;
  const c = await db
    .prepare(
      `SELECT c.id, c.usuario_id, u.email, u.nombre, u.idioma FROM casos c
       JOIN usuarios u ON u.id = c.usuario_id WHERE c.id = ? AND u.borrado_en IS NULL`,
    )
    .bind(ctx.params.id ?? '')
    .first<{ id: string; usuario_id: string; email: string; nombre: string; idioma: 'en' | 'es' }>();
  if (!c) throw new HttpError(404, 'caso_no_encontrado');
  await db.batch([
    db
      .prepare(
        "INSERT INTO caso_mensajes (id, caso_id, de, texto, plantilla, creado_en) VALUES (?, ?, 'soporte', ?, ?, ?)",
      )
      .bind(newId(), c.id, r.data.texto, r.data.plantilla ?? null, ctx.now),
    db
      .prepare('UPDATE casos SET estado = ?, actualizado_en = ? WHERE id = ?')
      .bind(r.data.cerrar ? 'cerrado' : 'respondido', ctx.now, c.id),
  ]);
  const numero = numeroDeCaso(c.id);
  const es = c.idioma === 'es';
  const aviso = await avisarUsuario(
    ctx.env,
    c.usuario_id,
    {
      titulo: es ? `Te respondimos tu caso ${numero}` : `We replied to your case ${numero}`,
      cuerpo: r.data.texto.slice(0, 140),
      url: `/help/${c.id}`,
    },
    ctx.now,
  );
  // El correo, siempre. Si falla se dice en la respuesta y queda en el registro de errores.
  const correo = correoRespuestaCaso(ctx.env, c.email, c.nombre, { id: c.id, numero }, r.data.texto, c.idioma);
  const enviado = await enviarCorreo(ctx.env, correo);
  if (!enviado) await registrarError(ctx.env, ctx.url.pathname, `correo del caso ${numero} no enviado`, ctx.now);
  return json({ ok: true, numero, plantilla: r.data.plantilla ?? null, aviso, correo: enviado ? 'ok' : 'error' });
}
