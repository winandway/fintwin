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
