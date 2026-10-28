import { aCentavos, normalizarConfirmacion } from '../shared/reglas';
import type { Env } from './env';

export interface Lectura {
  es_comprobante: boolean;
  monto_cent: number | null;
  fecha: string | null;
  confirmacion: string | null;
  pagador: string | null;
  beneficiario: string | null;
}

// Modelo de texto aprobado y barato (regla global de modelos de IA).
const MODELO = 'gemini-2.5-flash';

const PROMPT = `You read payment receipts: bank transfer screenshots, Zelle/Venmo/Cash App/PayPal confirmations, deposit slips and invoices.
Return JSON only. Fields:
- is_receipt: true only if the image is a payment receipt or invoice.
- amount: the amount paid as a number (no currency symbol), or null.
- date: the payment date as YYYY-MM-DD, or null.
- confirmation: the confirmation / reference / transaction number exactly as printed, or null if it is not visible in full.
- payer: who sent the money, or null.
- payee: who received the money, or null.
Never guess a confirmation number. If it is cut off or blurry, return null.`;

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null;
}

export function interpretar(crudo: unknown): Lectura {
  const o = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>;
  const fecha = texto(o.date);
  const confirmacion = texto(o.confirmation);
  return {
    es_comprobante: o.is_receipt === true,
    monto_cent: aCentavos(typeof o.amount === 'number' || typeof o.amount === 'string' ? o.amount : null),
    fecha: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
    confirmacion: normalizarConfirmacion(confirmacion) ? confirmacion : null,
    pagador: texto(o.payer),
    beneficiario: texto(o.payee),
  };
}

function aBase64(bytes: Uint8Array): string {
  let bin = '';
  const paso = 0x8000;
  for (let i = 0; i < bytes.length; i += paso) bin += String.fromCharCode(...bytes.subarray(i, i + paso));
  return btoa(bin);
}

export function iaDisponible(env: Env): boolean {
  return Boolean(env.GEMINI_API_KEY);
}

/** Lee la captura en el servidor. Lanza si la IA no responde: quien llama decide qué hacer. */
export async function leerCaptura(env: Env, bytes: Uint8Array, mime: string): Promise<Lectura> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY ?? '' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: aBase64(bytes) } }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  const limpio = raw.replace(/^```(?:json)?\s*|\s*```$/g, '');
  return interpretar(JSON.parse(limpio));
}

// ------------------------------------------------------------------ tickets de compra

export const CATEGORIAS = [
  'supermercado', 'restaurante', 'gasolina', 'farmacia', 'salud', 'servicios', 'transporte',
  'hogar', 'ropa', 'tecnologia', 'educacion', 'entretenimiento', 'arriendo', 'impuestos', 'proveedores', 'otros',
] as const;

export interface LecturaTicket {
  comercio: string | null;
  total_cent: number | null;
  fecha: string | null;
  categoria: string | null;
  resumen: string | null;
}

const PROMPT_TICKET = `You read purchase receipts and invoices (supermarket tickets, gas stations, restaurants, pharmacies,
utility bills, supplier invoices, online orders). Return JSON only:
- merchant: store or company name, or null
- total: the FINAL amount paid (after tax and discounts), as a number, or null
- date: YYYY-MM-DD or null
- category: one of ${CATEGORIAS.join('|')}, or null
- summary: what was bought, max 12 words, in the language of the receipt, or null
Never guess. If the image is not a receipt or invoice, return all null.`;

export function interpretarTicket(crudo: unknown): LecturaTicket {
  const o = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>;
  const fecha = texto(o.date);
  const cat = texto(o.category)?.toLowerCase() ?? null;
  return {
    comercio: texto(o.merchant),
    total_cent: aCentavos(typeof o.total === 'number' || typeof o.total === 'string' ? o.total : null),
    fecha: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
    categoria: cat ? ((CATEGORIAS as readonly string[]).includes(cat) ? cat : 'otros') : null,
    resumen: texto(o.summary),
  };
}

export async function leerTicket(env: Env, bytes: Uint8Array, mime: string): Promise<LecturaTicket> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY ?? '' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT_TICKET }, { inline_data: { mime_type: mime, data: aBase64(bytes) } }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  return interpretarTicket(JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')));
}
