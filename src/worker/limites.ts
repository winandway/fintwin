import type { Env } from './env';
import { HttpError } from './http';

// Límite de intentos guardado en la base (no hay KV). Una fila por clave
// («login:correo», «pin:usuario:cuenta», «correo:…»).

interface Fila {
  fallos: number;
  ventana_desde: number;
  bloqueado_hasta: number;
}

export async function exigirNoBloqueado(env: Env, clave: string, now: number): Promise<void> {
  const fila = await env.DB.prepare('SELECT bloqueado_hasta FROM intentos WHERE clave = ?')
    .bind(clave)
    .first<{ bloqueado_hasta: number }>();
  if (fila && fila.bloqueado_hasta > now) {
    throw new HttpError(429, 'demasiados_intentos', { esperar_min: Math.ceil((fila.bloqueado_hasta - now) / 60000) });
  }
}

/** Suma un intento. Si llega al máximo dentro de la ventana, bloquea por `bloqueoMin`. */
export async function sumarIntento(
  env: Env,
  clave: string,
  now: number,
  max: number,
  ventanaMin: number,
  bloqueoMin: number,
): Promise<number> {
  const fila = await env.DB.prepare('SELECT fallos, ventana_desde, bloqueado_hasta FROM intentos WHERE clave = ?')
    .bind(clave)
    .first<Fila>();
  const vigente = fila && now - fila.ventana_desde < ventanaMin * 60000;
  const fallos = vigente ? fila.fallos + 1 : 1;
  const desde = vigente ? fila.ventana_desde : now;
  const bloqueado = fallos >= max ? now + bloqueoMin * 60000 : 0;
  await env.DB.prepare(
    `INSERT INTO intentos (clave, fallos, ventana_desde, bloqueado_hasta) VALUES (?, ?, ?, ?)
     ON CONFLICT(clave) DO UPDATE SET fallos = excluded.fallos, ventana_desde = excluded.ventana_desde,
       bloqueado_hasta = excluded.bloqueado_hasta`,
  )
    .bind(clave, fallos, desde, bloqueado)
    .run();
  return Math.max(0, max - fallos);
}

export async function limpiarIntentos(env: Env, clave: string): Promise<void> {
  await env.DB.prepare('DELETE FROM intentos WHERE clave = ?').bind(clave).run();
}

/** Para acciones que no fallan pero se deben racionar (mandar correos, crear usuarios). */
export async function racionar(env: Env, clave: string, now: number, max: number, ventanaMin: number): Promise<void> {
  await exigirNoBloqueado(env, clave, now);
  await sumarIntento(env, clave, now, max + 1, ventanaMin, ventanaMin);
}
