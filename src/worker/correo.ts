import { APP_URL_DEFAULT, type Env } from './env';

type Idioma = 'en' | 'es';

export interface Correo {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export function appUrl(env: Env): string {
  return (env.APP_URL ?? APP_URL_DEFAULT).replace(/\/$/, '');
}

function plantilla(titulo: string, cuerpo: string, boton: string, enlace: string, pie: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0">
<tr><td style="font-size:20px;font-weight:bold;padding-bottom:8px">FinTwin</td></tr>
<tr><td style="font-size:18px;font-weight:bold;padding-bottom:12px">${titulo}</td></tr>
<tr><td style="font-size:15px;line-height:1.5;color:#334155;padding-bottom:24px">${cuerpo}</td></tr>
<tr><td><a href="${enlace}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">${boton}</a></td></tr>
<tr><td style="font-size:12px;color:#64748b;padding-top:24px">${pie}</td></tr>
</table>
<p style="font-size:11px;color:#94a3b8">© ${new Date().getUTCFullYear()} FinTwin · Developed by Windoce LLC</p>
</td></tr></table></body></html>`;
}

export function correoConfirmar(env: Env, to: string, nombre: string, token: string, idioma: Idioma): Correo {
  const enlace = `${appUrl(env)}/confirm?token=${token}`;
  const es = idioma === 'es';
  const subject = es ? 'Confirma tu correo en FinTwin' : 'Confirm your email for FinTwin';
  const cuerpo = es
    ? `Hola, ${nombre}. Toca el botón para confirmar tu correo y empezar a usar FinTwin.`
    : `Hi ${nombre}, tap the button to confirm your email and start using FinTwin.`;
  const boton = es ? 'Confirmar mi correo' : 'Confirm my email';
  const pie = es
    ? 'El enlace vence en 48 horas. Si no creaste una cuenta, ignora este correo.'
    : 'This link expires in 48 hours. If you did not create an account, ignore this email.';
  return { to, subject, text: `${cuerpo}\n\n${enlace}\n\n${pie}`, html: plantilla(subject, cuerpo, boton, enlace, pie) };
}

export function correoRestablecer(env: Env, to: string, nombre: string, token: string, idioma: Idioma): Correo {
  const enlace = `${appUrl(env)}/reset?token=${token}`;
  const es = idioma === 'es';
  const subject = es ? 'Cambia tu contraseña de FinTwin' : 'Reset your FinTwin password';
  const cuerpo = es
    ? `Hola, ${nombre}. Recibimos un pedido para cambiar tu contraseña. Toca el botón para elegir una nueva.`
    : `Hi ${nombre}, we received a request to reset your password. Tap the button to choose a new one.`;
  const boton = es ? 'Elegir una contraseña nueva' : 'Choose a new password';
  const pie = es
    ? 'El enlace vence en 1 hora y sirve una sola vez. Si no lo pediste, ignora este correo: tu contraseña no cambia.'
    : 'This link expires in 1 hour and works once. If you did not ask for it, ignore this email: your password stays the same.';
  return { to, subject, text: `${cuerpo}\n\n${enlace}\n\n${pie}`, html: plantilla(subject, cuerpo, boton, enlace, pie) };
}

/** Envía por la API de correo de YaDominios Cloud. Devuelve false si falló (y lo deja escrito). */
export async function enviarCorreo(env: Env, correo: Correo): Promise<boolean> {
  if (!env.SITIO_TOKEN || !env.MAIL_FROM) {
    console.error('correo: falta SITIO_TOKEN o MAIL_FROM');
    return false;
  }
  try {
    const res = await fetch('https://yapanel.yadominios.com/api/hosting/correo/enviar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sitio: env.SITIO ?? 'fintwin',
        token: env.SITIO_TOKEN,
        from: { address: env.MAIL_FROM, name: 'FinTwin' },
        to: [{ address: correo.to }],
        subject: correo.subject,
        text: correo.text,
        html: correo.html,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) console.error('correo: respuesta', res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error('correo: error', e);
    return false;
  }
}
