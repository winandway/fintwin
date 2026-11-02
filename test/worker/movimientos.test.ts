import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearMundo, PNG } from './helpers';

afterEach(() => vi.unstubAllGlobals());

// Las reglas del FinTwin original (Windoce Hub) dentro de la cuenta: repetidas con historial,
// «Aceptar igual» con PIN, puntos de colores, en espera, cancelar, clientes.

const LEIDA = { amount: 120, confirmation_code: 'WFCT22TRV5KC', sender_name: 'Ana Pérez', recipient_name: 'Sucursal Centro', platform: 'zelle', confidence: 0.95 };

async function escenario() {
  const w = crearMundo({ GEMINI_API_KEY: 'clave-prueba' });
  const dueno = await w.usuario('dueno@example.com', 'Dueña');
  const crear = async (nombre: string, pin: string) => {
    const c = await w.call('POST', '/datos/cuentas', { cookie: dueno, body: { nombre, pin, comision_pct: 10 } });
    return c.data.id as string;
  };
  const id = await crear('Sucursal Centro', '1234');
  w.setGemini(LEIDA);
  return { w, dueno, id, crear };
}

const img = (n: number) => new Uint8Array([...PNG, n]);

describe('registrar comprobante en la cuenta', () => {
  it('lee la captura, queda pendiente y se aprueba con el PIN', async () => {
    const { w, dueno, id } = await escenario();
    const l = await w.call('POST', `/datos/cuentas/${id}/leer-captura`, { cookie: dueno, form: w.captura({}, img(1)) });
    expect(l.data.lectura).toMatchObject({ monto_cent: 12000, confirmacion: 'WFCT22TRV5KC', estado: 'success' });
    expect(l.data.repetida).toBeNull();

    const r = await w.call('POST', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno, form: w.captura({ monto: '120', notas: 'Pago de octubre' }, img(1)) });
    expect(r.status).toBe(201);
    let m = await w.call('GET', `/datos/cuentas/${id}/movimientos?periodo=todo`, { cookie: dueno });
    expect(m.data.movimientos[0]).toMatchObject({ estado: 'pendiente', monto_cent: 12000, via: 'cuenta', notas: 'Pago de octubre', pagador: 'Ana Pérez', plataforma: 'zelle' });
    expect(m.data.total_cent).toBe(0);
    expect(m.data.pendientes).toBe(1);
    // Lo que el dueño registra en su cuenta no sale en «Mis pagos enviados»: eso es solo del link de pago.
    expect((await w.call('GET', '/datos/mis-pagos', { cookie: dueno })).data.comprobantes).toHaveLength(0);

    await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: dueno, body: { ids: [r.data.id], accion: 'aprobar', pin: '1234' } });
    m = await w.call('GET', `/datos/cuentas/${id}/movimientos?periodo=todo`, { cookie: dueno });
    // 10 % de comisión: el total es el neto.
    expect(m.data.total_cent).toBe(10800);
    expect(m.data.cifras).toMatchObject({ bruto_cent: 12000, comision_cent: 1200 });
  });

  it('una captura repetida en la MISMA cuenta no entra nunca, ni con PIN', async () => {
    const { w, dueno, id } = await escenario();
    await w.call('POST', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno, form: w.captura({ monto: '120' }, img(1)) });
    // Otra captura del mismo pago (otra imagen, mismo número de confirmación).
    const l = await w.call('POST', `/datos/cuentas/${id}/leer-captura`, { cookie: dueno, form: w.captura({}, img(2)) });
    expect(l.data.repetida).toMatchObject({ coincide: 'codigo', misma_cuenta: true });
    expect(l.data.historial).toHaveLength(1);
    const r = await w.call('POST', `/datos/cuentas/${id}/comprobantes`, {
      cookie: dueno,
      form: w.captura({ monto: '120', aceptar_repetida: '1', pin: '1234' }, img(2)),
    });
    expect(r.status).toBe(409);
    expect(r.data.error).toBe('repetida_misma_cuenta');
  });

  it('repetida de otra cuenta: avisa con el historial y solo entra con «Aceptar igual» y el PIN', async () => {
    const { w, dueno, id, crear } = await escenario();
    const otra = await crear('Sucursal Norte', '5678');
    await w.call('POST', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno, form: w.captura({ monto: '120' }, img(1)) });

    const l = await w.call('POST', `/datos/cuentas/${otra}/leer-captura`, { cookie: dueno, form: w.captura({}, img(1)) });
    expect(l.data.repetida).toMatchObject({ coincide: 'imagen', misma_cuenta: false });
    expect(l.data.historial[0]).toMatchObject({ cuenta: 'Sucursal Centro', monto_cent: 12000 });

    const sinAceptar = await w.call('POST', `/datos/cuentas/${otra}/comprobantes`, { cookie: dueno, form: w.captura({ monto: '120' }, img(1)) });
    expect(sinAceptar.status).toBe(409);
    expect(sinAceptar.data.error).toBe('captura_repetida');
    const pinMalo = await w.call('POST', `/datos/cuentas/${otra}/comprobantes`, {
      cookie: dueno,
      form: w.captura({ monto: '120', aceptar_repetida: '1', pin: '0000' }, img(1)),
    });
    expect(pinMalo.data.error).toBe('pin_incorrecto');
    const ok = await w.call('POST', `/datos/cuentas/${otra}/comprobantes`, {
      cookie: dueno,
      form: w.captura({ monto: '120', aceptar_repetida: '1', pin: '5678' }, img(1)),
    });
    expect(ok.status).toBe(201);
    // El punto de color: cada uno ve que su captura se usó una vez más.
    const m = await w.call('GET', `/datos/cuentas/${otra}/movimientos?periodo=todo`, { cookie: dueno });
    expect(m.data.movimientos[0].repetidas).toBe(1);
    const usos = await w.call('GET', `/datos/cuentas/${otra}/comprobantes/${ok.data.id}/usos`, { cookie: dueno });
    expect(usos.data.usos).toHaveLength(2);
    // En la primera cuenta, aunque el uso más reciente sea de la otra, el aviso dice «ya está en esta cuenta».
    const enLaPrimera = await w.call('POST', `/datos/cuentas/${id}/leer-captura`, { cookie: dueno, form: w.captura({}, img(1)) });
    expect(enLaPrimera.data.repetida).toMatchObject({ misma_cuenta: true });
  });

  it('el historial no muestra el nombre ni el monto de cuentas de otra empresa', async () => {
    const { w, dueno, id } = await escenario();
    await w.call('POST', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno, form: w.captura({ monto: '120' }, img(1)) });
    const otraEmpresa = await w.usuario('otra@example.com', 'Otra');
    const c = await w.call('POST', '/datos/cuentas', { cookie: otraEmpresa, body: { nombre: 'Tienda Ajena', pin: '4321' } });
    const l = await w.call('POST', `/datos/cuentas/${c.data.id}/leer-captura`, { cookie: otraEmpresa, form: w.captura({}, img(1)) });
    expect(l.data.repetida).toMatchObject({ misma_cuenta: false });
    expect(l.data.historial[0]).toMatchObject({ cuenta: null, monto_cent: null, otra_cuenta: true });
  });
});

