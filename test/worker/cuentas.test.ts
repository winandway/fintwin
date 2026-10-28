import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearMundo, PNG } from './helpers';

afterEach(() => vi.unstubAllGlobals());

async function escenario(extra = {}) {
  const w = crearMundo(extra);
  const dueno = await w.usuario('dueno@example.com', 'Dueña');
  const cliente = await w.usuario('cliente@example.com', 'Cliente');
  const c = await w.call('POST', '/datos/cuentas', { cookie: dueno, body: { nombre: 'Sucursal Centro', pin: '1234', comision_pct: 2 } });
  const id = c.data.id as string;
  const cuenta = await w.call('GET', `/datos/cuentas/${id}`, { cookie: dueno });
  const slug = cuenta.data.cuenta.link_slug as string;
  return { w, dueno, cliente, id, slug };
}

describe('link de pago', () => {
  it('quien pagó sube su captura con número de confirmación y queda pendiente', async () => {
    const { w, cliente, slug, dueno, id } = await escenario();
    const info = await w.call('GET', `/datos/pagar/${slug}`);
    expect(info.data).toMatchObject({ valido: true, nombre: 'Sucursal Centro', lectura_ia: false });

    const r = await w.call('POST', `/datos/pagar/${slug}/subir`, {
      cookie: cliente,
      form: w.captura({ monto: '150.00', confirmacion: 'ABC-123-456' }),
    });
    expect(r.status).toBe(201);
    expect(w.bucket.store.size).toBe(1);

    const lista = await w.call('GET', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno });
    expect(lista.data.comprobantes).toHaveLength(1);
    expect(lista.data.comprobantes[0]).toMatchObject({ monto_cent: 15000, estado: 'pendiente', subido_por_nombre: 'Cliente' });

    const mis = await w.call('GET', '/datos/mis-pagos', { cookie: cliente });
    expect(mis.data.empresas).toEqual([{ nombre: 'Sucursal Centro', link_slug: slug }]);
  });

  it('sin número de confirmación no entra', async () => {
    const { w, cliente, slug } = await escenario();
    const r = await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: cliente, form: w.captura({ monto: '10' }) });
    expect(r.status).toBe(422);
    expect(r.data.error).toBe('sin_confirmacion');
    expect(w.bucket.store.size).toBe(0);
  });

  it('el mismo número de confirmación no entra dos veces, ni en otra cuenta', async () => {
    const { w, cliente, slug, dueno } = await escenario();
    await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: cliente, form: w.captura({ monto: '10', confirmacion: 'ZX 9988' }) });
    const otra = await w.call('POST', '/datos/cuentas', { cookie: dueno, body: { nombre: 'Otra', pin: '1111' } });
    const slug2 = (await w.call('GET', `/datos/cuentas/${otra.data.id}`, { cookie: dueno })).data.cuenta.link_slug;
    const otraImagen = new Uint8Array([...PNG, 9, 9]);
    const r = await w.call('POST', `/datos/pagar/${slug2}/subir`, {
      cookie: cliente,
      form: w.captura({ monto: '10', confirmacion: 'zx-9988' }, otraImagen),
    });
    expect(r.status).toBe(409);
    expect(r.data.error).toBe('confirmacion_repetida');
  });

  it('la misma imagen no entra dos veces', async () => {
    const { w, cliente, slug } = await escenario();
    await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: cliente, form: w.captura({ monto: '10', confirmacion: 'A1111' }) });
    const r = await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: cliente, form: w.captura({ monto: '10', confirmacion: 'B2222' }) });
    expect(r.data.error).toBe('captura_repetida');
  });

  it('rechaza lo que no es imagen aunque diga que lo es', async () => {
    const { w, cliente, slug } = await escenario();
    const r = await w.call('POST', `/datos/pagar/${slug}/subir`, {
      cookie: cliente,
      form: w.captura({ monto: '10', confirmacion: 'C3333' }, new TextEncoder().encode('<script>alert(1)</script>')),
    });
    expect(r.status).toBe(415);
  });

  it('pide sesión para subir', async () => {
    const { w, slug } = await escenario();
    const r = await w.call('POST', `/datos/pagar/${slug}/subir`, { form: w.captura({ monto: '10', confirmacion: 'D4444' }) });
    expect(r.status).toBe(401);
  });

  it('con IA: lee la captura en el servidor y rechaza si no ve el número completo', async () => {
    const { w, cliente, slug } = await escenario({ GEMINI_API_KEY: 'clave-prueba' });
    w.setGemini({ is_receipt: true, amount: 75.5, date: '2026-10-28', confirmation: null, payer: 'X', payee: 'Y' });
    const sin = await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: cliente, form: w.captura({ confirmacion: 'INVENTADO1' }) });
    expect(sin.data.error).toBe('sin_confirmacion');

    w.setGemini({ is_receipt: true, amount: '75.50', date: '2026-10-28', confirmation: 'Q77 8899', payer: 'Ana', payee: 'Centro' });
    const ok = await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: cliente, form: w.captura() });
    expect(ok.status).toBe(201);
    expect(ok.data.lectura).toMatchObject({ monto_cent: 7550, confirmacion: 'Q77 8899', modo: 'ia' });

    w.setGemini({ is_receipt: false });
    const foto = await w.call('POST', `/datos/pagar/${slug}/subir`, {
      cookie: cliente,
      form: w.captura({}, new Uint8Array([...PNG, 5])),
    });
    expect(foto.data.error).toBe('no_es_comprobante');
  });

  it('la imagen solo la ven quien la subió y el equipo', async () => {
    const { w, cliente, slug, dueno, id } = await escenario();
    await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: cliente, form: w.captura({ monto: '10', confirmacion: 'E5555' }) });
    const k = (await w.call('GET', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno })).data.comprobantes[0];
    const extrano = await w.usuario('extrano@example.com');
    expect((await w.call('GET', `/datos/archivo/${k.id}`, { cookie: extrano })).status).toBe(404);
    expect((await w.call('GET', `/datos/archivo/${k.id}`, { cookie: cliente })).status).toBe(200);
    expect((await w.call('GET', `/datos/archivo/${k.id}`, { cookie: dueno })).status).toBe(200);
    expect((await w.call('GET', `/datos/archivo/${k.id}`)).status).toBe(401);
  });
});

