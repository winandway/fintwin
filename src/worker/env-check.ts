import { z } from 'zod';
import type { Env } from './env';

// Variables del sitio revisadas con zod. Las obligatorias apagan el canario si faltan;
// las opcionales solo tienen que venir bien formadas cuando están.
const texto = z.string().trim().min(1);
const esquema = z
  .object({
    MAIL_FROM: z.email(),
    SITIO_TOKEN: texto,
    APP_URL: z.url().optional(),
    GEMINI_API_KEY: texto.optional(),
    TURNSTILE_SITE_KEY: texto.optional(),
    TURNSTILE_SECRET_KEY: texto.optional(),
    GERENTE_SECRETO: texto.optional(),
    ARCHIVOS_FIRMA: texto.optional(),
  })
  // El escudo anti-robots va completo o apagado: una sola clave cargada es un error de configuración.
  .refine((e) => Boolean(e.TURNSTILE_SITE_KEY) === Boolean(e.TURNSTILE_SECRET_KEY), {
    message: 'TURNSTILE_SITE_KEY y TURNSTILE_SECRET_KEY van juntas',
    path: ['TURNSTILE_SECRET_KEY'],
  });

/** Devuelve la lista de variables mal cargadas (vacía si todo está bien). Nunca devuelve valores. */
export function revisarVariables(env: Env): string[] {
  const r = esquema.safeParse(env);
  return r.success ? [] : [...new Set(r.error.issues.map((i) => String(i.path[0] ?? 'env')))];
}
