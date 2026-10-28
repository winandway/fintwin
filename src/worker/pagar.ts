import { aCentavos, MAX_ARCHIVO, normalizarConfirmacion } from '../shared/reglas';
import { exigirUsuario, registrarError } from './auth';
import { newId, sha256Hex } from './crypto';
import { HttpError, json, type Ctx } from './http';
import { racionar } from './limites';
import { iaDisponible, leerCaptura, type Lectura } from './ocr';

const TIPOS: { mime: string; ext: string; firma: (b: Uint8Array) => boolean }[] = [
  { mime: 'image/jpeg', ext: 'jpg', firma: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', firma: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    mime: 'image/webp',
    ext: 'webp',
    firma: (b) => String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP',
  },
];

/** El tipo REAL del archivo, por sus primeros bytes; no se cree lo que diga el navegador. */
export function tipoReal(bytes: Uint8Array): { mime: string; ext: string } | null {
  const t = TIPOS.find((x) => x.firma(bytes));
  return t ? { mime: t.mime, ext: t.ext } : null;
}

async function cuentaPorSlug(ctx: Ctx) {
  const slug = ctx.params.slug ?? '';
  if (!/^[a-z0-9]{12}$/.test(slug)) return null;
  return ctx.env.DB.prepare('SELECT id, nombre FROM cuentas WHERE link_slug = ? AND archivada_en IS NULL')
    .bind(slug)
    .first<{ id: string; nombre: string }>();
}

export async function verLinkDePago(ctx: Ctx): Promise<Response> {
  const c = await cuentaPorSlug(ctx);
  if (!c) return json({ valido: false });
  return json({ valido: true, nombre: c.nombre, lectura_ia: iaDisponible(ctx.env) });
}

