import { MailCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CampoClave } from '../components/CampoClave';
import { Turnstile } from '../components/Turnstile';
import { Aviso, AvisoBorrador, Boton, Campo, Cargando, Pagina, Tarjeta } from '../components/ui';
import { api } from '../lib/api';
import { useBorrador } from '../lib/borrador';
import { useI18n, useMensajeError } from '../lib/i18n';
import { useSesion } from '../lib/sesion';

/** A dónde volver después de entrar (solo rutas internas). */
function useSiguiente(): string {
  const [params] = useSearchParams();
  const sig = params.get('next') ?? '/home';
  return sig.startsWith('/') && !sig.startsWith('//') ? sig : '/home';
}

export function SignUp() {
  const { t, idioma } = useI18n();
  const msg = useMensajeError();
  const siguiente = useSiguiente();
  const b = useBorrador('registro', 'anonimo', { nombre: '', email: '', clave: '' }, ['clave']);
  const [turnstile, setTurnstile] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState<string | null>(null);
  const [reenviado, setReenviado] = useState(false);
  const onToken = useCallback((tk: string) => setTurnstile(tk), []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await api.post('/auth/registro', { ...b.valores, idioma, turnstile });
      setListo(b.valores.email);
      try {
        sessionStorage.setItem('fintwin:next', siguiente);
      } catch {
        /* nada */
      }
      b.limpiar();
    } catch (err) {
      setError(msg(err));
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <Pagina angosta>
        <Tarjeta className="space-y-4 text-center">
          <MailCheck className="mx-auto h-12 w-12 text-exito" aria-hidden />
          <h1 className="text-xl font-bold">{t('signup.done')}</h1>
          <p className="text-tenue">{t('signup.doneText', { email: listo })}</p>
          <p className="text-sm text-tenue">{t('signup.notArrived')}</p>
          {reenviado ? (
            <Aviso tipo="exito">{t('signup.resent')}</Aviso>
          ) : (
            <Boton
              variante="secundario"
              className="w-full"
              onClick={() => void api.post('/auth/reenviar', { email: listo }).then(() => setReenviado(true)).catch((e) => setError(msg(e)))}
            >
              {t('signup.resend')}
            </Boton>
          )}
          {error && <Aviso tipo="error">{error}</Aviso>}
        </Tarjeta>
      </Pagina>
    );
  }

  return (
    <Pagina angosta>
      <Tarjeta>
        <h1 className="mb-4 text-xl font-bold">{t('signup.title')}</h1>
        <form onSubmit={enviar} className="space-y-4">
          <AvisoBorrador visible={b.recuperado} onEmpezar={b.limpiar} />
          <Campo etiqueta={t('field.name')} required minLength={2} maxLength={80} autoComplete="name" value={b.valores.nombre} onChange={(e) => b.set('nombre', e.target.value)} />
          <Campo etiqueta={t('field.email')} type="email" required autoComplete="email" placeholder="email@example.com" value={b.valores.email} onChange={(e) => b.set('email', e.target.value)} />
          <CampoClave etiqueta={t('field.password')} ayuda={t('field.passwordHint')} required minLength={8} autoComplete="new-password" value={b.valores.clave} onChange={(e) => b.set('clave', e.target.value)} />
          <Turnstile onToken={onToken} />
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Boton type="submit" cargando={enviando} className="w-full">
            {t('nav.signUp')}
          </Boton>
          <p className="text-center text-xs text-tenue">{t('signup.terms')}</p>
          <p className="text-center text-sm">
            <Link to={`/login?next=${encodeURIComponent(siguiente)}`} className="font-semibold text-marca">
              {t('landing.have')}
            </Link>
          </p>
        </form>
      </Tarjeta>
    </Pagina>
  );
}

