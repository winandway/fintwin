import { MAX_ARCHIVO } from '../shared/reglas';
import { sha256Hex } from './crypto';
import { HttpError, type Ctx } from './http';
import { CATEGORIAS } from './ocr';
import { tipoReal } from './pagar';

export interface Imagen {
  bytes: Uint8Array;
  mime: string;
  ext: string;
  hash: string;
}

/** Lee el formulario y su imagen. Revisa el tipo REAL y el tamaño; sin imagen, `faltante`. */
export async function leerImagen(ctx: Ctx, faltante: string): Promise<{ form: FormData; archivo: Imagen }> {
  let form: FormData;
  try {
    form = await ctx.req.formData();
  } catch {
    throw new HttpError(400, faltante);
  }
  const archivo = form.get('archivo');
  if (!archivo || typeof archivo === 'string' || archivo.size === 0) throw new HttpError(400, faltante);
  if (archivo.size > MAX_ARCHIVO) throw new HttpError(413, 'archivo_grande');
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const tipo = tipoReal(bytes);
  if (!tipo) throw new HttpError(415, 'no_es_imagen');
  return { form, archivo: { bytes, mime: tipo.mime, ext: tipo.ext, hash: await sha256Hex(bytes) } };
}

export function textoCorto(v: File | string | null, max = 80): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

export function categoriaValida(v: File | string | null): string | null {
  const c = textoCorto(v, 30)?.toLowerCase() ?? null;
  return c && (CATEGORIAS as readonly string[]).includes(c) ? c : null;
}

export function fechaValida(v: File | string | null): string | null {
  const f = textoCorto(v, 10);
  return f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : null;
}
