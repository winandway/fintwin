import { CheckCircle2, ImagePlus, ReceiptText, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CaptureGuide } from '../components/CaptureGuide';
import { CampoClave } from '../components/CampoClave';
import { Aviso, AvisoBorrador, Boton, Campo, Cargando, Pagina, Tarjeta } from '../components/ui';
import { formatoDinero, MAX_ARCHIVO } from '../../shared/reglas';
import { api, ApiError } from '../lib/api';
import { limpiarBorradores, useBorrador } from '../lib/borrador';
import { useI18n, useMensajeError } from '../lib/i18n';
import { prepararImagen } from '../lib/imagen';
import { useSesion } from '../lib/sesion';

export function Landing() {
  const { t } = useI18n();
  return (
    <Pagina>
      <section className="py-8 text-center">
        <img src="/icon.png" alt="" className="mx-auto mb-5 h-20 w-20 rounded-2xl" />
        <h1 className="text-3xl font-bold sm:text-4xl">{t('landing.title')}</h1>
        <p className="mx-auto mt-3 max-w-md text-tenue">{t('app.tagline')}</p>
        <div className="mx-auto mt-6 flex max-w-xs flex-col gap-2">
          <Link to="/signup">
            <Boton className="w-full">{t('landing.start')}</Boton>
          </Link>
          <Link to="/login">
            <Boton variante="secundario" className="w-full">
              {t('landing.have')}
            </Boton>
          </Link>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { icono: <ReceiptText className="h-6 w-6 text-marca" />, texto: t('landing.p1') },
          { icono: <ShieldCheck className="h-6 w-6 text-marca-2" />, texto: t('landing.p2') },
          { icono: <Users className="h-6 w-6 text-marca" />, texto: t('team.text') },
        ].map((x) => (
          <Tarjeta key={x.texto} className="space-y-2">
            {x.icono}
            <p className="text-sm text-tenue">{x.texto}</p>
          </Tarjeta>
        ))}
      </section>
      <p className="mt-8 text-center text-xs text-tenue">{t('app.notMoney')}</p>
    </Pagina>
  );
}