describe('revisión con PIN', () => {
  it('aprueba en lote, calcula la comisión y suma el total', async () => {
    const { w, cliente, slug, dueno, id } = await escenario();
    await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: cliente, form: w.captura({ monto: '100', confirmacion: 'F1001' }) });
    await w.call('POST', `/datos/pagar/${slug}/subir`, {
      cookie: cliente,
      form: w.captura({ monto: '50', confirmacion: 'F1002' }, new Uint8Array([...PNG, 7])),
    });
    const ids = (await w.call('GET', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno })).data.comprobantes.map(
      (k: { id: string }) => k.id,
    );
    const mal = await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: dueno, body: { ids, accion: 'aprobar', pin: '9999' } });
    expect(mal.status).toBe(401);
    const r = await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: dueno, body: { ids, accion: 'aprobar', pin: '1234' } });
    expect(r.data.hechos).toHaveLength(2);
    const otraVez = await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: dueno, body: { ids, accion: 'rechazar', pin: '1234' } });
    expect(otraVez.data).toMatchObject({ hechos: [], ya_revisados: 2 });

    const v = await w.call('GET', `/datos/cuentas/${id}`, { cookie: dueno });
    expect(v.data.resumen).toMatchObject({ ingresos_cent: 15000, comision_cent: 300, salidas_cent: 0, total_cent: 14700, pendientes: 0 });
    expect(v.data.mes.ingresos_cent).toBe(15000);
  });

  it('cinco PIN malos bloquean la revisión', async () => {
    const { w, dueno, id } = await escenario();
    for (let i = 0; i < 5; i++) {
      await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: dueno, body: { ids: ['x'], accion: 'aprobar', pin: '0000' } });
    }
    const r = await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: dueno, body: { ids: ['x'], accion: 'aprobar', pin: '1234' } });
    expect(r.status).toBe(429);
  });

  it('un rechazado libera el número para volver a subirlo bien', async () => {
    const { w, cliente, slug, dueno, id } = await escenario();
    await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: cliente, form: w.captura({ monto: '20', confirmacion: 'G7007' }) });
    const k = (await w.call('GET', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno })).data.comprobantes[0];
    await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: dueno, body: { ids: [k.id], accion: 'rechazar', pin: '1234' } });
    const r = await w.call('POST', `/datos/pagar/${slug}/subir`, {
      cookie: cliente,
      form: w.captura({ monto: '20', confirmacion: 'G7007' }, new Uint8Array([...PNG, 3])),
    });
    expect(r.status).toBe(201);
  });
});

