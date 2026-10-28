import * as auth from './auth';
import * as cuentas from './cuentas';
import type { Env } from './env';
import { HttpError, json, Router, withSecurityHeaders, type Ctx } from './http';
import * as pagar from './pagar';

declare const __VERSION__: string;
const VERSION = typeof __VERSION__ === 'string' ? __VERSION__ : 'local';

export const router = new Router()
  .on('GET', '/datos/salud', salud)
  .on('GET', '/datos/config', config)
  .on('POST', '/datos/auth/registro', auth.registro)
  .on('POST', '/datos/auth/confirmar', auth.confirmar)
  .on('POST', '/datos/auth/reenviar', auth.reenviarConfirmacion)
  .on('POST', '/datos/auth/entrar', auth.entrar)
  .on('POST', '/datos/auth/salir', auth.salir)
  .on('POST', '/datos/auth/olvide', auth.olvide)
  .on('POST', '/datos/auth/restablecer', auth.restablecer)
  .on('GET', '/datos/yo', auth.yo)
  .on('POST', '/datos/yo/idioma', auth.cambiarIdioma)
  .on('POST', '/datos/yo/borrar', auth.borrarUsuario)
  .on('GET', '/datos/cuentas', cuentas.listarCuentas)
  .on('POST', '/datos/cuentas', cuentas.crearCuenta)
  .on('GET', '/datos/cuentas/:id', cuentas.verCuenta)
  .on('GET', '/datos/cuentas/:id/comprobantes', cuentas.listarComprobantes)
  .on('POST', '/datos/cuentas/:id/revisar', cuentas.revisar)
  .on('POST', '/datos/cuentas/:id/salidas', cuentas.registrarSalida)
  .on('POST', '/datos/cuentas/:id/ajustes', cuentas.ajustesCuenta)
  .on('POST', '/datos/cuentas/:id/link', cuentas.rotarLink)
  .on('POST', '/datos/cuentas/:id/mi-pin', cuentas.cambiarMiPin)
  .on('GET', '/datos/cuentas/:id/equipo', cuentas.verEquipo)
  .on('POST', '/datos/cuentas/:id/invitaciones', cuentas.crearInvitacion)
  .on('POST', '/datos/cuentas/:id/invitaciones/anular', cuentas.anularInvitacion)
  .on('POST', '/datos/cuentas/:id/equipo/quitar', cuentas.quitarMiembro)
  .on('POST', '/datos/cuentas/:id/salir', cuentas.salirDelEquipo)
  .on('GET', '/datos/invitaciones/:token', cuentas.verInvitacion)
  .on('POST', '/datos/invitaciones/:token/aceptar', cuentas.aceptarInvitacion)
  .on('GET', '/datos/pagar/:slug', pagar.verLinkDePago)
  .on('POST', '/datos/pagar/:slug/subir', pagar.subirCaptura)
  .on('GET', '/datos/mis-pagos', pagar.misPagos)
  .on('GET', '/datos/archivo/:id', pagar.verArchivo);

/** Canario: cada pieza dice ok o error. Sin valores secretos. */
async function salud(ctx: Ctx): Promise<Response> {
  const piezas: Record<string, 'ok' | 'error' | 'apagado'> = {};
  try {
    await ctx.env.DB.prepare('SELECT COUNT(*) FROM usuarios').first();
    piezas.base = 'ok';
  } catch {
    piezas.base = 'error';
  }
  try {
    await ctx.env.BUCKET.head('salud');
    piezas.almacen = 'ok';
  } catch {
    piezas.almacen = 'error';
  }
  piezas.correo = ctx.env.SITIO_TOKEN && ctx.env.MAIL_FROM ? 'ok' : 'error';
  piezas.lectura_ia = ctx.env.GEMINI_API_KEY ? 'ok' : 'apagado';
  piezas.turnstile = ctx.env.TURNSTILE_SECRET_KEY && ctx.env.TURNSTILE_SITE_KEY ? 'ok' : 'apagado';
  const ok = piezas.base === 'ok' && piezas.almacen === 'ok' && piezas.correo === 'ok';
  return json({ ok, version: VERSION, piezas }, ok ? 200 : 503);
}

async function config(ctx: Ctx): Promise<Response> {
  return json({ turnstile_site_key: ctx.env.TURNSTILE_SITE_KEY ?? null, lectura_ia: Boolean(ctx.env.GEMINI_API_KEY) });
}

async function datos(req: Request, env: Env, url: URL): Promise<Response> {
  const ctx: Ctx = { req, env, url, params: {}, now: Date.now() };
  try {
    // Contra peticiones de otros sitios: toda escritura lleva la cabecera propia de la app,
    // que un formulario ajeno no puede poner sin permiso del navegador.
    if (req.method !== 'GET' && req.headers.get('x-fintwin') !== '1') throw new HttpError(403, 'origen_invalido');
    const m = router.match(req.method, url.pathname);
    if (!m) throw new HttpError(404, 'no_existe');
    ctx.params = m.params;
    return await m.handler(ctx);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code, ...e.extra }, e.status);
    const mensaje = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
    console.error(url.pathname, mensaje);
    await auth.registrarError(env, `${req.method} ${url.pathname}`, mensaje, ctx.now);
    return json({ error: 'error_interno' }, 500);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/datos/')) return withSecurityHeaders(await datos(req, env, url));

    // Pantallas: los estáticos, y para cualquier ruta de la app, la portada (index.html).
    // Se pide «/» y no «/index.html»: los estáticos desvían /index.html a «/» con un 307,
    // y ese desvío llegaba al navegador y lo sacaba de la pantalla pedida.
    let res = await env.ASSETS.fetch(req);
    const esPagina = req.method === 'GET' && !/\.[a-z0-9]+$/i.test(url.pathname);
    if (esPagina && url.pathname !== '/' && (res.status === 404 || (res.status >= 300 && res.status < 400))) {
      res = await env.ASSETS.fetch(new Request(new URL('/', url), req));
    }
    return withSecurityHeaders(res);
  },
};
