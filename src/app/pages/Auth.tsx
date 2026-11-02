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

/** A dónde ir después de confirmar: lo que se pidió antes de registrarse, o el inicio. */
function siguienteGuardado(): string {
  let sig = '/home';
  try {
    sig = sessionStorage.getItem('fintwin:next') ?? '/home';
    sessionStorage.removeItem('fintwin:next');
  } catch {
    /* nada */
  }
  return sig.startsWith('/') && !sig.startsWith('//') ? sig : '/home';
}

/**
 * Confirmar el correo escribiendo el código de seis números, sin salir de la app.
 * El código no se guarda en el borrador (es de un solo uso).
 */
function ConfirmarConCodigo({ email }: { email: string }) {
  const { t } = useI18n();
  const msg = useMensajeError();
  const { recargar } = useSesion();
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [reenviado, setReenviado] = useState(false);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await api.post('/auth/confirmar-codigo', { email, codigo });
      await recargar();
      navigate(siguienteGuardado(), { replace: true });
    } catch (err) {
      setError(msg(err));
      setCodigo('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={confirmar} className="space-y-4 text-left">
      <Campo
        etiqueta={t('code.label')}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        required
        placeholder="000000"
        maxLength={6}
        className="text-center font-mono text-2xl tracking-[0.5em]"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
      />
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Boton type="submit" cargando={enviando} disabled={codigo.length !== 6} className="w-full">
        {t('code.confirm')}
      </Boton>
      <p className="text-center text-sm text-tenue">{t('signup.notArrived')}</p>
      {reenviado ? (
        <Aviso tipo="exito">{t('signup.resent')}</Aviso>
      ) : (
        <Boton
          type="button"
          variante="fantasma"
          className="w-full"
          onClick={() => void api.post('/auth/reenviar', { email }).then(() => setReenviado(true)).catch((e) => setError(msg(e)))}
        >
          {t('signup.resend')}
        </Boton>
      )}
    </form>
  );
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
          <ConfirmarConCodigo email={listo} />
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
      if ((err as { code?: string }).code === 'correo_sin_confirmar') {
        setSinConfirmar(true);
        // Se le manda un código nuevo para que confirme aquí mismo.
        void api.post('/auth/reenviar', { email: b.valores.email }).catch(() => undefined);
      }
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
          {sinConfirmar && <Aviso tipo="info">{t('login.unconfirmed')}</Aviso>}
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
        {sinConfirmar && (
          <div className="mt-6 border-t border-borde pt-6">
            <p className="mb-3 text-sm text-tenue">{t('signup.doneText', { email: b.valores.email })}</p>
            <ConfirmarConCodigo email={b.valores.email} />
          </div>
        )}
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
  const { usuario, cargando, recargar } = useSesion();
  const navigate = useNavigate();
  const [estado, setEstado] = useState<'trabajando' | 'ya' | 'mal'>('trabajando');
  const hecho = useRef(false);

  useEffect(() => {
    if (hecho.current || cargando) return;
    hecho.current = true;
    api
      .post('/auth/confirmar', { token: params.get('token') ?? '' })
      .then(async () => {
        await recargar();
        navigate(siguienteGuardado(), { replace: true });
      })
      .catch((err: { code?: string }) => {
        // Abrir otra vez el enlace con la sesión abierta: directo al inicio, sin errores.
        if (usuario) navigate('/home', { replace: true });
        else setEstado(err.code === 'ya_confirmado' ? 'ya' : 'mal');
      });
  }, [params, recargar, navigate, usuario, cargando]);

  return (
    <Pagina angosta>
      <Tarjeta className="space-y-4 text-center">
        {estado === 'trabajando' ? (
          <>
            <p className="font-semibold">{t('confirm.working')}</p>
            <Cargando />
          </>
        ) : (
          <>
            <Aviso tipo={estado === 'ya' ? 'exito' : 'error'}>{estado === 'ya' ? t('confirm.already') : t('confirm.bad')}</Aviso>
            <Link to="/login" className="block">
              <Boton className="w-full">{t('nav.signIn')}</Boton>
            </Link>
          </>
        )}
      </Tarjeta>
    </Pagina>
  );
}
