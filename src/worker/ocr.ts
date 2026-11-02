import { aCentavos, normalizarConfirmacion } from '../shared/reglas';
import type { Env } from './env';

export interface Lectura {
  es_comprobante: boolean;
  monto_cent: number | null;
  fecha: string | null;
  confirmacion: string | null;
  pagador: string | null;
  pagador_correo: string | null;
  beneficiario: string | null;
  beneficiario_correo: string | null;
  direccion: 'in' | 'out' | null;
  plataforma: string | null;
  confianza: number;
  /** success = monto + código + una de las partes con confianza ≥ 0.6; failed = sin monto o confianza 0. */
  estado: 'success' | 'partial' | 'failed';
}

// Modelo de texto aprobado y barato (regla global de modelos de IA).
const MODELO = 'gemini-2.5-flash';

// La misma instrucción del FinTwin original (Windoce Hub, analyze-receipt), palabra por palabra.
const PROMPT = `You are a payment receipt data extractor.
Analyze this image and extract fields as JSON.
Return ONLY valid JSON, no markdown, no explanations.
Schema:
{
  "amount": number or null,
  "confirmation_code": string or null,
  "sender_name": string or null,
  "sender_email": string or null,
  "recipient_name": string or null,
  "recipient_email": string or null,
  "direction": "in" or "out" or null,
  "transaction_date": ISO 8601 string or null,
  "platform": zelle|zinli|paypal|cashapp|venmo|other|null,
  "confidence": number 0 to 1
}
Rules:
- amount: the numeric amount sent or received. Not the balance. Not fees.
- confirmation_code: transaction/reference/confirmation code
- sender_name: person/business who SENT the money (the one with funds leaving)
- sender_email: sender email if visible
- recipient_name: person/business who RECEIVED the money (destination)
- recipient_email: recipient email if visible
- transaction_date: when the tx happened (ISO 8601)
- platform: payment app this receipt is from
- confidence: 1.0 perfect, 0.0 illegible
Extract BOTH sides when visible. In a 'money sent' capture, the
recipient info is usually clearest (name + email of destination).
In a 'money received' capture, the sender info is usually clearest.

DIRECTION DETECTION (critical):
You will be told the account name of 'our account' via a line that starts
with 'OUR_ACCOUNT:'. Decide the direction relative to this account:
- 'in' = money came INTO our account. This happens when the recipient
  (the party being paid) matches our account name — look for variations,
  LLC/INC suffixes, partial matches, or 'Enviado a <us>', 'Transferencia
  recibida', 'Money received from', 'Payment received'.
- 'out' = money went OUT of our account. This happens when the sender
  (the party paying) matches our account name — look for 'Desde <us>',
  'From <us>', 'Su pago fue enviado', 'Dinero enviado', 'Money sent'.
- null = account name is not clearly on either side, OR no account name
  was provided. DO NOT guess. Set direction to null.
Account name matching is fuzzy: 'Windoce' matches 'WINDOCE, LLC',
'Windoce LLC Operaciones', 'Windoce.com', etc. Be reasonably flexible.

If a field is unclear, set it to null. NEVER guess or make up data.
If the image is not a payment receipt, return all null and confidence 0.`;

const PLATAFORMAS = ['zelle', 'zinli', 'paypal', 'cashapp', 'venmo', 'other'];

function texto(v: unknown, max = 120): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

