import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearMundo, PNG } from './helpers';

/**
 * C-CASOS-AYUDA (1 nov 2026): la persona abre casos de ayuda con capturas y ve las respuestas;
 * el gerente de correo los lee y los contesta con su secreto. Responder avisa al celular y manda
 * el correo; si algo falla, se dice en la respuesta.
 */
afterEach(() => vi.unstubAllGlobals());

const SECRETO = 'g'.repeat(48);
const VARIABLES = { GERENTE_SECRETO: SECRETO, ARCHIVOS_FIRMA: 'f'.repeat(48) };
const HEIC = new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode('ftypheic'), 0, 0, 0, 0]);

function formulario(campos: Record<string, string>, archivos: Uint8Array[] = []) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  archivos.forEach((b, i) => f.append('adjuntos', new Blob([b]), `captura-${i + 1}.png`));
  return f;
}

async function escenario(extra = {}) {
  const w = crearMundo({ ...VARIABLES, ...extra });
  const ana = await w.usuario('ana@example.com', 'Ana Ayuda');
  const gerente = (method: string, path: string, body?: unknown, secreto = SECRETO) =>
    w.call(method, path, { body, sinCabecera: true, headers: { authorization: `Bearer ${secreto}` } });
  return { w, ana, gerente };
}

async function abrirCaso(w: ReturnType<typeof crearMundo>, cookie: string, archivos: Uint8Array[] = [PNG]) {
  const r = await w.call('POST', '/datos/casos', {
    cookie,
    form: formulario({ asunto: 'No veo mi comprobante', texto: 'Lo subí ayer y no aparece.' }, archivos),
  });
  expect(r.status).toBe(201);
  return r.data.id as string;
}

describe('casos de ayuda de la persona', () => {
  it('abre un caso con capturas, lo ve en su lista y como chat', async () => {
    const { w, ana } = await escenario();
    const id = await abrirCaso(w, ana, [PNG, HEIC]);
    expect(w.bucket.store.size).toBe(2);

    const lista = await w.call('GET', '/datos/casos', { cookie: ana });
    expect(lista.data.casos).toEqual([
      expect.objectContaining({ id, numero: id.slice(0, 8).toUpperCase(), asunto: 'No veo mi comprobante', estado: 'abierto' }),
    ]);

    const caso = await w.call('GET', `/datos/casos/${id}`, { cookie: ana });
    expect(caso.data.mensajes).toHaveLength(1);
    const adjuntos = caso.data.mensajes[0].adjuntos as { tipo: string; url: string }[];
    expect(adjuntos.map((a) => a.tipo)).toEqual(['image/png', 'image/heic']);
    expect(adjuntos[0]!.url).toMatch(/^https:\/\/fintwin\.windoce\.com\/datos\/adjuntos\/[0-9a-f]+\?exp=\d+&firma=/);

    const img = await w.call('GET', new URL(adjuntos[0]!.url).pathname + new URL(adjuntos[0]!.url).search);
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toBe('image/png');
  });

  it('el enlace de la captura no sirve si se toca la firma o si venció', async () => {
    const { w, ana } = await escenario();
    const id = await abrirCaso(w, ana);
    const url = new URL((await w.call('GET', `/datos/casos/${id}`, { cookie: ana })).data.mensajes[0].adjuntos[0].url);
    const malo = await w.call('GET', `${url.pathname}?exp=${url.searchParams.get('exp')}&firma=otra`);
    expect(malo.status).toBe(403);
    // Ocho días después ya no abre.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 9 * 24 * 3600 * 1000);
    const vencido = await w.call('GET', url.pathname + url.search);
    expect(vencido.status).toBe(403);
  });

  it('máximo 3 capturas, solo imágenes de verdad, y sin texto no entra', async () => {
    const { w, ana } = await escenario();
    const cuatro = await w.call('POST', '/datos/casos', {
      cookie: ana,
      form: formulario({ asunto: 'Ayuda', texto: 'hola' }, [PNG, PNG, PNG, PNG]),
    });
    expect(cuatro.data.error).toBe('demasiados_adjuntos');
    const pdf = await w.call('POST', '/datos/casos', {
      cookie: ana,
      form: formulario({ asunto: 'Ayuda', texto: 'hola' }, [new TextEncoder().encode('%PDF-1.7')]),
    });
    expect(pdf.status).toBe(415);
    const vacio = await w.call('POST', '/datos/casos', { cookie: ana, form: formulario({ asunto: 'Ayuda', texto: ' ' }) });
    expect(vacio.status).toBe(400);
    expect(w.bucket.store.size).toBe(0);
  });

  it('nadie más ve el caso, y sin sesión no se abre', async () => {
    const { w, ana } = await escenario();
    const id = await abrirCaso(w, ana);
    const otro = await w.usuario('otro@example.com');
    expect((await w.call('GET', `/datos/casos/${id}`, { cookie: otro })).status).toBe(404);
    expect((await w.call('GET', '/datos/casos')).status).toBe(401);
  });

  it('al borrar el usuario se borran sus casos y sus capturas', async () => {
    const { w, ana, gerente } = await escenario();
    await abrirCaso(w, ana);
    await w.call('POST', '/datos/yo/borrar', { cookie: ana, body: { clave: 'clave-segura-1' } });
    expect(w.bucket.store.size).toBe(0);
    expect((await gerente('GET', '/datos/gerente/tickets?estado=todos')).data.tickets).toEqual([]);
  });
});

