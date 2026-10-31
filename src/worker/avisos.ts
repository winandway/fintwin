import { z } from 'zod';
import { formatoDinero } from '../shared/reglas';
import { exigirUsuario, registrarError } from './auth';
import type { Env } from './env';
import { HttpError, json, readJson, type Ctx } from './http';

// Avisos al celular por el servicio de Expo (sirve para iPhone y Android). No necesita clave:
// el token del celular solo sirve para esta app.
const TOKEN_RE = /^ExponentPushToken\[[A-Za-z0-9_-]+\]$/;

export async function registrarDispositivo(ctx: Ctx): Promise<Response> {
  const u = await exigirUsuario(ctx);
  const r = z
    .object({ token: z.string().regex(TOKEN_RE), plataforma: z.enum(['ios', 'android']).optional() })
    .safeParse(await readJson(ctx.req));
  if (!r.success) throw new HttpError(400, 'datos_invalidos');
  // Si el celular pasó a otra persona (cerró sesión y entró otra), el token cambia de dueño.
  await ctx.env.DB.prepare(
    `INSERT INTO dispositivos (token, usuario_id, plataforma, actualizado_en) VALUES (?, ?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET usuario_id = excluded.usuario_id, plataforma = excluded.plataforma,
       actualizado_en = excluded.actualizado_en`,
  )
    .bind(r.data.token, u.id, r.data.plataforma ?? null, ctx.now)
    .run();
  return json({ ok: true });
}

export async function quitarDispositivo(ctx: Ctx): Promise<Response> {
  const r = z.object({ token: z.string().regex(TOKEN_RE) }).safeParse(await readJson(ctx.req));
  if (!r.success) throw new HttpError(400, 'datos_invalidos');
  await ctx.env.DB.prepare('DELETE FROM dispositivos WHERE token = ?').bind(r.data.token).run();
  return json({ ok: true });
}

/** Avisa al equipo de la cuenta que hay una captura nueva por revisar. Nunca rompe la subida. */
export async function avisarCapturaNueva(
  env: Env,
  cuenta: { id: string; nombre: string },
  montoCent: number,
  quien: string,
  now: number,
): Promise<void> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT d.token, u.idioma FROM miembros m
       JOIN dispositivos d ON d.usuario_id = m.usuario_id
       JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.cuenta_id = ? AND u.borrado_en IS NULL`,
    )
      .bind(cuenta.id)
      .all<{ token: string; idioma: 'en' | 'es' }>();
    if (!results.length) return;
    const mensajes = results.map((r) => ({
      to: r.token,
      sound: 'default',
      title: r.idioma === 'es' ? `Captura nueva · ${cuenta.nombre}` : `New receipt · ${cuenta.nombre}`,
      body:
        r.idioma === 'es'
          ? `${formatoDinero(montoCent, 'es')} de ${quien}. Toca para revisarla.`
          : `${formatoDinero(montoCent, 'en')} from ${quien}. Tap to review it.`,
      data: { url: `/accounts/${cuenta.id}` },
    }));
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(mensajes),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json().catch(() => ({}))) as { data?: { status?: string; details?: { error?: string } }[] };
    // Los celulares que desinstalaron la app se borran para no seguir avisando al vacío.
    const muertos = (data.data ?? [])
      .map((d, i) => (d.details?.error === 'DeviceNotRegistered' ? mensajes[i]?.to : null))
      .filter((t): t is string => Boolean(t));
    for (const t of muertos) await env.DB.prepare('DELETE FROM dispositivos WHERE token = ?').bind(t).run();
    if (!res.ok) await registrarError(env, 'avisos', `expo push ${res.status}`, now);
  } catch (e) {
    await registrarError(env, 'avisos', `expo push: ${String(e)}`, now);
  }
}
