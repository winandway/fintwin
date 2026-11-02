import { ArrowLeft, Copy, Download, ExternalLink, KeyRound, RefreshCw, Share2, Trash2, UserMinus, UserPlus } from 'lucide-react';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CampoClave } from '../components/CampoClave';
import { MenuPuntos } from '../components/MenuPuntos';
import { Aviso, AvisoBorrador, Boton, Campo, Cargando, Modal, Pagina, Tarjeta } from '../components/ui';
import { api, type CuentaDetalle } from '../lib/api';
import { useBorrador } from '../lib/borrador';
import { useSesion } from '../lib/sesion';
import { useI18n, useMensajeError } from '../lib/i18n';
import { compartir, esApp } from '../lib/nativo';

function Copiable({ texto }: { texto: string }) {
  const { t } = useI18n();
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-borde bg-[#0d1528] p-2 pl-3">
      <span className="min-w-0 flex-1 truncate font-mono text-sm" data-testid="copiable">
        {texto}
      </span>
      <Boton
        variante="secundario"
        className="!px-3 !py-2 text-sm"
        onClick={() =>
          void navigator.clipboard.writeText(texto).then(() => {
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          })
        }
      >
        <Copy className="h-4 w-4" aria-hidden /> {copiado ? t('common.copied') : t('common.copy')}
      </Boton>
    </div>
  );
}

/** Pide el PIN y ejecuta una acción. */
function ConPin({ titulo, abierto, onCerrar, accion, peligro = false }: { titulo: string; abierto: boolean; onCerrar: () => void; accion: (pin: string) => Promise<void>; peligro?: boolean }) {
  const { t } = useI18n();
  const msg = useMensajeError();
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await accion(pin);
      setPin('');
    } catch (err) {
      setError(msg(err));
      setPin('');
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo}>
      <form onSubmit={enviar} className="space-y-4">
        <CampoClave pin autoFocus etiqueta={t('pin.title')} required value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Boton type="submit" variante={peligro ? 'peligro' : 'primario'} cargando={enviando} disabled={pin.length !== 4} className="w-full">
          {t('common.continue')}
        </Boton>
      </form>
    </Modal>
  );
}