describe('puerta del gerente de correo', () => {
  it('sin el secreto, con uno malo o sin la variable configurada da 401', async () => {
    const { w, gerente } = await escenario();
    expect((await w.call('GET', '/datos/gerente/tickets')).status).toBe(401);
    expect((await gerente('GET', '/datos/gerente/tickets', undefined, 'h'.repeat(48))).status).toBe(401);
    const sin = crearMundo();
    const r = await sin.call('GET', '/datos/gerente/tickets', { headers: { authorization: `Bearer ${SECRETO}` } });
    expect(r.status).toBe(401);
  });

  it('frena a quien prueba secretos: más de 30 por minuto da 429', async () => {
    const { gerente } = await escenario();
    for (let i = 0; i < 30; i++) expect((await gerente('GET', '/datos/gerente/tickets', undefined, 'x')).status).toBe(401);
    expect((await gerente('GET', '/datos/gerente/tickets')).status).toBe(429);
  });

  it('lista los abiertos con el chat y sin correo ni datos de pago', async () => {
    const { w, ana, gerente } = await escenario();
    const id = await abrirCaso(w, ana);
    const r = await gerente('GET', '/datos/gerente/tickets?estado=abiertos');
    expect(r.status).toBe(200);
    expect(r.data.tickets).toEqual([
      {
        id,
        numero: id.slice(0, 8).toUpperCase(),
        app: 'fintwin',
        cliente_nombre: 'Ana Ayuda',
        idioma: 'en',
        asunto: 'No veo mi comprobante',
        estado: 'abierto',
        creado: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        mensajes: [
          {
            de: 'cliente',
            fecha: expect.stringMatching(/Z$/),
            texto: 'Lo subí ayer y no aparece.',
            adjuntos: [{ nombre: 'captura-1.png', tipo: 'image/png', url: expect.stringContaining('/datos/adjuntos/') }],
          },
        ],
      },
    ]);
    expect(JSON.stringify(r.data)).not.toContain('ana@example.com');
  });

  it('responder guarda el mensaje, avisa al celular, manda el correo y cierra si se pide', async () => {
    const { w, ana, gerente } = await escenario();
    await w.call('POST', '/datos/yo/dispositivo', { cookie: ana, body: { token: 'ExponentPushToken[abc]', plataforma: 'ios' } });
    const id = await abrirCaso(w, ana);
    const r = await gerente('POST', `/datos/gerente/tickets/${id}/responder`, { texto: 'Ya lo revisamos: aparece aprobado.', plantilla: 'P2' });
    expect(r.data).toEqual({ ok: true, numero: id.slice(0, 8).toUpperCase(), plantilla: 'P2', aviso: 'ok', correo: 'ok' });
    expect(w.avisos.at(-1)).toMatchObject({ to: 'ExponentPushToken[abc]', title: expect.stringContaining('We replied') });
    expect(w.correos.at(-1)).toMatchObject({ to: 'ana@example.com', text: expect.stringContaining(`/help/${id}`) });

    // Respondido ya no está entre los abiertos, pero sí en «todos».
    expect((await gerente('GET', '/datos/gerente/tickets?estado=abiertos')).data.tickets).toEqual([]);
    const todos = (await gerente('GET', '/datos/gerente/tickets?estado=todos')).data.tickets;
    expect(todos[0].estado).toBe('respondido');
    expect(todos[0].mensajes.map((m: { de: string }) => m.de)).toEqual(['cliente', 'soporte']);

    // La persona contesta y el caso vuelve a quedar abierto.
    const otra = await w.call('POST', `/datos/casos/${id}/mensajes`, { cookie: ana, form: formulario({ texto: 'Gracias, ya lo veo.' }) });
    expect(otra.status).toBe(201);
    expect((await gerente('GET', '/datos/gerente/tickets')).data.tickets).toHaveLength(1);

    const cierre = await gerente('POST', `/datos/gerente/tickets/${id}/responder`, { texto: 'Con gusto.', cerrar: true });
    expect(cierre.data.plantilla).toBeNull();
    expect((await w.call('GET', `/datos/casos/${id}`, { cookie: ana })).data.caso.estado).toBe('cerrado');
  });

  it('sin app dice sin_app; un caso que no existe da 404; datos malos dan 400', async () => {
    const { w, ana, gerente } = await escenario();
    const id = await abrirCaso(w, ana);
    expect((await gerente('POST', `/datos/gerente/tickets/${id}/responder`, { texto: 'Hola' })).data.aviso).toBe('sin_app');
    expect((await gerente('POST', '/datos/gerente/tickets/nada/responder', { texto: 'Hola' })).status).toBe(404);
    expect((await gerente('POST', `/datos/gerente/tickets/${id}/responder`, { texto: '' })).status).toBe(400);
    expect((await gerente('POST', `/datos/gerente/tickets/${id}/responder`, { texto: 'Hola', plantilla: 'P10' })).status).toBe(400);
  });

  it('si el correo falla lo dice y queda en el registro de errores', async () => {
    const { w, ana, gerente } = await escenario();
    const id = await abrirCaso(w, ana);
    w.env.SITIO_TOKEN = undefined;
    const r = await gerente('POST', `/datos/gerente/tickets/${id}/responder`, { texto: 'Hola' });
    expect(r.data.correo).toBe('error');
    const errores = await w.env.DB.prepare('SELECT mensaje FROM errores').all<{ mensaje: string }>();
    expect(errores.results.some((e) => e.mensaje.includes('no enviado'))).toBe(true);
  });

  it('el canario dice si la puerta de soporte está encendida', async () => {
    const { w } = await escenario();
    expect((await w.call('GET', '/datos/salud')).data.piezas.soporte).toBe('ok');
    expect((await crearMundo().call('GET', '/datos/salud')).data.piezas.soporte).toBe('apagado');
  });
});
