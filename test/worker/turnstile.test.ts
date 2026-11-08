import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearMundo } from './helpers';

afterEach(() => vi.unstubAllGlobals());

const llaves = { TURNSTILE_SECRET_KEY: 'secreto-de-prueba', TURNSTILE_SITE_KEY: 'sitio-de-prueba' };

// Candado C-TURNSTILE-1: con las claves cargadas, entrar, registrarse y recuperar la clave exigen el pase
// de Cloudflare comprobado en el servidor, antes de mirar la contraseña.
describe('escudo anti-robots (Turnstile)', () => {
  it('la configuración pública entrega la clave del sitio y la salud dice ok', async () => {
    const w = crearMundo(llaves);
    const c = await w.call('GET', '/datos/config');
    expect(c.data.turnstile_site_key).toBe('sitio-de-prueba');
  });

  it('entrar sin pase o con pase falso se rechaza; con pase bueno sigue a la contraseña', async () => {
    const w = crearMundo(llaves);
    await w.usuario('t@example.com');
    const sin = await w.call('POST', '/datos/auth/entrar', { body: { email: 't@example.com', clave: 'clave-segura-1' } });
    expect(sin.status).toBe(400);
    expect(sin.data.error).toBe('verificacion_robot');
    const falso = await w.call('POST', '/datos/auth/entrar', {
      body: { email: 't@example.com', clave: 'clave-segura-1', turnstile: 'pase-falso' },
    });
    expect(falso.data.error).toBe('verificacion_robot');
    const bueno = await w.call('POST', '/datos/auth/entrar', {
      body: { email: 't@example.com', clave: 'clave-segura-1', turnstile: 'pase-bueno' },
    });
    expect(bueno.status).toBe(200);
  });

  it('registrarse y recuperar la clave también exigen el pase', async () => {
    const w = crearMundo(llaves);
    const reg = await w.call('POST', '/datos/auth/registro', {
      body: { nombre: 'Tea', email: 'r@example.com', clave: 'clave-segura-1' },
    });
    expect(reg.data.error).toBe('verificacion_robot');
    expect(w.correos).toHaveLength(0);
    const olv = await w.call('POST', '/datos/auth/olvide', { body: { email: 'r@example.com' } });
    expect(olv.data.error).toBe('verificacion_robot');
  });

  it('sin claves cargadas el escudo queda apagado y se entra igual', async () => {
    const w = crearMundo();
    await w.usuario('a@example.com');
    const r = await w.call('POST', '/datos/auth/entrar', { body: { email: 'a@example.com', clave: 'clave-segura-1' } });
    expect(r.status).toBe(200);
  });
});

describe('variables del sitio (canario)', () => {
  it('con todo bien cargado la salud dice variables ok y turnstile ok', async () => {
    const w = crearMundo(llaves);
    const s = await w.call('GET', '/datos/salud');
    expect(s.data.piezas.variables).toBe('ok');
    expect(s.data.piezas.turnstile).toBe('ok');
  });

  it('una sola clave de Turnstile cargada salta en el canario, sin mostrar valores', async () => {
    const w = crearMundo({ TURNSTILE_SECRET_KEY: 'secreto-de-prueba' });
    const s = await w.call('GET', '/datos/salud');
    expect(s.data.piezas.variables).toBe('error');
    expect(s.data.variables_mal).toEqual(['TURNSTILE_SECRET_KEY']);
    expect(JSON.stringify(s.data)).not.toContain('secreto-de-prueba');
  });

  it('un remitente mal escrito también salta', async () => {
    const w = crearMundo({ MAIL_FROM: 'no-es-un-correo' });
    const s = await w.call('GET', '/datos/salud');
    expect(s.data.variables_mal).toContain('MAIL_FROM');
  });
});
