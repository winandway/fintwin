import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearMundo, PNG, type Correo } from './helpers';

afterEach(() => vi.unstubAllGlobals());

function codigoDe(correo: Correo | undefined): string {
  const m = /\n(\d{6})\n/.exec(correo?.text ?? '');
  if (!m?.[1]) throw new Error('el correo no trae código');
  return m[1];
}

async function negocio() {
  const w = crearMundo();
  const dueno = await w.usuario('dueno@example.com', 'Dueña');
  const c = await w.call('POST', '/datos/cuentas', { cookie: dueno, body: { nombre: 'Tienda Centro', pin: '1234' } });
  const id = c.data.id as string;
  const slug = (await w.call('GET', `/datos/cuentas/${id}`, { cookie: dueno })).data.cuenta.link_slug as string;
  return { w, dueno, id, slug };
}

describe('confirmar el correo con código dentro de la app', () => {
  it('el código de seis números confirma y abre la sesión, sin salir al navegador', async () => {
    const w = crearMundo();
    await w.call('POST', '/datos/auth/registro', { body: { nombre: 'Ana', email: 'ana@example.com', clave: 'clave-segura-1', idioma: 'es' } });
    const correo = w.correos[0]!;
    expect(correo.subject).toContain(codigoDe(correo));
    const r = await w.call('POST', '/datos/auth/confirmar-codigo', { body: { email: 'ANA@example.com', codigo: codigoDe(correo) } });
    expect(r.status).toBe(200);
    expect(r.cookie).toMatch(/^ft_sesion=/);
    // Después el enlace del mismo correo dice que ya está confirmado, no que venció.
    const enlace = await w.call('POST', '/datos/auth/confirmar', { body: { token: w.tokenDe(correo) } });
    expect(enlace.data.error).toBe('ya_confirmado');
    const otraVez = await w.call('POST', '/datos/auth/confirmar-codigo', { body: { email: 'ana@example.com', codigo: codigoDe(correo) } });
    expect(otraVez.data.error).toBe('ya_confirmado');
  });

  it('un código malo no entra, y cinco malos bloquean', async () => {
    const w = crearMundo();
    await w.call('POST', '/datos/auth/registro', { body: { nombre: 'Bea', email: 'bea@example.com', clave: 'clave-segura-1' } });
    const bueno = codigoDe(w.correos[0]);
    const malo = bueno === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const r = await w.call('POST', '/datos/auth/confirmar-codigo', { body: { email: 'bea@example.com', codigo: malo } });
      expect(r.status).toBe(400);
      expect(r.data.error).toBe('codigo_incorrecto');
    }
    const r = await w.call('POST', '/datos/auth/confirmar-codigo', { body: { email: 'bea@example.com', codigo: bueno } });
    expect(r.status).toBe(429);
  });

  it('mandar el correo otra vez anula el código anterior', async () => {
    const w = crearMundo();
    await w.call('POST', '/datos/auth/registro', { body: { nombre: 'Cleo', email: 'cleo@example.com', clave: 'clave-segura-1' } });
    const viejo = codigoDe(w.correos[0]);
    await w.call('POST', '/datos/auth/reenviar', { body: { email: 'cleo@example.com' } });
    const nuevo = codigoDe(w.correos[1]);
    if (viejo !== nuevo) {
      const r = await w.call('POST', '/datos/auth/confirmar-codigo', { body: { email: 'cleo@example.com', codigo: viejo } });
      expect(r.data.error).toBe('codigo_incorrecto');
    }
    const r = await w.call('POST', '/datos/auth/confirmar-codigo', { body: { email: 'cleo@example.com', codigo: nuevo } });
    expect(r.status).toBe(200);
  });
});

