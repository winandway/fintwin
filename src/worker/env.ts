export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  /** Dirección pública oficial (enlaces de los correos). */
  APP_URL?: string;
  /** Remitente de los correos: no-reply@fintwin.windoce.com */
  MAIL_FROM?: string;
  /** Nombre del sitio en YaDominios Cloud y su token (secreto) para la API de correo. */
  SITIO?: string;
  SITIO_TOKEN?: string;
  GEMINI_API_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

export const APP_URL_DEFAULT = 'https://fintwin.windoce.com';
