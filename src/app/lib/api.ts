export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public data: Record<string, unknown>,
  ) {
    super(code);
  }
}

async function pedir<T>(method: string, path: string, body?: unknown | FormData): Promise<T> {
  const headers: Record<string, string> = { 'x-fintwin': '1' };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`/datos${path}`, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'sin_conexion', {});
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, String(data.error ?? 'error_interno'), data);
  return data as T;
}

export const api = {
  get: <T>(path: string) => pedir<T>('GET', path),
  post: <T>(path: string, body?: unknown) => pedir<T>('POST', path, body ?? {}),
  form: <T>(path: string, form: FormData) => pedir<T>('POST', path, form),
};

export interface Usuario {
  id: string;
  /** null para quien entró con un código o solo con su nombre. */
  email: string | null;
  sin_correo?: boolean;
  nombre: string;
  idioma: 'en' | 'es';
}

export interface CuentaLista {
  id: string;
  nombre: string;
  comision_pct: number;
  rol: 'dueno' | 'validador';
  total_cent: number;
  pendientes: number;
}

export interface Resumen {
  ingresos_cent: number;
  comision_cent: number;
  salidas_cent: number;
  total_cent: number;
  pendientes: number;
}

export interface CuentaDetalle {
  cuenta: { id: string; nombre: string; comision_pct: number; link_slug: string; exigir_confirmacion: boolean; creado_en: number };
  rol: 'dueno' | 'validador';
  clave_unica?: { activa: boolean; por_mi: boolean; nombre: string | null; en: number | null };
  resumen: Resumen;
  mes: Resumen & { mes: string };
}

export interface Comprobante {
  id: string;
  tipo: 'ingreso' | 'salida';
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  monto_cent: number;
  comision_cent: number;
  fecha_pago: string | null;
  confirmacion: string | null;
  pagador: string | null;
  beneficiario: string | null;
  motivo: string | null;
  comercio: string | null;
  categoria: string | null;
  lectura: 'ia' | 'manual' | null;
  tiene_archivo: number;
  creado_en: number;
  revisado_en: number | null;
  subido_por_nombre: string | null;
  subido_por_email?: string | null;
  revisado_por_nombre: string | null;
  notas?: string | null;
  en_espera?: number;
  via?: 'link' | 'cuenta' | null;
  plataforma?: string | null;
  monto_leido_cent?: number | null;
}

/** Un movimiento de la pantalla de la cuenta, con todo lo que leyó la IA. */
export interface Movimiento extends Comprobante {
  pagador_correo: string | null;
  beneficiario_correo: string | null;
  lectura_estado: string | null;
  /** Cuántas OTRAS veces se usó la misma captura o el mismo número, en todas las cuentas. */
  repetidas: number;
}

export interface Movimientos {
  periodo: string;
  mes_actual: string;
  meses: string[];
  movimientos: Movimiento[];
  cifras: { bruto_cent: number; comision_cent: number; comision_queda_cent: number; salidas_cent: number; cancelados_cent: number };
  total_cent: number;
  este_mes_cent: number;
  pendientes: number;
  ultimo: number | null;
}

/** Lo que leyó la IA de una captura de pago. */
export interface Lectura {
  monto_cent: number | null;
  fecha: string | null;
  confirmacion: string | null;
  pagador: string | null;
  pagador_correo: string | null;
  beneficiario: string | null;
  beneficiario_correo: string | null;
  plataforma: string | null;
  estado: 'success' | 'partial' | 'failed';
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

export type EstadoCaso = 'abierto' | 'respondido' | 'cerrado';

export interface CasoLista {
  id: string;
  numero: string;
  asunto: string;
  estado: EstadoCaso;
  actualizado_en: number;
}

export interface MensajeCaso {
  de: 'cliente' | 'soporte';
  fecha: string;
  texto: string;
  adjuntos: { nombre: string; tipo: string; url: string | null }[];
}
