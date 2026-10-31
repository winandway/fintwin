import { ArrowLeft, Copy, Download, RefreshCw, Share2, Trash2, UserMinus, UserPlus } from 'lucide-react';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CampoClave } from '../components/CampoClave';
import { MenuPuntos } from '../components/MenuPuntos';
import { Aviso, Boton, Cargando, Modal, Pagina, Tarjeta } from '../components/ui';
import { api, type CuentaDetalle } from '../lib/api';
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

interface Equipo {
  rol: 'dueno' | 'validador';
  yo: string;
  miembros: { usuario_id: string; rol: 'dueno' | 'validador'; nombre: string; email: string }[];
  invitaciones: { id: string; expira_en: number }[];
}

export function Team() {
  const { id = '' } = useParams();
  const { t, idioma } = useI18n();
  const msg = useMensajeError();
  const [equipo, setEquipo] = useState<Equipo | null>(null);
  const [invitar, setInvitar] = useState(false);
  const [quitar, setQuitar] = useState<string | null>(null);
  const [linkInvitacion, setLinkInvitacion] = useState('');
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    api.get<Equipo>(`/cuentas/${id}/equipo`).then(setEquipo).catch((e) => setError(msg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(cargar, [cargar]);

  if (!equipo) return error ? <Pagina><Aviso tipo="error">{error}</Aviso></Pagina> : <Cargando />;
  const esDueno = equipo.rol === 'dueno';

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
      <div className="mb-4 divide-y divide-borde rounded-2xl border border-borde bg-panel">
        {equipo.miembros.map((m) => (
          <div key={m.usuario_id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {m.nombre} {m.usuario_id === equipo.yo && <span className="text-xs text-tenue">({t('team.you')})</span>}
              </p>
              <p className="truncate text-xs text-tenue">
                {m.rol === 'dueno' ? t('home.owner') : t('home.validator')} · {m.email}
              </p>
            </div>
            {esDueno && m.rol !== 'dueno' && (
              <MenuPuntos opciones={[{ texto: t('team.remove'), icono: <UserMinus className="h-4 w-4" />, onClick: () => setQuitar(m.usuario_id), peligro: true }]} />
            )}
          </div>
        ))}
      </div>

      {esDueno && (
        <>
          {linkInvitacion && (
            <Tarjeta className="mb-4 space-y-2">
              <p className="text-sm">{t('team.inviteReady')}</p>
              <Copiable texto={linkInvitacion} />
            </Tarjeta>
          )}
          <Boton className="w-full" onClick={() => setInvitar(true)}>
            <UserPlus className="h-4 w-4" aria-hidden /> {t('team.invite')}
          </Boton>
          {equipo.invitaciones.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold text-tenue">{t('team.pendingInvites')}</p>
              <div className="divide-y divide-borde rounded-2xl border border-borde bg-panel">
                {equipo.invitaciones.map((i) => (
                  <div key={i.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-tenue">
                      {t('home.validator')} · {t('team.expires', { date: new Date(i.expira_en).toLocaleDateString(idioma === 'es' ? 'es-US' : 'en-US') })}
                    </span>
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
        </>
      )}

      <ConPin
        titulo={t('team.invite')}
        abierto={invitar}
        onCerrar={() => setInvitar(false)}
        accion={async (pin) => {
          const r = await api.post<{ token: string }>(`/cuentas/${id}/invitaciones`, { pin });
          setLinkInvitacion(`${window.location.origin}/invite/${r.token}`);
          setInvitar(false);
          cargar();
        }}
      />
      <ConPin
        titulo={t('team.remove')}
        peligro
        abierto={quitar !== null}
        onCerrar={() => setQuitar(null)}
        accion={async (pin) => {
          await api.post(`/cuentas/${id}/equipo/quitar`, { usuario_id: quitar, pin });
          setQuitar(null);
          cargar();
        }}
      />
    </Pagina>
  );
}