/** El PRIMER objeto JSON completo de la respuesta, contando llaves (candado C-OCR-JSON-1 del original). */
export function primerObjetoJson(raw: string): unknown {
  const s = raw.replace(/```(?:json)?/g, '');
  const inicio = s.indexOf('{');
  if (inicio < 0) throw new Error('No JSON object in model output');
  let nivel = 0;
  let enTexto = false;
  let escape = false;
  for (let i = inicio; i < s.length; i++) {
    const c = s[i];
    if (enTexto) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') enTexto = false;
      continue;
    }
    if (c === '"') enTexto = true;
    else if (c === '{') nivel++;
    else if (c === '}') {
      nivel--;
      if (nivel === 0) return JSON.parse(s.slice(inicio, i + 1));
    }
  }
  throw new Error('No JSON object in model output');
}

export function interpretar(crudo: unknown): Lectura {
  const o = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>;
  const fechaIso = texto(o.transaction_date ?? o.date);
  const fecha = fechaIso && /^\d{4}-\d{2}-\d{2}/.test(fechaIso) ? fechaIso.slice(0, 10) : null;
  const confirmacion = texto(o.confirmation_code ?? o.confirmation);
  const monto = aCentavos(typeof o.amount === 'number' || typeof o.amount === 'string' ? o.amount : null);
  const pagador = texto(o.sender_name ?? o.payer);
  const beneficiario = texto(o.recipient_name ?? o.payee);
  const plat = texto(o.platform, 20)?.toLowerCase() ?? null;
  const confianza = typeof o.confidence === 'number' && Number.isFinite(o.confidence) ? Math.max(0, Math.min(1, o.confidence)) : monto ? 0.5 : 0;
  const conf = normalizarConfirmacion(confirmacion) ? confirmacion : null;
  // Clasificación del original: la plataforma ya no es obligatoria.
  const estado: Lectura['estado'] =
    confianza === 0 || !monto ? 'failed' : conf && (pagador || beneficiario) && confianza >= 0.6 ? 'success' : 'partial';
  return {
    es_comprobante: o.is_receipt === true || estado !== 'failed',
    monto_cent: monto,
    fecha,
    confirmacion: conf,
    pagador,
    pagador_correo: texto(o.sender_email),
    beneficiario,
    beneficiario_correo: texto(o.recipient_email),
    direccion: o.direction === 'in' || o.direction === 'out' ? o.direction : null,
    plataforma: plat && PLATAFORMAS.includes(plat) ? plat : plat ? 'other' : null,
    confianza,
    estado,
  };
}

export const LECTURA_VACIA: Lectura = {
  es_comprobante: false, monto_cent: null, fecha: null, confirmacion: null, pagador: null, pagador_correo: null,
  beneficiario: null, beneficiario_correo: null, direccion: null, plataforma: null, confianza: 0, estado: 'failed',
};

function aBase64(bytes: Uint8Array): string {
  let bin = '';
  const paso = 0x8000;
  for (let i = 0; i < bytes.length; i += paso) bin += String.fromCharCode(...bytes.subarray(i, i + paso));
  return btoa(bin);
}

export function iaDisponible(env: Env): boolean {
  return Boolean(env.GEMINI_API_KEY);
}

const SIN_FILTROS = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'].map(
  (category) => ({ category, threshold: 'BLOCK_NONE' }),
);

async function llamarGemini(llave: string, partes: unknown[], maxTokens: number): Promise<unknown> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': llave },
    body: JSON.stringify({
      contents: [{ parts: partes }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
      safetySettings: SIN_FILTROS,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const e = new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`) as Error & { status?: number };
    e.status = res.status;
    throw e;
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!raw.trim()) throw new Error('Empty response from Gemini');
  return primerObjetoJson(raw);
}

/**
 * Llave principal; con 429/403 pasa a la de respaldo si existe; cualquier otro error reintenta una
 * vez a los 500 ms. Igual que el original.
 */
async function conRespaldo(env: Env, partes: unknown[], maxTokens: number): Promise<unknown> {
  try {
    return await llamarGemini(env.GEMINI_API_KEY ?? '', partes, maxTokens);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if ((status === 429 || status === 403) && env.GEMINI_API_KEY_BACKUP) return llamarGemini(env.GEMINI_API_KEY_BACKUP, partes, maxTokens);
    await new Promise((r) => setTimeout(r, 500));
    return llamarGemini(env.GEMINI_API_KEY ?? '', partes, maxTokens);
  }
}

/** Lee la captura en el servidor. Lanza si la IA no responde: quien llama decide qué hacer. */
export async function leerCaptura(env: Env, bytes: Uint8Array, mime: string, cuentaNombre?: string): Promise<Lectura> {
  const instruccion = `${PROMPT}\n\nOUR_ACCOUNT: ${cuentaNombre?.trim() || '(not provided)'}`;
  return interpretar(await conRespaldo(env, [{ text: instruccion }, { inline_data: { mime_type: mime, data: aBase64(bytes) } }], 2048));
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
  return interpretarTicket(await conRespaldo(env, [{ text: PROMPT_TICKET }, { inline_data: { mime_type: mime, data: aBase64(bytes) } }], 1024));
}
