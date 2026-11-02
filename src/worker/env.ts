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
  GEMINI_API_KEY_BACKUP?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  /** Secreto de la puerta del gerente de correo (casos de ayuda). Sin él, la puerta no existe. */
  GERENTE_SECRETO?: string;
  /** Llave con la que se firman los enlaces de las capturas de los casos de ayuda. */
  ARCHIVOS_FIRMA?: string;
}

export const APP_URL_DEFAULT = 'https://fintwin.windoce.com';
