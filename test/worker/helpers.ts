/* eslint-disable @typescript-eslint/no-explicit-any -- las pruebas leen respuestas JSON libres */
import { vi } from 'vitest';
import worker from '../../src/worker/index';
import type { Env } from '../../src/worker/env';
import { crearBucket, crearD1 } from './d1';

export interface Correo {
  to: string;
  subject: string;
  text: string;
}

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

export function crearMundo(extra: Partial<Env> = {}) {
  const correos: Correo[] = [];
  const avisos: { to: string; title: string; body: string }[] = [];
  let gemini: unknown = null;
  const bucket = crearBucket();
  const env = {
    DB: crearD1(),
    BUCKET: bucket as unknown as R2Bucket,
    ASSETS: {
      fetch: async (req: Request) => {
        const p = new URL(req.url).pathname;
        // Igual que los estáticos del sitio: «/» es la portada y /index.html desvía a «/».
        if (p === '/') return new Response('<html>app</html>', { headers: { 'content-type': 'text/html' } });
        if (p === '/index.html') return new Response(null, { status: 307, headers: { location: '/' } });
        if (p === '/icon.png') return new Response('png', { headers: { 'content-type': 'image/png' } });
        return new Response('not found', { status: 404 });
      },
    } as unknown as Fetcher,
    MAIL_FROM: 'no-reply@fintwin.windoce.com',
    SITIO_TOKEN: 'token-de-prueba',
    ...extra,
  } as Env;

  // Ningún servicio real: el correo y la IA se simulan aquí.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const u = String(input instanceof Request ? input.url : input);
      if (u.includes('/api/hosting/correo/enviar')) {
        const b = JSON.parse(String(init?.body)) as { to: { address: string }[]; subject: string; text: string };
        correos.push({ to: b.to[0]!.address, subject: b.subject, text: b.text });
        return new Response('{"ok":true}');
      }
      if (u.includes('exp.host')) {
        const lista = JSON.parse(String(init?.body)) as { to: string; title: string; body: string }[];
        avisos.push(...lista);
        return new Response(JSON.stringify({ data: lista.map(() => ({ status: 'ok' })) }));
      }
      if (u.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(gemini) }] } }] }),
        );
      }
      throw new Error(`fetch inesperado: ${u}`);
    }),
  );

  async function call(
    method: string,
    path: string,
    opts: { body?: unknown; cookie?: string; form?: FormData; sinCabecera?: boolean } = {},
  ) {
    const headers: Record<string, string> = {};
    if (!opts.sinCabecera) headers['x-fintwin'] = '1';
    if (opts.cookie) headers.cookie = opts.cookie;
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    const res = await worker.fetch(new Request(`https://fintwin.windoce.com${path}`, { method, headers, body }), env);
    const setCookie = res.headers.get('set-cookie');
    const cookie = setCookie ? setCookie.split(';')[0] : undefined;
    const ct = res.headers.get('content-type') ?? '';
    const data = ct.includes('json') ? ((await res.json()) as Record<string, any>) : await res.text();
    return { status: res.status, data: data as any, cookie, headers: res.headers };
  }

  function tokenDe(correo: Correo | undefined): string {
    const m = /token=([0-9a-f]+)/.exec(correo?.text ?? '');
    if (!m?.[1]) throw new Error('el correo no trae enlace');
    return m[1];
  }

  /** Crea un usuario confirmado y devuelve su cookie de sesión. */
  async function usuario(email: string, nombre = 'Persona') {
    await call('POST', '/datos/auth/registro', { body: { nombre, email, clave: 'clave-segura-1' } });
    const r = await call('POST', '/datos/auth/confirmar', { body: { token: tokenDe(correos.at(-1)) } });
    return r.cookie!;
  }

  function captura(extra: Record<string, string> = {}, bytes: Uint8Array = PNG) {
    const f = new FormData();
    f.append('archivo', new Blob([bytes], { type: 'image/png' }), 'captura.png');
    for (const [k, v] of Object.entries(extra)) f.append(k, v);
    return f;
  }

  return {
    env,
    bucket,
    correos,
    avisos,
    call,
    tokenDe,
    usuario,
    captura,
    setGemini: (v: unknown) => (gemini = v),
  };
}