export function PayLink() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const msg = useMensajeError();
  const [detalle, setDetalle] = useState<CuentaDetalle | null>(null);
  const [qr, setQr] = useState('');
  const [rotar, setRotar] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const link = detalle ? `${window.location.origin}/pay/${detalle.cuenta.link_slug}` : '';

  useEffect(() => {
    api.get<CuentaDetalle>(`/cuentas/${id}`).then(setDetalle).catch((e) => setError(msg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    if (link) void QRCode.toDataURL(link, { width: 640, margin: 2 }).then(setQr);
  }, [link]);

  if (error) return <Pagina><Aviso tipo="error">{error}</Aviso></Pagina>;
  if (!detalle) return <Cargando />;

  return (
    <Pagina>
      <div className="mb-4 flex items-center gap-2">
        <Link to={`/accounts/${id}`} aria-label={t('common.back')} className="rounded-lg p-1.5 text-tenue hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">{t('link.title')}</h1>
      </div>
      <Tarjeta className="space-y-4">
        <p className="text-sm text-tenue">{t('link.text')}</p>
        <Copiable texto={link} />
        <Boton className="w-full" onClick={() => void compartir(t('link.shareText', { name: detalle.cuenta.nombre }), link)}>
          <Share2 className="h-4 w-4" aria-hidden /> {t('link.share')}
        </Boton>
        {detalle && (
          <Link to={`/pay/${detalle.cuenta.link_slug}`} className="block">
            <Boton variante="secundario" className="w-full">
              <ExternalLink className="h-4 w-4" aria-hidden /> {t('link.open')}
            </Boton>
          </Link>
        )}
        {qr && (
          <div className="flex flex-col items-center gap-3">
            <img src={qr} alt="QR" className="w-56 rounded-xl bg-white p-2" />
            {/* En la app el QR se muestra para escanearlo en pantalla; descargar es cosa del navegador. */}
            {!esApp() && (
              <a href={qr} download={`fintwin-${detalle.cuenta.nombre}.png`}>
                <Boton variante="secundario">
                  <Download className="h-4 w-4" aria-hidden /> {t('link.download')}
                </Boton>
              </a>
            )}
          </div>
        )}
        {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
        {detalle.rol === 'dueno' && (
          <div className="border-t border-borde pt-4">
            <p className="mb-2 text-xs text-tenue">{t('link.rotateText')}</p>
            <Boton variante="fantasma" onClick={() => setRotar(true)} className="!px-0">
              <RefreshCw className="h-4 w-4" aria-hidden /> {t('link.rotate')}
            </Boton>
          </div>
        )}
      </Tarjeta>
      <ConPin
        titulo={t('link.rotate')}
        abierto={rotar}
        onCerrar={() => setRotar(false)}
        accion={async (pin) => {
          const r = await api.post<{ link_slug: string }>(`/cuentas/${id}/link`, { pin });
          setDetalle({ ...detalle, cuenta: { ...detalle.cuenta, link_slug: r.link_slug } });
          setRotar(false);
          setAviso(t('link.rotated'));
        }}
      />
    </Pagina>
  );
}

type RolAcceso = 'subidor' | 'validador';

interface Acceso {
  id: string;
  nombre: string;
  rol: RolAcceso;
  activo: boolean;
  codigo_pendiente: boolean;
}

interface Equipo {
  rol: 'dueno' | 'validador';
  yo: string;
  miembros: { usuario_id: string; rol: 'dueno' | 'validador'; nombre: string; email: string | null }[];
  invitaciones: { id: string; expira_en: number }[];
  accesos: Acceso[];
}

interface CodigoListo {
  id: string;
  codigo: string;
  nombre: string;
  rol: RolAcceso;
}

/** El código recién creado: grande, para copiar o mandar por WhatsApp. */
function TarjetaCodigo({ listo, cuentaNombre, onCerrar }: { listo: CodigoListo; cuentaNombre: string; onCerrar: () => void }) {
  const { t } = useI18n();
  const primerNombre = listo.nombre.split(' ')[0] ?? listo.nombre;
  const texto = t('team.shareText', { name: primerNombre, account: cuentaNombre, code: listo.codigo });
  const enlace = `${window.location.origin}/access?codigo=${listo.codigo}`;
  return (
    <Tarjeta className="mb-4 space-y-3 border-marca/60">
      <p className="font-semibold">{t('team.codeReady', { name: primerNombre })}</p>
      <p className="text-center font-mono text-3xl font-bold tracking-[0.2em]" data-testid="codigo">
        {listo.codigo}
      </p>
      <p className="text-sm text-tenue">{t('team.codeSteps')}</p>
      <Boton className="w-full" onClick={() => void compartir(texto, enlace)}>
        <Share2 className="h-4 w-4" aria-hidden /> {t('team.shareCode')}
      </Boton>
      <Copiable texto={listo.codigo} />
      <Boton variante="fantasma" className="w-full" onClick={onCerrar}>
        {t('common.close')}
      </Boton>
    </Tarjeta>
  );
}

/** Agregar persona: nombre y qué va a hacer. Después pide el PIN del dueño. */
function AgregarPersona({ abierto, onCerrar, onListo }: { abierto: boolean; onCerrar: () => void; onListo: (datos: { nombre: string; rol: RolAcceso }) => void }) {
  const { t } = useI18n();
  const { usuario } = useSesion();
  const b = useBorrador('agregar-persona', usuario?.id ?? 'anonimo', { nombre: '', rol: 'subidor' });
  const opciones: { rol: RolAcceso; titulo: string; texto: string }[] = [
    { rol: 'subidor', titulo: t('team.roleUploader'), texto: t('team.roleUploaderText') },
    { rol: 'validador', titulo: t('team.roleValidator'), texto: t('team.roleValidatorText') },
  ];
  function seguir(e: FormEvent) {
    e.preventDefault();
    onListo({ nombre: b.valores.nombre.trim(), rol: b.valores.rol === 'validador' ? 'validador' : 'subidor' });
    b.limpiar();
  }
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={t('team.add')}>
      <form onSubmit={seguir} className="space-y-4">
        <AvisoBorrador visible={b.recuperado} onEmpezar={b.limpiar} />
        <Campo etiqueta={t('team.personName')} placeholder={t('team.personNamePh')} required minLength={2} maxLength={80} autoFocus value={b.valores.nombre} onChange={(e) => b.set('nombre', e.target.value)} />
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm font-medium">{t('team.whatDo')}</legend>
          {opciones.map((o) => (
            <label
              key={o.rol}
              className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${b.valores.rol === o.rol ? 'border-marca bg-marca/10' : 'border-borde'}`}
            >
              <input type="radio" name="rol" value={o.rol} checked={b.valores.rol === o.rol} onChange={() => b.set('rol', o.rol)} className="mt-1 accent-[#22c55e]" />
              <span>
                <span className="block font-semibold">{o.titulo}</span>
                <span className="block text-sm text-tenue">{o.texto}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Boton type="submit" disabled={b.valores.nombre.trim().length < 2} className="w-full">
          {t('common.continue')}
        </Boton>
      </form>
    </Modal>
  );
}

export function Team() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const msg = useMensajeError();
  const [equipo, setEquipo] = useState<Equipo | null>(null);
  const [cuentaNombre, setCuentaNombre] = useState('');
  const [agregar, setAgregar] = useState(false);
  const [pendiente, setPendiente] = useState<{ tipo: 'crear'; nombre: string; rol: RolAcceso } | { tipo: 'codigo' | 'quitar'; acceso: Acceso } | { tipo: 'miembro'; usuarioId: string } | null>(null);
  const [listo, setListo] = useState<CodigoListo | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    api.get<Equipo>(`/cuentas/${id}/equipo`).then(setEquipo).catch((e) => setError(msg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(cargar, [cargar]);
  useEffect(() => {
    api.get<CuentaDetalle>(`/cuentas/${id}`).then((d) => setCuentaNombre(d.cuenta.nombre)).catch(() => undefined);
  }, [id]);

  if (!equipo) return error ? <Pagina><Aviso tipo="error">{error}</Aviso></Pagina> : <Cargando />;
  const esDueno = equipo.rol === 'dueno';
  const tituloPin =
    pendiente?.tipo === 'crear' ? t('team.add') : pendiente?.tipo === 'codigo' ? t('team.newCode') : pendiente?.tipo === 'quitar' ? t('team.removeAccess') : t('team.remove');

  async function conPin(pin: string) {
    if (!pendiente) return;
    if (pendiente.tipo === 'crear') {
      setListo(await api.post<CodigoListo>(`/cuentas/${id}/accesos`, { nombre: pendiente.nombre, rol: pendiente.rol, pin }));
    } else if (pendiente.tipo === 'codigo') {
      setListo(await api.post<CodigoListo>(`/cuentas/${id}/accesos/${pendiente.acceso.id}/codigo`, { pin }));
    } else if (pendiente.tipo === 'quitar') {
      await api.post(`/cuentas/${id}/accesos/${pendiente.acceso.id}/quitar`, { pin });
      if (listo?.id === pendiente.acceso.id) setListo(null);
    } else if (pendiente.tipo === 'miembro') {
      await api.post(`/cuentas/${id}/equipo/quitar`, { usuario_id: pendiente.usuarioId, pin });
    }
    setPendiente(null);
    cargar();
  }

  const rolDe = (r: RolAcceso | 'dueno') => (r === 'dueno' ? t('home.owner') : r === 'validador' ? t('home.validator') : t('home.uploader'));

  return (
    <Pagina>
      <div className="mb-4 flex items-center gap-2">
        <Link to={`/accounts/${id}`} aria-label={t('common.back')} className="rounded-lg p-1.5 text-tenue hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">{t('team.title')}</h1>
      </div>
      <p className="mb-4 text-sm text-tenue">{t('team.text')}</p>
      {error && <div className="mb-3"><Aviso tipo="error">{error}</Aviso></div>}

      {esDueno && listo && <TarjetaCodigo listo={listo} cuentaNombre={cuentaNombre} onCerrar={() => setListo(null)} />}
      {esDueno && (
        <Boton className="mb-6 w-full" onClick={() => setAgregar(true)}>
          <UserPlus className="h-4 w-4" aria-hidden /> {t('team.add')}
        </Boton>
      )}

      {esDueno && (
        <>
          <p className="mb-2 text-sm font-semibold text-tenue">{t('team.people')}</p>
          <div className="mb-6 divide-y divide-borde rounded-2xl border border-borde bg-panel">
            {equipo.accesos.length === 0 && <p className="px-4 py-3 text-sm text-tenue">{t('team.emptyPeople')}</p>}
            {equipo.accesos.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{a.nombre}</p>
                  <p className="truncate text-xs text-tenue">
                    {rolDe(a.rol)} ·{' '}
                    {a.codigo_pendiente ? <span className="text-amber-300">{t('team.codePending')}</span> : a.activo ? <span className="text-green-300">{t('team.active')}</span> : t('team.codePending')}
                  </p>
                </div>
                <MenuPuntos
                  opciones={[
                    { texto: t('team.newCode'), icono: <KeyRound className="h-4 w-4" />, onClick: () => setPendiente({ tipo: 'codigo', acceso: a }) },
                    { texto: t('team.removeAccess'), icono: <UserMinus className="h-4 w-4" />, onClick: () => setPendiente({ tipo: 'quitar', acceso: a }), peligro: true },
                  ]}
                />
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mb-4 divide-y divide-borde rounded-2xl border border-borde bg-panel">
        {equipo.miembros.map((m) => (
          <div key={m.usuario_id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {m.nombre} {m.usuario_id === equipo.yo && <span className="text-xs text-tenue">({t('team.you')})</span>}
              </p>
              <p className="truncate text-xs text-tenue">
                {rolDe(m.rol)}
                {m.email ? ` · ${m.email}` : ''}
              </p>
            </div>
            {esDueno && m.rol !== 'dueno' && (
              <MenuPuntos opciones={[{ texto: t('team.remove'), icono: <UserMinus className="h-4 w-4" />, onClick: () => setPendiente({ tipo: 'miembro', usuarioId: m.usuario_id }), peligro: true }]} />
            )}
          </div>
        ))}
      </div>

      {esDueno && equipo.invitaciones.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-tenue">{t('team.pendingInvites')}</p>
          <div className="divide-y divide-borde rounded-2xl border border-borde bg-panel">
            {equipo.invitaciones.map((i) => (
              <div key={i.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-tenue">{t('home.validator')}</span>
                <MenuPuntos
                  opciones={[
                    {
                      texto: t('team.cancelInvite'),
                      icono: <Trash2 className="h-4 w-4" />,
                      peligro: true,
                      onClick: () => void api.post(`/cuentas/${id}/invitaciones/anular`, { invitacion_id: i.id }).then(cargar).catch((e) => setError(msg(e))),
                    },
                  ]}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <AgregarPersona
        abierto={agregar}
        onCerrar={() => setAgregar(false)}
        onListo={(datos) => {
          setAgregar(false);
          setPendiente({ tipo: 'crear', ...datos });
        }}
      />
      <ConPin
        titulo={tituloPin}
        peligro={pendiente?.tipo === 'quitar' || pendiente?.tipo === 'miembro'}
        abierto={pendiente !== null}
        onCerrar={() => setPendiente(null)}
        accion={conPin}
      />
    </Pagina>
  );
}