describe('acceso por código: el dueño agrega personas sin correo', () => {
  it('quien sube capturas entra con el código, sube y el dueño la ve', async () => {
    const { w, dueno, id, slug } = await negocio();
    const a = await w.call('POST', `/datos/cuentas/${id}/accesos`, { cookie: dueno, body: { nombre: 'María', rol: 'subidor', pin: '1234' } });
    expect(a.status).toBe(201);
    expect(a.data.codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const ver = await w.call('POST', '/datos/acceso/ver', { body: { codigo: a.data.codigo.toLowerCase().replace('-', ' ') } });
    expect(ver.data).toMatchObject({ cuenta_nombre: 'Tienda Centro', nombre: 'María', rol: 'subidor', pide_pin: false });

    const entra = await w.call('POST', '/datos/acceso/entrar', { body: { codigo: a.data.codigo, idioma: 'es' } });
    expect(entra.status).toBe(200);
    expect(entra.data.destino).toBe(`/pay/${slug}`);
    const yo = await w.call('GET', '/datos/yo', { cookie: entra.cookie });
    expect(yo.data.usuario).toMatchObject({ nombre: 'María', email: null, sin_correo: true, idioma: 'es' });
    expect(entra.headers.get('set-cookie')).toContain(`Max-Age=${365 * 24 * 3600}`);

    const sube = await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: entra.cookie, form: w.captura({ monto: '20', confirmacion: 'AB12345' }) });
    expect(sube.status).toBe(201);
    const lista = await w.call('GET', `/datos/cuentas/${id}/comprobantes`, { cookie: dueno });
    expect(lista.data.comprobantes[0]).toMatchObject({ subido_por_nombre: 'María', subido_por_email: null });
    const mis = await w.call('GET', '/datos/mis-pagos', { cookie: entra.cookie });
    expect(mis.data.empresas).toEqual([{ nombre: 'Tienda Centro', link_slug: slug }]);

    // El código sirve una sola vez.
    const otra = await w.call('POST', '/datos/acceso/entrar', { body: { codigo: a.data.codigo } });
    expect(otra.data.error).toBe('codigo_acceso_invalido');

    const equipo = await w.call('GET', `/datos/cuentas/${id}/equipo`, { cookie: dueno });
    expect(equipo.data.accesos).toEqual([expect.objectContaining({ nombre: 'María', rol: 'subidor', activo: true, codigo_pendiente: false })]);
  });

  it('otro código lleva a la misma persona; quitar el acceso la saca de la cuenta', async () => {
    const { w, dueno, id } = await negocio();
    const a = await w.call('POST', `/datos/cuentas/${id}/accesos`, { cookie: dueno, body: { nombre: 'Luis', rol: 'subidor', pin: '1234' } });
    const primera = await w.call('POST', '/datos/acceso/entrar', { body: { codigo: a.data.codigo } });
    const yo1 = (await w.call('GET', '/datos/yo', { cookie: primera.cookie })).data.usuario.id;

    const nuevo = await w.call('POST', `/datos/cuentas/${id}/accesos/${a.data.id}/codigo`, { cookie: dueno, body: { pin: '1234' } });
    expect(nuevo.data.codigo).not.toBe(a.data.codigo);
    const segunda = await w.call('POST', '/datos/acceso/entrar', { body: { codigo: nuevo.data.codigo } });
    expect((await w.call('GET', '/datos/yo', { cookie: segunda.cookie })).data.usuario.id).toBe(yo1);

    const quita = await w.call('POST', `/datos/cuentas/${id}/accesos/${a.data.id}/quitar`, { cookie: dueno, body: { pin: '1234' } });
    expect(quita.status).toBe(200);
    expect((await w.call('GET', '/datos/mis-pagos', { cookie: segunda.cookie })).data.empresas).toEqual([]);
    expect((await w.call('GET', `/datos/cuentas/${id}/equipo`, { cookie: dueno })).data.accesos).toEqual([]);
  });

  it('quien revisa crea su PIN al entrar y aprueba con él; no aparece dos veces en el equipo', async () => {
    const { w, dueno, id, slug } = await negocio();
    const cliente = await w.usuario('cliente@example.com', 'Cliente');
    await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: cliente, form: w.captura({ monto: '50', confirmacion: 'CONF7788' }) });

    const a = await w.call('POST', `/datos/cuentas/${id}/accesos`, { cookie: dueno, body: { nombre: 'Rita', rol: 'validador', pin: '1234' } });
    const sinPin = await w.call('POST', '/datos/acceso/entrar', { body: { codigo: a.data.codigo } });
    expect(sinPin.data.error).toBe('falta_pin');
    const entra = await w.call('POST', '/datos/acceso/entrar', { body: { codigo: a.data.codigo, pin: '4321' } });
    expect(entra.data.destino).toBe(`/accounts/${id}`);

    const pend = await w.call('GET', `/datos/cuentas/${id}/comprobantes`, { cookie: entra.cookie });
    const r = await w.call('POST', `/datos/cuentas/${id}/revisar`, {
      cookie: entra.cookie,
      body: { ids: [pend.data.comprobantes[0].id], accion: 'aprobar', pin: '4321' },
    });
    expect(r.data.hechos).toHaveLength(1);
    // No puede registrar salidas ni crear negocios.
    expect((await w.call('POST', '/datos/cuentas', { cookie: entra.cookie, body: { nombre: 'Mío', pin: '1111' } })).data.error).toBe('requiere_correo');

    const equipo = await w.call('GET', `/datos/cuentas/${id}/equipo`, { cookie: dueno });
    expect(equipo.data.miembros.map((m: { nombre: string }) => m.nombre)).toEqual(['Dueña']);
    expect(equipo.data.accesos).toHaveLength(1);
  });

  it('solo el dueño, con su PIN, da accesos', async () => {
    const { w, dueno, id } = await negocio();
    const malo = await w.call('POST', `/datos/cuentas/${id}/accesos`, { cookie: dueno, body: { nombre: 'X Y', rol: 'subidor', pin: '9999' } });
    expect(malo.data.error).toBe('pin_incorrecto');
    const ajena = await w.usuario('ajena@example.com');
    const r = await w.call('POST', `/datos/cuentas/${id}/accesos`, { cookie: ajena, body: { nombre: 'X Y', rol: 'subidor', pin: '1234' } });
    expect(r.status).toBe(404);
  });

  it('diez códigos malos desde el mismo lugar bloquean un rato', async () => {
    const { w } = await negocio();
    for (let i = 0; i < 10; i++) {
      const r = await w.call('POST', '/datos/acceso/ver', { body: { codigo: 'AAAA-BBBB' } });
      expect(r.data.error).toBe('codigo_acceso_invalido');
    }
    expect((await w.call('POST', '/datos/acceso/ver', { body: { codigo: 'AAAA-BBBB' } })).status).toBe(429);
  });
});