describe('estados de un comprobante', () => {
  it('cancelar un pendiente lo deja rechazado y suma en «cancelados»', async () => {
    const { w, dueno, id } = await escenario();
    const r = await w.call('POST', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno, form: w.captura({ monto: '120' }, img(1)) });
    expect((await w.call('POST', `/datos/cuentas/${id}/comprobantes/${r.data.id}/cancelar`, { cookie: dueno })).status).toBe(200);
    const m = await w.call('GET', `/datos/cuentas/${id}/movimientos?periodo=todo`, { cookie: dueno });
    expect(m.data.movimientos[0]).toMatchObject({ estado: 'rechazado', motivo: 'Cancelado antes de aprobar' });
    expect(m.data.cifras.cancelados_cent).toBe(12000);
    // Rechazada ya no frena: se puede volver a enviar.
    const otra = await w.call('POST', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno, form: w.captura({ monto: '120' }, img(1)) });
    expect(otra.status).toBe(201);
  });

  it('en espera sale del total y vuelve al aprobarlo con el PIN', async () => {
    const { w, dueno, id } = await escenario();
    const r = await w.call('POST', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno, form: w.captura({ monto: '120' }, img(1)) });
    await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: dueno, body: { ids: [r.data.id], accion: 'aprobar', pin: '1234' } });
    const mal = await w.call('POST', `/datos/cuentas/${id}/comprobantes/${r.data.id}/espera`, { cookie: dueno, body: { pin: '9999' } });
    expect(mal.data.error).toBe('pin_incorrecto');
    await w.call('POST', `/datos/cuentas/${id}/comprobantes/${r.data.id}/espera`, { cookie: dueno, body: { pin: '1234', nota: 'El banco lo revisa' } });
    let m = await w.call('GET', `/datos/cuentas/${id}/movimientos?periodo=todo`, { cookie: dueno });
    expect(m.data.movimientos[0]).toMatchObject({ estado: 'pendiente', en_espera: 1, notas: 'El banco lo revisa' });
    expect(m.data.total_cent).toBe(0);
    // Aparece en la bandeja «Por revisar».
    const bandeja = await w.call('GET', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno });
    expect(bandeja.data.comprobantes[0]).toMatchObject({ en_espera: 1 });
    // Un pendiente en espera no se cancela: se confirma.
    expect((await w.call('POST', `/datos/cuentas/${id}/comprobantes/${r.data.id}/cancelar`, { cookie: dueno })).status).toBe(409);
    await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: dueno, body: { ids: [r.data.id], accion: 'aprobar', pin: '1234' } });
    m = await w.call('GET', `/datos/cuentas/${id}/movimientos?periodo=todo`, { cookie: dueno });
    expect(m.data.movimientos[0]).toMatchObject({ estado: 'aprobado', en_espera: 0 });
    expect(m.data.total_cent).toBe(10800);
  });

  it('rechazar en lote guarda el motivo (o uno por defecto)', async () => {
    const { w, dueno, id } = await escenario();
    const a = await w.call('POST', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno, form: w.captura({ monto: '120' }, img(1)) });
    w.setGemini({ ...LEIDA, confirmation_code: 'OTRO12345' });
    const b = await w.call('POST', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno, form: w.captura({ monto: '50' }, img(2)) });
    await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: dueno, body: { ids: [a.data.id], accion: 'rechazar', pin: '1234', motivo: 'No llegó' } });
    await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: dueno, body: { ids: [b.data.id], accion: 'rechazar', pin: '1234' } });
    const m = await w.call('GET', `/datos/cuentas/${id}/movimientos?periodo=todo`, { cookie: dueno });
    const motivos = Object.fromEntries(m.data.movimientos.map((k: { id: string; motivo: string }) => [k.id, k.motivo]));
    expect(motivos[a.data.id]).toBe('No llegó');
    expect(motivos[b.data.id]).toBe('Rechazado en la revisión');
  });
});

