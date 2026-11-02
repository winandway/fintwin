import { normalizarConfirmacion } from '../shared/reglas';
import { registrarError } from './auth';
import type { Imagen } from './archivos';
import type { Env } from './env';
import { iaDisponible, LECTURA_VACIA, leerCaptura, type Lectura } from './ocr';

// Lo común a las dos puertas de subida (el link de pago y la cuenta): leer la captura con IA una
// sola vez, encontrar repetidas y armar su historial de uso. Reglas copiadas del FinTwin original.

/**
 * Lee la captura con IA. La lectura queda guardada por la huella de la imagen: al elegir la foto se
 * lee y, al enviarla, se reutiliza sin pagar otra lectura. Sin IA configurada devuelve null. Si la IA
 * falla, la lectura sale «failed» (nunca rompe la subida) y el error queda registrado.
 */
export async function lecturaDe(env: Env, img: Imagen, cuentaNombre: string, now: number): Promise<Lectura | null> {
  if (!iaDisponible(env)) return null;
  const guardada = await env.DB.prepare('SELECT datos FROM lecturas_ia WHERE hash = ?').bind(img.hash).first<{ datos: string }>();
  if (guardada) {
    try {
      return { ...LECTURA_VACIA, ...(JSON.parse(guardada.datos) as Partial<Lectura>) };
    } catch {
      // Lectura vieja ilegible: se vuelve a leer.
    }
  }
  let lectura: Lectura;
  try {
    lectura = await leerCaptura(env, img.bytes, img.mime, cuentaNombre);
  } catch (e) {
    await registrarError(env, 'lectura IA', String(e), now);
    return { ...LECTURA_VACIA };
  }
  await env.DB.prepare(
    'INSERT INTO lecturas_ia (hash, datos, estado, creado_en) VALUES (?, ?, ?, ?) ON CONFLICT (hash) DO UPDATE SET datos = excluded.datos, estado = excluded.estado',
  )
    .bind(img.hash, JSON.stringify(lectura), lectura.estado, now)
    .run();
  return lectura;
}

export interface Repetida {
  id: string;
  cuenta_id: string;
  creado_en: number;
  coincide: 'imagen' | 'codigo';
}

/**
 * Otro ingreso con la misma imagen o el mismo número de confirmación, en CUALQUIER cuenta.
 * Los rechazados y cancelados no cuentan: ese número se puede volver a enviar.
 */
export async function buscarRepetida(env: Env, hash: string, confirmacion: string | null, cuentaId?: string): Promise<Repetida | null> {
  const norm = normalizarConfirmacion(confirmacion);
  const fila = await env.DB.prepare(
    `SELECT id, cuenta_id, creado_en, CASE WHEN archivo_hash = ? THEN 'imagen' ELSE 'codigo' END AS coincide
     FROM comprobantes
     WHERE tipo = 'ingreso' AND estado <> 'rechazado' AND (archivo_hash = ? OR (? IS NOT NULL AND confirmacion_norm = ?))
       ${cuentaId ? 'AND cuenta_id = ?' : ''}
     ORDER BY (archivo_hash = ?) DESC, creado_en DESC LIMIT 1`,
  )
    .bind(...[hash, hash, norm, norm, ...(cuentaId ? [cuentaId] : []), hash])
    .first<Repetida>();
  return fila ?? null;
}

export interface Uso {
  id: string;
  cuenta: string | null;
  otra_cuenta: boolean;
  monto_cent: number | null;
  confirmacion: string | null;
  estado: string;
  creado_en: number;
  coincide: 'imagen' | 'codigo';
}

/**
 * Todos los usos de una captura (misma imagen o mismo número), en todas las cuentas y con los
 * rechazados, del más nuevo al más viejo. De las cuentas donde la persona no está, no se muestra
 * ni el nombre ni el monto: son de otra empresa.
 */
export async function historialDeUso(env: Env, hash: string | null, confirmacion: string | null, usuarioId: string): Promise<Uso[]> {
  const norm = normalizarConfirmacion(confirmacion);
  if (!hash && !norm) return [];
  const { results } = await env.DB.prepare(
    `SELECT k.id, k.monto_cent, k.confirmacion, k.estado, k.creado_en, c.nombre AS cuenta,
       EXISTS (SELECT 1 FROM miembros m WHERE m.cuenta_id = k.cuenta_id AND m.usuario_id = ?) AS mia,
       CASE WHEN k.archivo_hash = ? THEN 'imagen' ELSE 'codigo' END AS coincide
     FROM comprobantes k JOIN cuentas c ON c.id = k.cuenta_id
     WHERE k.tipo = 'ingreso' AND ((? IS NOT NULL AND k.archivo_hash = ?) OR (? IS NOT NULL AND k.confirmacion_norm = ?))
     ORDER BY k.creado_en DESC LIMIT 50`,
  )
    .bind(usuarioId, hash, hash, hash, norm, norm)
    .all<{ id: string; monto_cent: number; confirmacion: string | null; estado: string; creado_en: number; cuenta: string; mia: number; coincide: 'imagen' | 'codigo' }>();
  return results.map((r) => ({
    id: r.id,
    cuenta: r.mia ? r.cuenta : null,
    otra_cuenta: !r.mia,
    monto_cent: r.mia ? r.monto_cent : null,
    confirmacion: r.mia ? r.confirmacion : null,
    estado: r.estado,
    creado_en: r.creado_en,
    coincide: r.coincide,
  }));
}

/** Las columnas de la lectura, en el orden en que se guardan. */
export function columnasLectura(l: Lectura | null): (string | number | null)[] {
  return [
    l?.fecha ?? null,
    l?.pagador ?? null,
    l?.pagador_correo ?? null,
    l?.beneficiario ?? null,
    l?.beneficiario_correo ?? null,
    l?.plataforma ?? null,
    l?.confianza ?? null,
    l ? l.estado : 'skipped',
    l?.monto_cent ?? null,
  ];
}

export const SQL_COLUMNAS_LECTURA =
  'fecha_pago, pagador, pagador_correo, beneficiario, beneficiario_correo, plataforma, confianza, lectura_estado, monto_leido_cent';
