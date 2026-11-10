import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearMundo, PNG } from './helpers';

afterEach(() => vi.unstubAllGlobals());

// C-CLAVE-UNICA-1: la cuenta puede tener UNA clave para validar. Quien la crea es el único que la
// sabe y la cambia; desde ese momento el PIN personal del dueño ya no aprueba ni rechaza.
async function negocio() {
  const w = crearMundo();
  const dueno = await w.usuario('dueno@example.com', 'Dueña');
  const cliente = await w.usuario('cliente@example.com', 'Cliente');
  const c = await w.call('POST', '/datos/cuentas', { cookie: dueno, body: { nombre: 'Sucursal Centro', pin: '1234' } });
  const id = c.data.id as string;
  const slug = (await w.call('GET', `/datos/cuentas/${id}`, { cookie: dueno })).data.cuenta.link_slug as string;
  // El validador entra con código y crea su PIN personal.
  const a = await w.call('POST', `/datos/cuentas/${id}/accesos`, { cookie: dueno, body: { nombre: 'Rita', rol: 'validador', pin: '1234' } });
  const val = (await w.call('POST', '/datos/acceso/entrar', { body: { codigo: a.data.codigo, pin: '4321' } })).cookie as string;
  let n = 0;
  const subir = async () => {
    n += 1;
    await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: cliente, form: w.captura({ monto: '50', confirmacion: `CONF${n}000` }, new Uint8Array([...PNG, n])) });
    const pend = await w.call('GET', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno });
    return pend.data.comprobantes[0].id as string;
  };
  return { w, dueno, cliente, val, id, slug, acceso: a.data.id as string, subir };
}