/** El link que comparte la empresa: guía de la captura, subirla y listo. */
export function Pay() {
  const { slug = '' } = useParams();
  const { t, idioma } = useI18n();
  const msg = useMensajeError();
  const { usuario, cargando } = useSesion();
  const location = useLocation();
  const [info, setInfo] = useState<{ valido: boolean; nombre?: string; lectura_ia?: boolean } | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState('');
  const b = useBorrador(`pagar-${slug}`, usuario?.id ?? 'anonimo', { monto: '', confirmacion: '', fecha: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [faltaNumero, setFaltaNumero] = useState(false);
  const [listo, setListo] = useState<{ monto_cent: number | null; confirmacion: string | null } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<{ valido: boolean; nombre?: string; lectura_ia?: boolean }>(`/pagar/${slug}`).then(setInfo).catch(() => setInfo({ valido: false }));
  }, [slug]);
  useEffect(() => () => {
    if (vista) URL.revokeObjectURL(vista);
  }, [vista]);

  if (!info || cargando) return <Cargando />;
  if (!info.valido) return <Pagina angosta><Aviso tipo="error">{t('pay.invalid')}</Aviso></Pagina>;
  const nombre = info.nombre ?? '';
  const siguiente = encodeURIComponent(location.pathname);

  if (!usuario) {
    return (
      <Pagina angosta>
        <h1 className="text-xl font-bold">{t('pay.title')}</h1>
        <p className="mb-4 text-tenue">{t('pay.for', { name: nombre })}</p>
        <CaptureGuide payeeName={nombre} />
        <Tarjeta className="mt-4 space-y-3">
          <p className="text-sm text-tenue">{t('pay.signIn')}</p>
          <Link to={`/signup?next=${siguiente}`}>
            <Boton className="w-full">{t('nav.signUp')}</Boton>
          </Link>
          <Link to={`/login?next=${siguiente}`}>
            <Boton variante="secundario" className="mt-2 w-full">
              {t('nav.signIn')}
            </Boton>
          </Link>
        </Tarjeta>
      </Pagina>
    );
  }

  if (listo) {
    return (
      <Pagina angosta>
        <Tarjeta className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-exito" aria-hidden />
          <h1 className="text-xl font-bold">{t('pay.sent')}</h1>
          {listo.monto_cent !== null && <p className="font-mono text-2xl font-bold">{formatoDinero(listo.monto_cent, idioma)}</p>}
          <p className="font-mono text-sm text-tenue">#{listo.confirmacion}</p>
          <p className="text-sm text-tenue">{t('pay.sentText', { name: nombre })}</p>
          <div className="flex gap-2 pt-2">
            <Link to="/home" className="flex-1">
              <Boton variante="secundario" className="w-full">{t('home.myPayments')}</Boton>
            </Link>
            <Boton className="flex-1" onClick={() => { setListo(null); setArchivo(null); setVista(''); }}>
              {t('pay.another')}
            </Boton>
          </div>
        </Tarjeta>
      </Pagina>
    );
  }

  function elegir(f: File | undefined) {
    setError('');
    setFaltaNumero(false);
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError(t('err.no_es_imagen'));
    setArchivo(f);
    setVista(URL.createObjectURL(f));
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!archivo) return;
    setEnviando(true);
    setError('');
    setFaltaNumero(false);
    try {
      const blob = await prepararImagen(archivo);
      if (blob.size > MAX_ARCHIVO) throw new ApiError(413, 'archivo_grande', {});
      const form = new FormData();
      form.append('archivo', blob, 'captura');
      if (!info?.lectura_ia) {
        form.append('monto', b.valores.monto);
        form.append('confirmacion', b.valores.confirmacion);
        form.append('fecha', b.valores.fecha);
      }
      const r = await api.form<{ lectura: { monto_cent: number | null; confirmacion: string | null } }>(`/pagar/${slug}/subir`, form);
      b.limpiar();
      setListo(r.lectura);
    } catch (err) {
      const code = (err as ApiError).code;
      if (code === 'sin_confirmacion' || code === 'sin_monto') setFaltaNumero(true);
      setError(code === 'sin_confirmacion' && !info?.lectura_ia ? t('err.sin_confirmacion_manual') : msg(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pagina angosta>
      <h1 className="text-xl font-bold">{t('pay.title')}</h1>
      <p className="mb-4 text-tenue">{t('pay.for', { name: nombre })}</p>
      {!archivo && <CaptureGuide payeeName={nombre} />}
      <form onSubmit={enviar} className="mt-4 space-y-4">
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} data-testid="archivo" />
        {vista ? (
          <div className="space-y-2">
            <img src={vista} alt="" className="mx-auto max-h-80 rounded-xl border border-borde object-contain" />
            <Boton type="button" variante="fantasma" className="w-full" onClick={() => input.current?.click()}>
              {t('pay.change')}
            </Boton>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-borde bg-panel px-4 py-8 text-tenue hover:border-marca hover:text-white"
          >
            <ImagePlus className="h-8 w-8" aria-hidden />
            <span className="font-semibold">{t('pay.choose')}</span>
          </button>
        )}

        {!info.lectura_ia && (
          <div className="space-y-3">
            <AvisoBorrador visible={b.recuperado} onEmpezar={b.limpiar} />
            <Campo etiqueta={t('pay.amount')} inputMode="decimal" required placeholder="0.00" value={b.valores.monto} onChange={(e) => b.set('monto', e.target.value)} />
            <Campo etiqueta={t('pay.confirmation')} required placeholder="0000000000" value={b.valores.confirmacion} onChange={(e) => b.set('confirmacion', e.target.value)} />
            <Campo etiqueta={t('pay.date')} type="date" value={b.valores.fecha} onChange={(e) => b.set('fecha', e.target.value)} />
          </div>
        )}

        {error && <Aviso tipo="error">{error}</Aviso>}
        {faltaNumero && <CaptureGuide payeeName={nombre} alert />}
        <Boton type="submit" cargando={enviando} disabled={!archivo} className="w-full">
          {enviando ? t('pay.sending') : t('pay.send')}
        </Boton>
      </form>
    </Pagina>
  );
}

export function Invite() {
  const { token = '' } = useParams();
  const { t } = useI18n();
  const msg = useMensajeError();
  const { usuario, cargando } = useSesion();
  const navigate = useNavigate();
  const location = useLocation();
  const [info, setInfo] = useState<{ valida: boolean; cuenta_nombre?: string; invita?: string } | null>(null);
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ valida: boolean; cuenta_nombre?: string; invita?: string }>(`/invitaciones/${token}`).then(setInfo).catch(() => setInfo({ valida: false }));
  }, [token]);

  if (!info || cargando) return <Cargando />;
  if (!info.valida) return <Pagina angosta><Aviso tipo="error">{t('invite.invalid')}</Aviso></Pagina>;

  async function aceptar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const r = await api.post<{ cuenta_id: string }>(`/invitaciones/${token}/aceptar`, { pin });
      navigate(`/accounts/${r.cuenta_id}`, { replace: true });
    } catch (err) {
      setError(msg(err));
    } finally {
      setEnviando(false);
    }
  }

  const siguiente = encodeURIComponent(location.pathname);
  return (
    <Pagina angosta>
      <Tarjeta className="space-y-4">
        <h1 className="text-xl font-bold">{t('invite.title')}</h1>
        <p className="text-tenue">{t('invite.text', { who: info.invita ?? '', account: info.cuenta_nombre ?? '' })}</p>
        {usuario ? (
          <form onSubmit={aceptar} className="space-y-4">
            <CampoClave pin etiqueta={t('invite.createPin')} ayuda={t('field.pinHint')} required value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
            {error && <Aviso tipo="error">{error}</Aviso>}
            <Boton type="submit" cargando={enviando} disabled={pin.length !== 4} className="w-full">
              {t('invite.accept')}
            </Boton>
          </form>
        ) : (
          <>
            <p className="text-sm text-tenue">{t('invite.signInFirst')}</p>
            <Link to={`/signup?next=${siguiente}`}>
              <Boton className="w-full">{t('nav.signUp')}</Boton>
            </Link>
            <Link to={`/login?next=${siguiente}`}>
              <Boton variante="secundario" className="mt-2 w-full">{t('nav.signIn')}</Boton>
            </Link>
          </>
        )}
      </Tarjeta>
    </Pagina>
  );
}

