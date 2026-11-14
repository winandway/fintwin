import { aCentavos, normalizarConfirmacion, tipoPagoAGuardar } from '../shared/reglas';
import { exigirUsuario } from './auth';
import { leerImagen, textoCorto } from './archivos';
import { buscarRepetida, columnasLectura, lecturaDe, SQL_COLUMNAS_LECTURA } from './capturas';
import { newId } from './crypto';
import { HttpError, json, type Ctx } from './http';
import { racionar } from './limites';
import { avisarCapturaNueva } from './avisos';
import { iaDisponible, LECTURA_VACIA } from './ocr';

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
  return ctx.env.DB.prepare('SELECT id, nombre, exigir_confirmacion FROM cuentas WHERE link_slug = ? AND archivada_en IS NULL')
    .bind(slug)
    .first<{ id: string; nombre: string; exigir_confirmacion: number }>();
}

export async function verLinkDePago(ctx: Ctx): Promise<Response> {
  const c = await cuentaPorSlug(ctx);
  if (!c) return json({ valido: false });
  return json({ valido: true, nombre: c.nombre, lectura_ia: iaDisponible(ctx.env), exigir_confirmacion: c.exigir_confirmacion === 1 });
}

/**
 * Quien paga elige la foto y la IA la lee en ese momento, antes de enviar: así ve el número de
 * confirmación y el monto, y si falta el número se le dice ahí mismo. No guarda nada.
 */
export async function leerEnLink(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const cuenta = await cuentaPorSlug(ctx);
  if (!cuenta) throw new HttpError(404, 'link_invalido');
  await racionar(ctx.env, `leer:${u.id}`, ctx.now, 40, 60);
  const { archivo } = await leerImagen(ctx, 'archivo_invalido');
  const lectura = await lecturaDe(ctx.env, archivo, cuenta.nombre, ctx.now);
  // Se avisa ya, al elegir la foto, si ese comprobante ya se envió antes (en cualquier cuenta).
  const repetida = (await buscarRepetida(ctx.env, archivo.hash, lectura?.confirmacion ?? null)) !== null;
  return json({ lectura_ia: lectura !== null, lectura, repetida });
}

export async function subirCaptura(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const cuenta = await cuentaPorSlug(ctx);
  if (!cuenta) throw new HttpError(404, 'link_invalido');
  await racionar(ctx.env, `subir:${u.id}`, ctx.now, 30, 60);
  const { form, archivo } = await leerImagen(ctx, 'archivo_invalido');

  const lectura = await lecturaDe(ctx.env, archivo, cuenta.nombre, ctx.now);
  // El monto lo escribe (o corrige) quien pagó; si no escribió nada, va el que leyó la IA.
  const montoCent = aCentavos(String(form.get('monto') ?? '')) ?? lectura?.monto_cent ?? null;
  // Sin IA, quien paga escribe el número y el validador lo compara con la imagen.
  const confirmacion = lectura ? lectura.confirmacion : String(form.get('confirmacion') ?? '').trim().slice(0, 60) || null;
  const norm = normalizarConfirmacion(confirmacion);
  if (!montoCent) throw new HttpError(422, 'sin_monto', { lectura });
  if (montoCent > 1_000_000_000) throw new HttpError(422, 'monto_invalido');
  if (!norm && cuenta.exigir_confirmacion === 1) throw new HttpError(422, 'sin_confirmacion', { lectura });

  // Repetida en cualquier cuenta (sin contar rechazadas): no entra.
  if (await buscarRepetida(ctx.env, archivo.hash, confirmacion)) throw new HttpError(409, 'comprobante_repetido');

  const tipoPago = tipoPagoAGuardar(form.get('tipo_pago'), form.get('tipo_pago_otro'));
  if (tipoPago === 'falta_otro') throw new HttpError(422, 'tipo_pago_otro');

  const fechaManual = String(form.get('fecha') ?? '');
  const l = lectura ?? { ...LECTURA_VACIA, fecha: /^\d{4}-\d{2}-\d{2}$/.test(fechaManual) ? fechaManual : null };
  const id = newId();
  const clave = `comprobantes/${cuenta.id}/${id}.${archivo.ext}`;
  await ctx.env.BUCKET.put(clave, archivo.bytes, { httpMetadata: { contentType: archivo.mime } });
  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      `INSERT INTO comprobantes (id, cuenta_id, subido_por, tipo, estado, monto_cent, confirmacion, confirmacion_norm,
         ${SQL_COLUMNAS_LECTURA}, notas, lectura, via, archivo_clave, archivo_hash, archivo_tipo, creado_en, tipo_pago)
       VALUES (?, ?, ?, 'ingreso', 'pendiente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'link', ?, ?, ?, ?, ?)`,
    ).bind(
      id, cuenta.id, u.id, montoCent, confirmacion, norm, ...columnasLectura(lectura ? l : { ...l, estado: 'failed' }),
      textoCorto(form.get('nota'), 300), lectura ? 'ia' : 'manual', clave, archivo.hash, archivo.mime, ctx.now, tipoPago,
    ),
    ctx.env.DB.prepare(
      'INSERT INTO beneficiarios (usuario_id, cuenta_id, agregado_en) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
    ).bind(u.id, cuenta.id, ctx.now),
  ]);
  await avisarCapturaNueva(ctx.env, cuenta, montoCent, u.nombre, ctx.now);
  return json({ ok: true, id, lectura: { ...l, monto_cent: montoCent, confirmacion, modo: lectura ? 'ia' : 'manual' }, tipo_pago: tipoPago }, 201);
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
    `SELECT k.id, k.estado, k.monto_cent, k.fecha_pago, k.confirmacion, k.creado_en, c.nombre AS cuenta_nombre,
       c.link_slug, k.plataforma, k.tipo_pago, k.revisado_en, CASE WHEN k.estado = 'rechazado' THEN k.motivo END AS motivo
     FROM comprobantes k JOIN cuentas c ON c.id = k.cuenta_id
     WHERE k.subido_por = ? AND k.tipo = 'ingreso' AND COALESCE(k.via, 'link') = 'link' ORDER BY k.creado_en DESC LIMIT 100`,
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