describe('periodos, clientes y link', () => {
  it('el mes elegido filtra las cifras y la lista; el total es siempre histórico', async () => {
    const { w, dueno, id } = await escenario();
    const r = await w.call('POST', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno, form: w.captura({ monto: '120' }, img(1)) });
    await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: dueno, body: { ids: [r.data.id], accion: 'aprobar', pin: '1234' } });
    const actual = await w.call('GET', `/datos/cuentas/${id}/movimientos`, { cookie: dueno });
    expect(actual.data.periodo).toBe(actual.data.mes_actual);
    expect(actual.data.meses).toContain(actual.data.mes_actual);
    expect(actual.data.movimientos).toHaveLength(1);
    const viejo = await w.call('GET', `/datos/cuentas/${id}/movimientos?periodo=2020-01`, { cookie: dueno });
    expect(viejo.data.movimientos).toHaveLength(0);
    expect(viejo.data.cifras.bruto_cent).toBe(0);
    expect(viejo.data.total_cent).toBe(10800);
  });

  it('clientes que te pagan: agrupados por quien pagó', async () => {
    const { w, dueno, id } = await escenario();
    await w.call('POST', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno, form: w.captura({ monto: '120' }, img(1)) });
    w.setGemini({ ...LEIDA, confirmation_code: 'OTRO12345' });
    await w.call('POST', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno, form: w.captura({ monto: '30' }, img(2)) });
    const c = await w.call('GET', `/datos/cuentas/${id}/clientes`, { cookie: dueno });
    expect(c.data.clientes).toHaveLength(1);
    expect(c.data.clientes[0]).toMatchObject({ nombre: 'Ana Pérez', comprobantes: 2, por_revisar: 2 });
  });

  it('el dueño puede dejar de exigir el número de confirmación en su link', async () => {
    const w = crearMundo();
    const dueno = await w.usuario('dueno@example.com', 'Dueña');
    const cliente = await w.usuario('cliente@example.com', 'Cliente');
    const c = await w.call('POST', '/datos/cuentas', { cookie: dueno, body: { nombre: 'Centro', pin: '1234' } });
    const slug = (await w.call('GET', `/datos/cuentas/${c.data.id}`, { cookie: dueno })).data.cuenta.link_slug;
    expect((await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: cliente, form: w.captura({ monto: '10' }) })).data.error).toBe('sin_confirmacion');
    expect((await w.call('POST', `/datos/cuentas/${c.data.id}/exigir-confirmacion`, { cookie: cliente, body: { valor: false } })).status).toBe(404);
    await w.call('POST', `/datos/cuentas/${c.data.id}/exigir-confirmacion`, { cookie: dueno, body: { valor: false } });
    expect((await w.call('GET', `/datos/pagar/${slug}`)).data.exigir_confirmacion).toBe(false);
    expect((await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: cliente, form: w.captura({ monto: '10' }) })).status).toBe(201);
  });
});