export function Login() {
  const { t } = useI18n();
  const msg = useMensajeError();
  const siguiente = useSiguiente();
  const { recargar } = useSesion();
  const navigate = useNavigate();
  const b = useBorrador('entrar', 'anonimo', { email: '', clave: '' }, ['clave']);
  const [turnstile, setTurnstile] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [sinConfirmar, setSinConfirmar] = useState(false);
  const [reenviado, setReenviado] = useState(false);
  const onToken = useCallback((tk: string) => setTurnstile(tk), []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    setSinConfirmar(false);
    try {
      await api.post('/auth/entrar', { email: b.valores.email, clave: b.valores.clave, turnstile });
      b.limpiar();
      await recargar();
      navigate(siguiente, { replace: true });
    } catch (err) {
      if ((err as { code?: string }).code === 'correo_sin_confirmar') setSinConfirmar(true);
      else setError(msg(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pagina angosta>
      <Tarjeta>
        <h1 className="mb-4 text-xl font-bold">{t('login.title')}</h1>
        <form onSubmit={enviar} className="space-y-4">
          <AvisoBorrador visible={b.recuperado} onEmpezar={b.limpiar} />
          <Campo etiqueta={t('field.email')} type="email" required autoComplete="email" placeholder="email@example.com" value={b.valores.email} onChange={(e) => b.set('email', e.target.value)} />
          <CampoClave etiqueta={t('field.password')} required autoComplete="current-password" value={b.valores.clave} onChange={(e) => b.set('clave', e.target.value)} />
          <Turnstile onToken={onToken} />
          {error && <Aviso tipo="error">{error}</Aviso>}
          {sinConfirmar && (
            <Aviso tipo="info">
              <p>{t('login.unconfirmed')}</p>
              {reenviado ? (
                <p className="mt-1 text-green-300">{t('signup.resent')}</p>
              ) : (
                <button
                  type="button"
                  className="mt-1 font-semibold text-marca"
                  onClick={() => void api.post('/auth/reenviar', { email: b.valores.email }).then(() => setReenviado(true))}
                >
                  {t('signup.resend')}
                </button>
              )}
            </Aviso>
          )}
          <Boton type="submit" cargando={enviando} className="w-full">
            {t('nav.signIn')}
          </Boton>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <Link to="/forgot" className="text-tenue hover:text-white">
              {t('login.forgot')}
            </Link>
            <Link to={`/signup?next=${encodeURIComponent(siguiente)}`} className="font-semibold text-marca">
              {t('nav.signUp')}
            </Link>
          </div>
        </form>
      </Tarjeta>
    </Pagina>
  );
}

export function Forgot() {
  const { t } = useI18n();
  const msg = useMensajeError();
  const b = useBorrador('olvide', 'anonimo', { email: '' });
  const [turnstile, setTurnstile] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  const onToken = useCallback((tk: string) => setTurnstile(tk), []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await api.post('/auth/olvide', { email: b.valores.email, turnstile });
      b.limpiar();
      setListo(true);
    } catch (err) {
      setError(msg(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pagina angosta>
      <Tarjeta className="space-y-4">
        <h1 className="text-xl font-bold">{t('forgot.title')}</h1>
        {listo ? (
          <Aviso tipo="exito">{t('forgot.sent')}</Aviso>
        ) : (
          <form onSubmit={enviar} className="space-y-4">
            <p className="text-sm text-tenue">{t('forgot.text')}</p>
            <AvisoBorrador visible={b.recuperado} onEmpezar={b.limpiar} />
            <Campo etiqueta={t('field.email')} type="email" required autoComplete="email" placeholder="email@example.com" value={b.valores.email} onChange={(e) => b.set('email', e.target.value)} />
            <Turnstile onToken={onToken} />
            {error && <Aviso tipo="error">{error}</Aviso>}
            <Boton type="submit" cargando={enviando} className="w-full">
              {t('forgot.send')}
            </Boton>
          </form>
        )}
        <Link to="/login" className="block text-center text-sm text-tenue hover:text-white">
          {t('common.back')}
        </Link>
      </Tarjeta>
    </Pagina>
  );
}

export function Reset() {
  const { t } = useI18n();
  const msg = useMensajeError();
  const [params] = useSearchParams();
  const { recargar } = useSesion();
  const navigate = useNavigate();
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await api.post('/auth/restablecer', { token: params.get('token') ?? '', clave });
      await recargar();
      navigate('/home', { replace: true });
    } catch (err) {
      setError(msg(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pagina angosta>
      <Tarjeta>
        <h1 className="mb-4 text-xl font-bold">{t('reset.title')}</h1>
        <form onSubmit={enviar} className="space-y-4">
          <CampoClave etiqueta={t('field.newPassword')} ayuda={t('field.passwordHint')} required minLength={8} autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Boton type="submit" cargando={enviando} className="w-full">
            {t('common.save')}
          </Boton>
        </form>
      </Tarjeta>
    </Pagina>
  );
}

export function Confirm() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const { recargar } = useSesion();
  const navigate = useNavigate();
  const [mal, setMal] = useState(false);
  const hecho = useRef(false);

  useEffect(() => {
    if (hecho.current) return;
    hecho.current = true;
    api
      .post('/auth/confirmar', { token: params.get('token') ?? '' })
      .then(async () => {
        await recargar();
        let sig = '/home';
        try {
          sig = sessionStorage.getItem('fintwin:next') ?? '/home';
          sessionStorage.removeItem('fintwin:next');
        } catch {
          /* nada */
        }
        navigate(sig.startsWith('/') && !sig.startsWith('//') ? sig : '/home', { replace: true });
      })
      .catch(() => setMal(true));
  }, [params, recargar, navigate]);

  return (
    <Pagina angosta>
      <Tarjeta className="space-y-4 text-center">
        {mal ? (
          <>
            <Aviso tipo="error">{t('confirm.bad')}</Aviso>
            <Link to="/login" className="font-semibold text-marca">
              {t('nav.signIn')}
            </Link>
          </>
        ) : (
          <>
            <p className="font-semibold">{t('confirm.working')}</p>
            <Cargando />
          </>
        )}
      </Tarjeta>
    </Pagina>
  );
}
