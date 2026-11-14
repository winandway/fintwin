// Reglas compartidas entre las pantallas y el servidor.

export const PIN_RE = /^\d{4}$/;
export const MIN_CLAVE = 8;
export const MAX_ARCHIVO = 10 * 1024 * 1024;

/** El número de confirmación sin espacios, guiones ni puntos, en mayúsculas. */
export function normalizarConfirmacion(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const limpio = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return limpio.length >= 4 ? limpio : null;
}

/** «1,234.50», «$1234.5» o «1.234,50» → centavos. */
export function aCentavos(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) : null;
  let s = valor.replace(/[^0-9.,-]/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

export function formatoDinero(cent: number, idioma: 'en' | 'es' = 'en'): string {
  return new Intl.NumberFormat(idioma === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency: 'USD' }).format(
    cent / 100,
  );
}

export function comisionDe(montoCent: number, pct: number): number {
  return Math.round((montoCent * pct) / 100);
}

/** Tipos de pago que quien paga puede elegir en el link. «otro» lleva el nombre escrito a mano. */
export const TIPOS_PAGO = ['zelle', 'bolivares', 'dolares', 'transferencia', 'paypal', 'tarjeta', 'otro'] as const;
export type TipoPago = (typeof TIPOS_PAGO)[number];

/**
 * Lo que se guarda: la clave del tipo elegido, o el texto escrito si eligió «otro».
 * null si no eligió nada (es opcional). 'falta_otro' si eligió «otro» y no escribió cuál.
 */
export function tipoPagoAGuardar(tipo: unknown, otro: unknown): string | null | 'falta_otro' {
  const t = typeof tipo === 'string' ? tipo.trim() : '';
  if (!t) return null;
  if (!(TIPOS_PAGO as readonly string[]).includes(t)) return null;
  if (t !== 'otro') return t;
  const texto = (typeof otro === 'string' ? otro : '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return texto ? `otro:${texto}` : 'falta_otro';
}