describe('el link de pago sin cuenta: solo el nombre', () => {
  it('quien pagó escribe su nombre, sube su captura y puede borrar su usuario sin contraseña', async () => {
    const { w, slug } = await negocio();
    const r = await w.call('POST', `/datos/pagar/${slug}/invitado`, { body: { nombre: 'Ana Pago', idioma: 'en' } });
    expect(r.status).toBe(201);
    const sube = await w.call('POST', `/datos/pagar/${slug}/subir`, { cookie: r.cookie, form: w.captura({ monto: '5', confirmacion: 'QQ998877' }, new Uint8Array([...PNG, 7])) });
    expect(sube.status).toBe(201);
    const borra = await w.call('POST', '/datos/yo/borrar', { cookie: r.cookie, body: { confirmar: 'borrar' } });
    expect(borra.status).toBe(200);
    expect((await w.call('GET', '/datos/yo', { cookie: r.cookie })).data.usuario).toBeNull();
  });

  it('un link que no existe no crea a nadie', async () => {
    const w = crearMundo();
    const r = await w.call('POST', '/datos/pagar/zzzzzzzzzzzz/invitado', { body: { nombre: 'Nadie' } });
    expect(r.status).toBe(404);
    expect(await w.env.DB.prepare('SELECT COUNT(*) AS n FROM usuarios').first('n')).toBe(0);
  });
});