describe('salidas', () => {
  it('se restan del total y frenan la repetida', async () => {
    const { w, dueno, id } = await escenario();
    const r = await w.call('POST', `/datos/cuentas/${id}/salidas`, { cookie: dueno, body: { monto: '40', motivo: 'Proveedor', pin: '1234' } });
    expect(r.status).toBe(201);
    const rep = await w.call('POST', `/datos/cuentas/${id}/salidas`, { cookie: dueno, body: { monto: 40, motivo: 'Proveedor', pin: '1234' } });
    expect(rep.data.error).toBe('salida_repetida');
    const conf = await w.call('POST', `/datos/cuentas/${id}/salidas`, {
      cookie: dueno,
      body: { monto: 40, motivo: 'Proveedor', pin: '1234', confirmar_repetida: true },
    });
    expect(conf.status).toBe(201);
    const v = await w.call('GET', `/datos/cuentas/${id}`, { cookie: dueno });
    expect(v.data.resumen.total_cent).toBe(-8000);
  });
});

describe('equipo', () => {
  it('el dueño invita, el validador crea SU PIN y revisa, pero no anota salidas', async () => {
    const { w, dueno, cliente, slug, id } = await escenario();
    const inv = await w.call('POST', `/datos/cuentas/${id}/invitaciones`, { cookie: dueno, body: { pin: '1234' } });
    expect(inv.status).toBe(201);
    const token = inv.data.token as string;

    const publico = await w.call('GET', `/datos/invitaciones/${token}`);
    expect(publico.data).toMatchObject({ valida: true, cuenta_nombre: 'Sucursal Centro', invita: 'Dueña' });

    const val = await w.usuario('val@example.com', 'Validador');
    const acepta = await w.call('POST', `/datos/invitaciones/${token}/aceptar`, { cookie: val, body: { pin: '5678' } });
    expect(acepta.status).toBe(200);
    const dos = await w.call('POST', `/datos/invitaciones/${token}/aceptar`, { cookie: cliente, body: { pin: '1111' } });
    expect(dos.data.error).toBe('invitacion_vencida');

    await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: cliente, form: w.captura({ monto: '30', confirmacion: 'H8008' }) });
    const k = (await w.call('GET', `/datos/cuentas/${id}/comprobantes`, { cookie: val })).data.comprobantes[0];
    const conPinAjeno = await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: val, body: { ids: [k.id], accion: 'aprobar', pin: '1234' } });
    expect(conPinAjeno.status).toBe(401);
    const ok = await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: val, body: { ids: [k.id], accion: 'aprobar', pin: '5678' } });
    expect(ok.data.hechos).toEqual([k.id]);

    const salida = await w.call('POST', `/datos/cuentas/${id}/salidas`, { cookie: val, body: { monto: 5, motivo: 'X', pin: '5678' } });
    expect(salida.status).toBe(403);

    const equipo = await w.call('GET', `/datos/cuentas/${id}/equipo`, { cookie: dueno });
    expect(equipo.data.miembros.map((m: { rol: string }) => m.rol)).toEqual(['dueno', 'validador']);

    const valId = equipo.data.miembros[1].usuario_id;
    await w.call('POST', `/datos/cuentas/${id}/equipo/quitar`, { cookie: dueno, body: { usuario_id: valId, pin: '1234' } });
    expect((await w.call('GET', `/datos/cuentas/${id}`, { cookie: val })).status).toBe(404);
  });

  it('nadie ve una cuenta de la que no es parte', async () => {
    const { w, cliente, id } = await escenario();
    expect((await w.call('GET', `/datos/cuentas/${id}`, { cookie: cliente })).status).toBe(404);
    expect((await w.call('GET', '/datos/cuentas', { cookie: cliente })).data.cuentas).toEqual([]);
  });

  it('cambiar mi PIN pide el actual', async () => {
    const { w, dueno, id } = await escenario();
    expect((await w.call('POST', `/datos/cuentas/${id}/mi-pin`, { cookie: dueno, body: { actual: '0000', nuevo: '4321' } })).status).toBe(401);
    expect((await w.call('POST', `/datos/cuentas/${id}/mi-pin`, { cookie: dueno, body: { actual: '1234', nuevo: '4321' } })).status).toBe(200);
    const r = await w.call('POST', `/datos/cuentas/${id}/link`, { cookie: dueno, body: { pin: '4321' } });
    expect(r.data.link_slug).toMatch(/^[a-z0-9]{12}$/);
  });
});

describe('sitio', () => {
  it('las rutas de la app devuelven la página y llevan cabeceras de seguridad', async () => {
    const w = crearMundo();
    const r = await w.call('GET', '/accounts/abc');
    expect(r.data).toContain('app');
    expect(r.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect((await w.call('GET', '/nada.js')).status).toBe(404);
  });

  it('el canario dice el estado de cada pieza', async () => {
    const w = crearMundo();
    const r = await w.call('GET', '/datos/salud');
    expect(r.data).toMatchObject({ ok: true, piezas: { base: 'ok', almacen: 'ok', correo: 'ok', lectura_ia: 'apagado' } });
  });
});
