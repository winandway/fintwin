import { BotonGooglePlay } from '../components/GooglePlay';
import { AlertTriangle, Building2, CheckCircle2, ImagePlus, KeyRound, Loader2, ReceiptText, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CaptureGuide } from '../components/CaptureGuide';
import { CampoClave } from '../components/CampoClave';
import { plataformaBonita } from '../components/Comprobantes';
import { Aviso, AvisoBorrador, Boton, Campo, Cargando, Pagina, Tarjeta } from '../components/ui';
import { formatoDinero, MAX_ARCHIVO } from '../../shared/reglas';
import { api, ApiError, type Lectura } from '../lib/api';
import { limpiarBorradores, useBorrador } from '../lib/borrador';
import { useI18n, useMensajeError } from '../lib/i18n';
import { imagenParaSubir } from '../lib/imagen';
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
          <Link to="/access">
            <Boton variante="secundario" className="w-full">
              <KeyRound className="h-4 w-4" aria-hidden /> {t('landing.code')}
            </Boton>
          </Link>
        </div>
        <div className="mt-6">
          <p className="mb-2 text-sm text-tenue">{t('play.android')}</p>
          <BotonGooglePlay alto={52} />
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
  const { usuario, cargando, recargar } = useSesion();
  const location = useLocation();
  const [info, setInfo] = useState<{ valido: boolean; nombre?: string; lectura_ia?: boolean; exigir_confirmacion?: boolean } | null>(null);
  const invitado = useBorrador(`invitado-${slug}`, 'anonimo', { nombre: '' });
  const [archivo, setArchivo] = useState<Blob | null>(null);
  const [vista, setVista] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [confirmo, setConfirmo] = useState(false);
  const b = useBorrador(`pagar-${slug}`, usuario?.id ?? 'anonimo', { monto: '', confirmacion: '', fecha: '', nota: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [faltaNumero, setFaltaNumero] = useState(false);
  const [listo, setListo] = useState<{ monto_cent: number | null; confirmacion: string | null } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<{ valido: boolean; nombre?: string; lectura_ia?: boolean; exigir_confirmacion?: boolean }>(`/pagar/${slug}`).then(setInfo).catch(() => setInfo({ valido: false }));
  }, [slug]);
  useEffect(() => () => {
    if (vista) URL.revokeObjectURL(vista);
  }, [vista]);

  if (!info || cargando) return <Cargando />;
  if (!info.valido) return <Pagina angosta><Aviso tipo="error">{t('pay.invalid')}</Aviso></Pagina>;
  const nombre = info.nombre ?? '';
  const siguiente = encodeURIComponent(location.pathname);

  // Sin sesión: basta el nombre. Sin cuenta, sin correo, sin contraseña.
  if (!usuario) {
    const entrarComoInvitado = async (e: FormEvent) => {
      e.preventDefault();
      setEnviando(true);
      setError('');
      try {
        await api.post(`/pagar/${slug}/invitado`, { nombre: invitado.valores.nombre, idioma });
        invitado.limpiar();
        await recargar();
      } catch (err) {
        setError(msg(err));
      } finally {
        setEnviando(false);
      }
    };
    return (
      <Pagina angosta>
        <h1 className="text-xl font-bold">{t('pay.title')}</h1>
        <p className="mb-4 text-tenue">{t('pay.for', { name: nombre })}</p>
        <Tarjeta className="mb-4">
          <form onSubmit={entrarComoInvitado} className="space-y-3">
            <p className="text-sm text-tenue">{t('pay.signIn')}</p>
            <AvisoBorrador visible={invitado.recuperado} onEmpezar={invitado.limpiar} />
            <Campo etiqueta={t('field.name')} required minLength={2} maxLength={80} autoComplete="name" value={invitado.valores.nombre} onChange={(e) => invitado.set('nombre', e.target.value)} />
            {error && <Aviso tipo="error">{error}</Aviso>}
            <Boton type="submit" cargando={enviando} className="w-full">
              {t('common.continue')}
            </Boton>
          </form>
          <Link to={`/login?next=${siguiente}`} className="mt-3 block text-center text-sm text-tenue hover:text-white">
            {t('landing.have')}
          </Link>
        </Tarjeta>
        <CaptureGuide payeeName={nombre} />
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
            <Boton className="flex-1" onClick={() => { setListo(null); setArchivo(null); setVista(''); setLectura(null); setConfirmo(false); }}>
              {t('pay.another')}
            </Boton>
          </div>
        </Tarjeta>
      </Pagina>
    );
  }

  async function elegir(f: File | undefined) {
    setError('');
    setFaltaNumero(false);
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError(t('err.no_es_imagen'));
    setLectura(null);
    setConfirmo(false);
    const blob = await imagenParaSubir(f);
    if (blob.size > MAX_ARCHIVO) return setError(t('err.archivo_grande'));
    setArchivo(blob);
    setVista(URL.createObjectURL(blob));
    if (!info?.lectura_ia) return;
    setLeyendo(true);
    try {
      const form = new FormData();
      form.append('archivo', blob, 'captura');
      const r = await api.form<{ lectura: Lectura | null; repetida?: boolean }>(`/pagar/${slug}/leer`, form);
      setLectura(r.lectura);
      if (r.repetida) setError(t('err.comprobante_repetido'));
      // El monto sale SIEMPRE de la captura actual; quien pagó lo puede corregir.
      if (r.lectura?.monto_cent) b.set('monto', (r.lectura.monto_cent / 100).toFixed(2));
    } catch {
      setLectura({ monto_cent: null, fecha: null, confirmacion: null, pagador: null, pagador_correo: null, beneficiario: null, beneficiario_correo: null, plataforma: null, estado: 'failed' });
    } finally {
      setLeyendo(false);
    }
  }

  const exige = info.exigir_confirmacion !== false;
  const faltaCodigo = Boolean(info.lectura_ia && lectura && !lectura.confirmacion && exige);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!archivo) return setError(t('pay.needImage'));
    const montoCent = Math.round((Number(b.valores.monto.replace(',', '.')) || 0) * 100);
    if (montoCent <= 0) return setError(t('pay.needAmount'));
    if (faltaCodigo) return setError(t('pay.noCode'));
    if (!confirmo) return setError(t('pay.confirmFirst', { name: nombre }));
    setEnviando(true);
    setFaltaNumero(false);
    try {
      const form = new FormData();
      form.append('archivo', archivo, 'captura');
      form.append('monto', b.valores.monto);
      form.append('nota', b.valores.nota);
      if (!info?.lectura_ia) {
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
      <Tarjeta className="mb-4 border-green-700/60">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-tenue">{t('pay.payingTo')}</p>
        <p className="flex items-center gap-2 text-2xl font-bold">
          <Building2 className="h-6 w-6 shrink-0 text-marca" aria-hidden /> <span className="truncate">{nombre}</span>
        </p>
        <p className="mt-1 text-xs text-tenue">{t('pay.onlyThis')}</p>
      </Tarjeta>
      {!archivo && <CaptureGuide payeeName={nombre} />}
      <form onSubmit={enviar} className="mt-4 space-y-4">
        <h2 className="font-semibold">{t('pay.step1')}</h2>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void elegir(e.target.files?.[0])} data-testid="archivo" />
        {vista ? (
          <div className="space-y-2">
            <button type="button" onClick={() => input.current?.click()} className="block w-full rounded-xl bg-black">
              <img src={vista} alt="" className="mx-auto max-h-80 rounded-xl object-contain" />
            </button>
            <button type="button" className="w-full text-sm text-tenue underline hover:text-white" onClick={() => input.current?.click()}>
              {t('pay.change')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-borde bg-panel px-4 py-8 text-tenue hover:border-marca hover:text-white"
          >
            <ImagePlus className="h-8 w-8 text-marca" aria-hidden />
            <span className="font-semibold text-white">{t('pay.choose')}</span>
            <span className="text-xs">{t('pay.chooseHint')}</span>
          </button>
        )}
        {leyendo && (
          <p className="flex items-center gap-2 text-sm text-tenue">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t('pay.reading')}
          </p>
        )}
        {lectura && !faltaCodigo && (lectura.confirmacion || lectura.monto_cent || lectura.plataforma) && (
          <div className="space-y-0.5 rounded-xl border border-borde bg-white/5 p-3 text-sm" data-testid="leido">
            {lectura.confirmacion && (
              <p>
                <span className="text-tenue">{t('account.confirmation')}:</span> <span className="font-mono font-semibold">{lectura.confirmacion}</span>
              </p>
            )}
            {lectura.monto_cent && (
              <p>
                <span className="text-tenue">{t('pay.amountRead')}:</span> <span className="font-mono">{formatoDinero(lectura.monto_cent, idioma)}</span>
              </p>
            )}
            {lectura.plataforma && (
              <p>
                <span className="text-tenue">{t('read.platform')}:</span> {plataformaBonita(lectura.plataforma)}
              </p>
            )}
          </div>
        )}
        {faltaCodigo && (
          <>
            <div className="flex gap-2 rounded-xl border border-red-700/60 bg-red-900/30 p-3 text-sm text-red-200" data-testid="falta-codigo">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden /> {t('pay.noCodeLong')}
            </div>
            <CaptureGuide payeeName={nombre} alert />
          </>
        )}

        <h2 className="pt-2 font-semibold">{t('pay.step2')}</h2>
        <div className="space-y-3">
          <AvisoBorrador visible={b.recuperado} onEmpezar={b.limpiar} />
          <Campo etiqueta={t('pay.amount')} inputMode="decimal" placeholder={t('pay.amountPh')} className="text-lg" value={b.valores.monto} onChange={(e) => b.set('monto', e.target.value)} />
          {!info.lectura_ia && (
            <>
              <Campo etiqueta={t('pay.confirmation')} required={exige} placeholder="0000000000" value={b.valores.confirmacion} onChange={(e) => b.set('confirmacion', e.target.value)} />
              <Campo etiqueta={t('pay.date')} type="date" value={b.valores.fecha} onChange={(e) => b.set('fecha', e.target.value)} />
            </>
          )}
          <Campo etiqueta={t('pay.note')} maxLength={300} placeholder={t('pay.notePh')} value={b.valores.nota} onChange={(e) => b.set('nota', e.target.value)} />
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-borde p-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-green-500" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} />
          <span>
            {t('pay.confirmFor')} <strong>{nombre}</strong>.
          </span>
        </label>

        {error && <Aviso tipo="error">{error}</Aviso>}
        {faltaNumero && !faltaCodigo && <CaptureGuide payeeName={nombre} alert />}
        <Boton type="submit" cargando={enviando} disabled={leyendo} className="w-full">
          {t('pay.send')}
        </Boton>
        <p className="text-center text-xs text-tenue">{t('pay.footer')}</p>
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
  const [palabra, setPalabra] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState(false);
  const palabraOk = palabra.trim().toUpperCase() === t('delete.word');

  async function borrar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await api.post('/yo/borrar', usuario?.sin_correo ? { confirmar: palabra } : { clave, confirmar: palabra });
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
            {usuario.sin_correo ? (
              <p className="text-sm">{t('delete.confirmNoPass')}</p>
            ) : (
              <>
                <p className="text-sm">{t('delete.confirmText')}</p>
                <CampoClave etiqueta={t('field.password')} required autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
              </>
            )}
            <Campo
              etiqueta={t('delete.typeWord', { word: t('delete.word') })}
              placeholder={t('delete.word')}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              value={palabra}
              onChange={(e) => setPalabra(e.target.value)}
              data-testid="palabra-borrar"
            />
            {error && <Aviso tipo="error">{error}</Aviso>}
            <Boton type="submit" variante="peligro" cargando={enviando} disabled={!palabraOk} className="w-full">
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