export function DeleteAccount() {
  const { t } = useI18n();
  const msg = useMensajeError();
  const { usuario } = useSesion();
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState(false);

  async function borrar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await api.post('/yo/borrar', { clave });
      limpiarBorradores();
      setHecho(true);
      setTimeout(() => window.location.assign('/'), 2500);
    } catch (err) {
      setError(msg(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pagina angosta>
      <h1 className="mb-4 text-2xl font-bold">{t('delete.title')}</h1>
      <div className="space-y-3 text-sm text-tenue">
        <p>{t('delete.p1')}</p>
        <p>{t('delete.p2')}</p>
        <p>{t('delete.p3')}</p>
        <p>{t('delete.p4')}</p>
      </div>
      {hecho ? (
        <div className="mt-6"><Aviso tipo="exito">{t('delete.done')}</Aviso></div>
      ) : usuario ? (
        <Tarjeta className="mt-6">
          <form onSubmit={borrar} className="space-y-4">
            <p className="text-sm">{t('delete.confirmText')}</p>
            <CampoClave etiqueta={t('field.password')} required autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
            {error && <Aviso tipo="error">{error}</Aviso>}
            <Boton type="submit" variante="peligro" cargando={enviando} className="w-full">
              {t('delete.button')}
            </Boton>
          </form>
        </Tarjeta>
      ) : (
        <Link to="/login?next=%2Fdelete-account" className="mt-6 block">
          <Boton variante="secundario" className="w-full">{t('nav.signIn')}</Boton>
        </Link>
      )}
    </Pagina>
  );
}

export function NotFound() {
  const { t } = useI18n();
  return (
    <Pagina angosta>
      <h1 className="mb-4 text-xl font-bold">{t('notFound.title')}</h1>
      <Link to="/" className="font-semibold text-marca">{t('nav.home')}</Link>
    </Pagina>
  );
}
