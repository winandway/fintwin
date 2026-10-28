import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearMundo } from './helpers';

afterEach(() => vi.unstubAllGlobals());

describe('usuarios', () => {
  it('crea el usuario, pide confirmar el correo y luego deja entrar', async () => {
    const w = crearMundo();
    const r = await w.call('POST', '/datos/auth/registro', {
      body: { nombre: 'Ana', email: 'Ana@Example.com', clave: 'clave-segura-1', idioma: 'es' },
    });
    expect(r.status).toBe(201);
    expect(w.correos).toHaveLength(1);
    expect(w.correos[0]!.to).toBe('ana@example.com');
    expect(w.correos[0]!.subject).toContain('Confirma');

    const antes = await w.call('POST', '/datos/auth/entrar', { body: { email: 'ana@example.com', clave: 'clave-segura-1' } });
    expect(antes.status).toBe(403);
    expect(antes.data.error).toBe('correo_sin_confirmar');

    const conf = await w.call('POST', '/datos/auth/confirmar', { body: { token: w.tokenDe(w.correos[0]) } });
    expect(conf.status).toBe(200);
    expect(conf.cookie).toMatch(/^ft_sesion=[0-9a-f]{64}$/);

    const otraVez = await w.call('POST', '/datos/auth/confirmar', { body: { token: w.tokenDe(w.correos[0]) } });
    expect(otraVez.data.error).toBe('enlace_vencido');

    const yo = await w.call('GET', '/datos/yo', { cookie: conf.cookie });
    expect(yo.data.usuario.nombre).toBe('Ana');

    const entra = await w.call('POST', '/datos/auth/entrar', { body: { email: 'ana@example.com', clave: 'clave-segura-1' } });
    expect(entra.status).toBe(200);
  });

  it('no guarda la contraseña en claro', async () => {
    const w = crearMundo();
    await w.usuario('b@example.com');
    const fila = await w.env.DB.prepare('SELECT clave_hash FROM usuarios').first<{ clave_hash: string }>();
    expect(fila!.clave_hash).toMatch(/^pbkdf2\$100000\$/);
    expect(fila!.clave_hash).not.toContain('clave-segura-1');
  });

  it('un correo ya confirmado no se puede registrar dos veces', async () => {
    const w = crearMundo();
    await w.usuario('c@example.com');
    const r = await w.call('POST', '/datos/auth/registro', {
      body: { nombre: 'Otro', email: 'c@example.com', clave: 'otra-clave-1' },
    });
    expect(r.status).toBe(409);
  });

  it('bloquea después de 8 contraseñas malas', async () => {
    const w = crearMundo();
    await w.usuario('d@example.com');
    for (let i = 0; i < 8; i++) {
      const r = await w.call('POST', '/datos/auth/entrar', { body: { email: 'd@example.com', clave: 'mala' } });
      expect(r.status).toBe(401);
    }
    const r = await w.call('POST', '/datos/auth/entrar', { body: { email: 'd@example.com', clave: 'clave-segura-1' } });
    expect(r.status).toBe(429);
  });

  it('olvidé mi contraseña: cambia la clave y cierra las sesiones viejas', async () => {
    const w = crearMundo();
    const vieja = await w.usuario('e@example.com');
    const r = await w.call('POST', '/datos/auth/olvide', { body: { email: 'e@example.com' } });
    expect(r.status).toBe(200);
    const correo = w.correos.at(-1)!;
    expect(correo.subject).toContain('Reset');
    const cambio = await w.call('POST', '/datos/auth/restablecer', {
      body: { token: w.tokenDe(correo), clave: 'nueva-clave-22' },
    });
    expect(cambio.status).toBe(200);
    expect((await w.call('GET', '/datos/yo', { cookie: vieja })).data.usuario).toBeNull();
    const entra = await w.call('POST', '/datos/auth/entrar', { body: { email: 'e@example.com', clave: 'nueva-clave-22' } });
    expect(entra.status).toBe(200);
  });

  it('olvidé mi contraseña no revela si el correo existe', async () => {
    const w = crearMundo();
    const r = await w.call('POST', '/datos/auth/olvide', { body: { email: 'nadie@example.com' } });
    expect(r.status).toBe(200);
    expect(w.correos).toHaveLength(0);
  });

  it('cerrar sesión la borra del servidor', async () => {
    const w = crearMundo();
    const cookie = await w.usuario('f@example.com');
    const r = await w.call('POST', '/datos/auth/salir', { cookie });
    expect(r.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await w.call('GET', '/datos/yo', { cookie })).data.usuario).toBeNull();
  });

  it('sin la cabecera de la app, ninguna escritura pasa', async () => {
    const w = crearMundo();
    const r = await w.call('POST', '/datos/auth/olvide', { body: { email: 'x@example.com' }, sinCabecera: true });
    expect(r.status).toBe(403);
  });

  it('borrar mi usuario quita sus datos y archiva sus cuentas', async () => {
    const w = crearMundo();
    const cookie = await w.usuario('g@example.com');
    await w.call('POST', '/datos/cuentas', { cookie, body: { nombre: 'Tienda', pin: '1234' } });
    const mal = await w.call('POST', '/datos/yo/borrar', { cookie, body: { clave: 'mala' } });
    expect(mal.status).toBe(401);
    const r = await w.call('POST', '/datos/yo/borrar', { cookie, body: { clave: 'clave-segura-1' } });
    expect(r.status).toBe(200);
    const entra = await w.call('POST', '/datos/auth/entrar', { body: { email: 'g@example.com', clave: 'clave-segura-1' } });
    expect(entra.status).toBe(401);
    const c = await w.env.DB.prepare('SELECT archivada_en FROM cuentas').first<{ archivada_en: number | null }>();
    expect(c!.archivada_en).not.toBeNull();
  });

  it('si el correo no sale, queda anotado en la tabla de errores', async () => {
    const w = crearMundo({ SITIO_TOKEN: undefined });
    await w.call('POST', '/datos/auth/registro', { body: { nombre: 'Hugo', email: 'h@example.com', clave: 'clave-segura-1' } });
    const e = await w.env.DB.prepare('SELECT mensaje FROM errores').first<{ mensaje: string }>();
    expect(e!.mensaje).toContain('correo no enviado');
  });
});