describe('clave única para validar', () => {
  it('el validador la crea; el PIN del dueño deja de aprobar y solo la clave única aprueba', async () => {
    const { w, dueno, val, id, subir } = await negocio();
    expect((await w.call('GET', `/datos/cuentas/${id}`, { cookie: dueno })).data.clave_unica).toMatchObject({ activa: false });

    const crea = await w.call('POST', `/datos/cuentas/${id}/clave-unica`, { cookie: val, body: { pin: '4321', nueva: '9090' } });
    expect(crea.data).toMatchObject({ ok: true, creada: true });

    const k1 = await subir();
    const conPinDueno = await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: dueno, body: { ids: [k1], accion: 'aprobar', pin: '1234' } });
    expect(conPinDueno.status).toBe(401);
    expect(conPinDueno.data.error).toBe('clave_unica_incorrecta');
    const conPinVal = await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: val, body: { ids: [k1], accion: 'aprobar', pin: '4321' } });
    expect(conPinVal.status).toBe(401);
    const bien = await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: val, body: { ids: [k1], accion: 'aprobar', pin: '9090' } });
    expect(bien.data.hechos).toHaveLength(1);

    const vistaDueno = (await w.call('GET', `/datos/cuentas/${id}`, { cookie: dueno })).data.clave_unica;
    expect(vistaDueno).toMatchObject({ activa: true, por_mi: false, nombre: 'Rita' });
    expect(JSON.stringify(vistaDueno)).not.toContain('9090');
  });

  it('una vez creada, el otro no la puede cambiar ni crear otra; quien la creó sí la cambia con la actual', async () => {
    const { w, dueno, val, id } = await negocio();
    await w.call('POST', `/datos/cuentas/${id}/clave-unica`, { cookie: val, body: { pin: '4321', nueva: '9090' } });
    const otro = await w.call('POST', `/datos/cuentas/${id}/clave-unica`, { cookie: dueno, body: { pin: '1234', nueva: '1111' } });
    expect(otro.status).toBe(403);
    expect(otro.data.error).toBe('clave_unica_de_otro');

    const mala = await w.call('POST', `/datos/cuentas/${id}/clave-unica`, { cookie: val, body: { actual: '0000', nueva: '5555' } });
    expect(mala.status).toBe(401);
    const cambia = await w.call('POST', `/datos/cuentas/${id}/clave-unica`, { cookie: val, body: { actual: '9090', nueva: '5555' } });
    expect(cambia.data).toMatchObject({ ok: true, creada: false });
  });

  it('el dueño también la puede crear primero, y entonces el validador no la puede cambiar', async () => {
    const { w, dueno, val, id } = await negocio();
    expect((await w.call('POST', `/datos/cuentas/${id}/clave-unica`, { cookie: dueno, body: { pin: '1234', nueva: '7777' } })).data.ok).toBe(true);
    const r = await w.call('POST', `/datos/cuentas/${id}/clave-unica`, { cookie: val, body: { pin: '4321', nueva: '1212' } });
    expect(r.data.error).toBe('clave_unica_de_otro');
  });

  it('crearla pide el PIN personal correcto', async () => {
    const { w, val, id } = await negocio();
    const r = await w.call('POST', `/datos/cuentas/${id}/clave-unica`, { cookie: val, body: { pin: '0000', nueva: '9090' } });
    expect(r.data.error).toBe('pin_incorrecto');
  });

  it('el dueño no puede quitar a quien tiene la clave; si esa persona sale, se vuelve al PIN de cada uno', async () => {
    const { w, dueno, val, id, acceso, subir } = await negocio();
    await w.call('POST', `/datos/cuentas/${id}/clave-unica`, { cookie: val, body: { pin: '4321', nueva: '9090' } });
    const quitar = await w.call('POST', `/datos/cuentas/${id}/accesos/${acceso}/quitar`, { cookie: dueno, body: { pin: '1234' } });
    expect(quitar.data.error).toBe('tiene_la_clave_unica');

    expect((await w.call('POST', `/datos/cuentas/${id}/salir`, { cookie: val })).data.ok).toBe(true);
    const k = await subir();
    const r = await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: dueno, body: { ids: [k], accion: 'aprobar', pin: '1234' } });
    expect(r.data.hechos).toHaveLength(1);
  });

  it('poner en espera también pide la clave única', async () => {
    const { w, val, dueno, id, subir } = await negocio();
    const k = await subir();
    await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: dueno, body: { ids: [k], accion: 'aprobar', pin: '1234' } });
    await w.call('POST', `/datos/cuentas/${id}/clave-unica`, { cookie: val, body: { pin: '4321', nueva: '9090' } });
    const conPin = await w.call('POST', `/datos/cuentas/${id}/comprobantes/${k}/espera`, { cookie: dueno, body: { pin: '1234' } });
    expect(conPin.data.error).toBe('clave_unica_incorrecta');
    const conClave = await w.call('POST', `/datos/cuentas/${id}/comprobantes/${k}/espera`, { cookie: dueno, body: { pin: '9090' } });
    expect(conClave.data.ok).toBe(true);
  });
});

// C-HISTORIAL-PAGADOR-1: quien paga ve sus capturas con estado, tipo de pago e ID, y el motivo si se rechaza.
describe('historial de quien paga', () => {
  it('mis-pagos trae el link, el tipo, el ID y el motivo solo si fue rechazado', async () => {
    const { w, dueno, cliente, id, slug, subir } = await negocio();
    const k1 = await subir();
    await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: dueno, body: { ids: [k1], accion: 'aprobar', pin: '1234' } });
    const k2 = await subir();
    await w.call('POST', `/datos/cuentas/${id}/revisar`, { cookie: dueno, body: { ids: [k2], accion: 'rechazar', pin: '1234', motivo: 'No llegó' } });
    await subir();

    const mis = (await w.call('GET', '/datos/mis-pagos', { cookie: cliente })).data.comprobantes as Record<string, unknown>[];
    expect(mis).toHaveLength(3);
    expect(mis.map((k) => k.estado).sort()).toEqual(['aprobado', 'pendiente', 'rechazado']);
    for (const k of mis) expect(k).toMatchObject({ link_slug: slug });
    expect(mis.find((k) => k.estado === 'aprobado')).toMatchObject({ confirmacion: 'CONF1000', motivo: null });
    expect(mis.find((k) => k.estado === 'rechazado')).toMatchObject({ motivo: 'No llegó' });
    expect(mis.find((k) => k.estado === 'aprobado')!.revisado_en).toEqual(expect.any(Number));
  });
});