export async function subirCaptura(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const cuenta = await cuentaPorSlug(ctx);
  if (!cuenta) throw new HttpError(404, 'link_invalido');
  await racionar(ctx.env, `subir:${u.id}`, ctx.now, 30, 60);

  let form: FormData;
  try {
    form = await ctx.req.formData();
  } catch {
    throw new HttpError(400, 'archivo_invalido');
  }
  const archivo = form.get('archivo');
  if (!archivo || typeof archivo === 'string') throw new HttpError(400, 'archivo_invalido');
  if (archivo.size > MAX_ARCHIVO) throw new HttpError(413, 'archivo_grande');
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const tipo = tipoReal(bytes);
  if (!tipo) throw new HttpError(415, 'no_es_imagen');

  const hash = await sha256Hex(bytes);
  const mismaImagen = await ctx.env.DB.prepare(
    "SELECT id FROM comprobantes WHERE archivo_hash = ? AND estado <> 'rechazado' LIMIT 1",
  )
    .bind(hash)
    .first();
  if (mismaImagen) throw new HttpError(409, 'captura_repetida');

  let lectura: Lectura;
  let modo: 'ia' | 'manual';
  if (iaDisponible(ctx.env)) {
    try {
      lectura = await leerCaptura(ctx.env, bytes, tipo.mime);
      modo = 'ia';
    } catch (e) {
      await registrarError(ctx.env, ctx.url.pathname, `lectura IA: ${String(e)}`, ctx.now);
      throw new HttpError(503, 'lectura_no_disponible');
    }
    if (!lectura.es_comprobante) throw new HttpError(422, 'no_es_comprobante');
  } else {
    // Sin IA configurada, quien paga escribe el monto y el número; el validador lo compara con la imagen.
    lectura = {
      es_comprobante: true,
      monto_cent: aCentavos(String(form.get('monto') ?? '')),
      fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(form.get('fecha') ?? '')) ? String(form.get('fecha')) : null,
      confirmacion: String(form.get('confirmacion') ?? '').trim().slice(0, 60) || null,
      pagador: null,
      beneficiario: null,
    };
    modo = 'manual';
  }

  const norm = normalizarConfirmacion(lectura.confirmacion);
  if (!norm) throw new HttpError(422, 'sin_confirmacion', { lectura });
  if (!lectura.monto_cent) throw new HttpError(422, 'sin_monto', { lectura });

  const repetida = await ctx.env.DB.prepare(
    "SELECT id FROM comprobantes WHERE confirmacion_norm = ? AND estado <> 'rechazado' LIMIT 1",
  )
    .bind(norm)
    .first();
  if (repetida) throw new HttpError(409, 'confirmacion_repetida', { confirmacion: lectura.confirmacion });

  const id = newId();
  const clave = `comprobantes/${cuenta.id}/${id}.${tipo.ext}`;
  await ctx.env.BUCKET.put(clave, bytes, { httpMetadata: { contentType: tipo.mime } });
  try {
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        `INSERT INTO comprobantes (id, cuenta_id, subido_por, tipo, estado, monto_cent, fecha_pago, confirmacion,
           confirmacion_norm, pagador, beneficiario, lectura, archivo_clave, archivo_hash, archivo_tipo, creado_en)
         VALUES (?, ?, ?, 'ingreso', 'pendiente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        id,
        cuenta.id,
        u.id,
        lectura.monto_cent,
        lectura.fecha,
        lectura.confirmacion,
        norm,
        lectura.pagador,
        lectura.beneficiario,
        modo,
        clave,
        hash,
        tipo.mime,
        ctx.now,
      ),
      ctx.env.DB.prepare(
        'INSERT INTO beneficiarios (usuario_id, cuenta_id, agregado_en) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
      ).bind(u.id, cuenta.id, ctx.now),
    ]);
  } catch (e) {
    // Dos envíos simultáneos del mismo número: el índice único deja entrar solo uno.
    await ctx.env.BUCKET.delete(clave);
    if (String(e).includes('UNIQUE')) throw new HttpError(409, 'confirmacion_repetida');
    throw e;
  }
  return json({ ok: true, id, lectura: { ...lectura, modo } }, 201);
}

export async function misPagos(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const empresas = await ctx.env.DB.prepare(
    `SELECT c.nombre, c.link_slug FROM beneficiarios b JOIN cuentas c ON c.id = b.cuenta_id
     WHERE b.usuario_id = ? AND c.archivada_en IS NULL ORDER BY b.agregado_en DESC`,
  )
    .bind(u.id)
    .all();
  const comprobantes = await ctx.env.DB.prepare(
    `SELECT k.id, k.estado, k.monto_cent, k.fecha_pago, k.confirmacion, k.creado_en, c.nombre AS cuenta_nombre
     FROM comprobantes k JOIN cuentas c ON c.id = k.cuenta_id
     WHERE k.subido_por = ? AND k.tipo = 'ingreso' ORDER BY k.creado_en DESC LIMIT 100`,
  )
    .bind(u.id)
    .all();
  return json({ empresas: empresas.results, comprobantes: comprobantes.results });
}

/** La imagen solo la ve quien la subió y el equipo de la cuenta. Nunca por una dirección pública. */
export async function verArchivo(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const fila = await ctx.env.DB.prepare(
    `SELECT k.archivo_clave, k.archivo_tipo FROM comprobantes k
     WHERE k.id = ? AND k.archivo_clave IS NOT NULL AND (k.subido_por = ? OR EXISTS (
       SELECT 1 FROM miembros m JOIN cuentas c ON c.id = m.cuenta_id
       WHERE m.cuenta_id = k.cuenta_id AND m.usuario_id = ? AND c.archivada_en IS NULL))`,
  )
    .bind(ctx.params.id ?? '', u.id, u.id)
    .first<{ archivo_clave: string; archivo_tipo: string }>();
  if (!fila) throw new HttpError(404, 'no_encontrado');
  const obj = await ctx.env.BUCKET.get(fila.archivo_clave);
  if (!obj) throw new HttpError(404, 'no_encontrado');
  return new Response(obj.body, {
    headers: {
      'content-type': fila.archivo_tipo,
      'cache-control': 'private, max-age=3600',
      'content-disposition': 'inline',
    },
  });
}
