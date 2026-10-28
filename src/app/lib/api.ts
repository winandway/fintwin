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
  email: string;
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
  cuenta: { id: string; nombre: string; comision_pct: number; link_slug: string };
  rol: 'dueno' | 'validador';
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
  lectura: 'ia' | 'manual' | null;
  tiene_archivo: number;
  creado_en: number;
  revisado_en: number | null;
  subido_por_nombre: string | null;
  subido_por_email: string | null;
  revisado_por_nombre: string | null;
}
