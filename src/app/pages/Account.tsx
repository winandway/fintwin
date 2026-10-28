import { ArrowLeft, Check, ImageIcon, KeyRound, LogOut, MinusCircle, QrCode, Settings, Users, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatoDinero } from '../../shared/reglas';
import { CampoClave } from '../components/CampoClave';
import { MenuPuntos, type Opcion } from '../components/MenuPuntos';
import { Aviso, AvisoBorrador, Boton, Campo, Cargando, Modal, Pagina, Tarjeta } from '../components/ui';
import { Visor } from '../components/Visor';
import { api, type Comprobante, type CuentaDetalle } from '../lib/api';
import { useBorrador } from '../lib/borrador';
import { useI18n, useMensajeError } from '../lib/i18n';
import { useSesion } from '../lib/sesion';
import { Estado } from './Home';

type Dialogo = null | 'aprobar' | 'rechazar' | 'salida' | 'pin' | 'ajustes' | 'salir';

export function Account() {
  const { id = '' } = useParams();
  const { t, idioma } = useI18n();
  const msg = useMensajeError();
  const navigate = useNavigate();
  const [detalle, setDetalle] = useState<CuentaDetalle | null>(null);
  const [vista, setVista] = useState<'pendientes' | 'historial'>('pendientes');
  const [lista, setLista] = useState<Comprobante[] | null>(null);
  const [siguiente, setSiguiente] = useState<number | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [visor, setVisor] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error' | 'info'; texto: string } | null>(null);
  const [error, setError] = useState('');

  const cargarDetalle = useCallback(() => {
    api.get<CuentaDetalle>(`/cuentas/${id}`).then(setDetalle).catch((e) => setError(msg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const cargarLista = useCallback(
    (desde = 0) => {
      api
        .get<{ comprobantes: Comprobante[]; hay_mas: boolean; siguiente: number }>(`/cuentas/${id}/comprobantes?vista=${vista}&desde=${desde}`)
        .then((r) => {
          setLista((prev) => (desde === 0 ? r.comprobantes : [...(prev ?? []), ...r.comprobantes]));
          setSiguiente(r.hay_mas ? r.siguiente : null);
        })
        .catch((e) => setError(msg(e)));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, vista],
  );

  useEffect(cargarDetalle, [cargarDetalle]);
  useEffect(() => cargarLista(0), [cargarLista]);

  if (error) {
    return (
      <Pagina>
        <Aviso tipo="error">{error}</Aviso>
      </Pagina>
    );
  }
  if (!detalle) return <Cargando />;

  const esDueno = detalle.rol === 'dueno';
  const pendientes = vista === 'pendientes' ? (lista ?? []) : [];
  const dinero = (c: number) => formatoDinero(c, idioma);

  const opciones: Opcion[] = [
    { texto: t('account.payLink'), icono: <QrCode className="h-4 w-4" />, onClick: () => navigate(`/accounts/${id}/link`) },
    { texto: t('account.team'), icono: <Users className="h-4 w-4" />, onClick: () => navigate(`/accounts/${id}/team`) },
    ...(esDueno ? [{ texto: t('account.recordOutflow'), icono: <MinusCircle className="h-4 w-4" />, onClick: () => setDialogo('salida') }] : []),
    { texto: t('account.myPin'), icono: <KeyRound className="h-4 w-4" />, onClick: () => setDialogo('pin') },
    ...(esDueno ? [{ texto: t('account.settings'), icono: <Settings className="h-4 w-4" />, onClick: () => setDialogo('ajustes') }] : []),
    ...(!esDueno ? [{ texto: t('account.leave'), icono: <LogOut className="h-4 w-4" />, onClick: () => setDialogo('salir'), peligro: true }] : []),
  ];

  function alternar(kid: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(kid)) n.delete(kid);
      else n.add(kid);
      return n;
    });
  }

  function trasRevisar(r: { hechos: string[]; ya_revisados: number }) {
    const fue = dialogo;
    setDialogo(null);
    setSel(new Set());
    const partes = [t(fue === 'rechazar' ? 'account.rejectedN' : 'account.approvedN', { n: r.hechos.length })];
    if (r.ya_revisados > 0) partes.push(t('account.reviewSkipped', { n: r.ya_revisados }));
    setAviso({ tipo: r.ya_revisados > 0 ? 'info' : 'exito', texto: partes.join(' ') });
    cargarDetalle();
    cargarLista(0);
  }

  return (
    <Pagina>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/home" aria-label={t('common.back')} className="rounded-lg p-1.5 text-tenue hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="truncate text-xl font-bold">{detalle.cuenta.nombre}</h1>
        </div>
        <MenuPuntos opciones={opciones} />
      </div>

      <Tarjeta className="mb-3">
        <p className="text-sm text-tenue">{t('account.total')}</p>
        <p className="font-mono text-3xl font-bold" data-testid="total">
          {dinero(detalle.resumen.total_cent)}
        </p>
        <p className="mt-1 text-xs text-tenue">{t('account.totalHint')}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Cifra etiqueta={t('account.incomeShort')} valor={dinero(detalle.resumen.ingresos_cent)} />
          <Cifra etiqueta={`${t('account.fee')} ${detalle.cuenta.comision_pct}%`} valor={dinero(detalle.resumen.comision_cent)} />
          <Cifra etiqueta={t('account.outflows')} valor={dinero(detalle.resumen.salidas_cent)} />
        </div>
      </Tarjeta>
      <p className="mb-4 px-1 text-xs text-tenue">
        {t('account.thisMonth')}: <span className="font-mono text-white">{dinero(detalle.mes.total_cent)}</span> · {t('account.income')}{' '}
        <span className="font-mono">{dinero(detalle.mes.ingresos_cent)}</span>
      </p>

      {aviso && (
        <div className="mb-3">
          <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-borde bg-panel p-1" role="tablist">
        {(['pendientes', 'historial'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={vista === k}
            onClick={() => {
              if (k === vista) return;
              setLista(null);
              setSel(new Set());
              setVista(k);
            }}
            className={`rounded-lg py-2 text-sm font-semibold ${vista === k ? 'bg-white/10 text-white' : 'text-tenue'}`}
          >
            {k === 'pendientes' ? `${t('account.pending')} (${detalle.resumen.pendientes})` : t('account.history')}
          </button>
        ))}
      </div>

      {!lista ? (
        <Cargando />
      ) : lista.length === 0 ? (
        <p className="py-8 text-center text-sm text-tenue">{vista === 'pendientes' ? t('account.emptyPending') : t('account.emptyHistory')}</p>
      ) : (
        <>
          {vista === 'pendientes' && (
            <label className="mb-2 flex items-center gap-2 px-1 text-sm text-tenue">
              <input
                type="checkbox"
                className="h-4 w-4 accent-green-500"
                checked={sel.size === pendientes.length && pendientes.length > 0}
                onChange={(e) => setSel(e.target.checked ? new Set(pendientes.map((k) => k.id)) : new Set())}
              />
              {sel.size > 0 ? t('account.selected', { n: sel.size }) : t('account.selectAll')}
            </label>
          )}
          <div className="space-y-2 pb-24">
            {lista.map((k) => (
              <Fila key={k.id} k={k} seleccionable={vista === 'pendientes'} marcado={sel.has(k.id)} onMarcar={() => alternar(k.id)} onVer={() => setVisor(k.id)} />
            ))}
            {siguiente !== null && (
              <Boton variante="secundario" className="w-full" onClick={() => cargarLista(siguiente)}>
                {t('common.loadMore')}
              </Boton>
            )}
          </div>
        </>
      )}

      {sel.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-fondo/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Boton variante="secundario" className="flex-1" onClick={() => setDialogo('rechazar')}>
              <X className="h-4 w-4" aria-hidden /> {t('account.reject')}
            </Boton>
            <Boton className="flex-[2]" onClick={() => setDialogo('aprobar')}>
              <Check className="h-4 w-4" aria-hidden /> {t('account.approve')} ({sel.size})
            </Boton>
          </div>
        </div>
      )}

      <DialogoRevisar
        key={dialogo ?? 'cerrado'}
        accion={dialogo === 'aprobar' || dialogo === 'rechazar' ? dialogo : null}
        ids={[...sel]}
        cuentaId={id}
        onCerrar={() => setDialogo(null)}
        onListo={trasRevisar}
      />
      <DialogoSalida
        abierto={dialogo === 'salida'}
        cuentaId={id}
        onCerrar={() => setDialogo(null)}
        onListo={() => {
          setDialogo(null);
          setAviso({ tipo: 'exito', texto: t('outflow.done') });
          cargarDetalle();
          if (vista === 'historial') cargarLista(0);
        }}
      />
      <DialogoPin abierto={dialogo === 'pin'} cuentaId={id} onCerrar={() => setDialogo(null)} onListo={() => { setDialogo(null); setAviso({ tipo: 'exito', texto: t('myPin.done') }); }} />
      <DialogoAjustes
        abierto={dialogo === 'ajustes'}
        detalle={detalle}
        onCerrar={() => setDialogo(null)}
        onListo={() => {
          setDialogo(null);
          setAviso({ tipo: 'exito', texto: t('settings.done') });
          cargarDetalle();
        }}
      />
      <Modal abierto={dialogo === 'salir'} onCerrar={() => setDialogo(null)} titulo={t('account.leave')}>
        <div className="flex gap-2">
          <Boton variante="secundario" className="flex-1" onClick={() => setDialogo(null)}>
            {t('common.cancel')}
          </Boton>
          <Boton
            variante="peligro"
            className="flex-1"
            onClick={() => void api.post(`/cuentas/${id}/salir`).then(() => navigate('/home', { replace: true })).catch((e) => setAviso({ tipo: 'error', texto: msg(e) }))}
          >
            {t('account.leave')}
          </Boton>
        </div>
      </Modal>
      <Visor id={visor} onCerrar={() => setVisor(null)} />
    </Pagina>
  );
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-1 py-2">
      <p className="truncate text-[11px] text-tenue">{etiqueta}</p>
      <p className="truncate font-mono text-sm font-semibold">{valor}</p>
    </div>
  );
}

function Fila({ k, seleccionable, marcado, onMarcar, onVer }: { k: Comprobante; seleccionable: boolean; marcado: boolean; onMarcar: () => void; onVer: () => void }) {
  const { t, idioma } = useI18n();
  const fecha = new Date(k.creado_en).toLocaleString(idioma === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <div className={`flex gap-3 rounded-2xl border p-3 ${marcado ? 'border-marca bg-marca/5' : 'border-borde bg-panel'}`}>
      {seleccionable && (
        <input type="checkbox" checked={marcado} onChange={onMarcar} aria-label={k.confirmacion ?? k.id} className="mt-1 h-5 w-5 shrink-0 accent-green-500" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`font-mono text-lg font-bold ${k.tipo === 'salida' ? 'text-red-300' : ''}`}>
            {k.tipo === 'salida' ? '−' : ''}
            {formatoDinero(k.monto_cent, idioma)}
          </p>
          {k.tipo === 'salida' ? (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-tenue">{t('account.outflow')}</span>
          ) : (
            <Estado estado={k.estado} />
          )}
        </div>
        {k.tipo === 'ingreso' ? (
          <>
            <p className="truncate text-sm">
              <span className="text-tenue">{t('account.confirmation')}:</span> <span className="font-mono font-semibold">{k.confirmacion}</span>
            </p>
            <p className="truncate text-xs text-tenue">
              {t('account.uploadedBy', { name: k.subido_por_nombre ?? '—' })}
              {k.pagador ? ` · ${k.pagador}` : ''}
              {k.fecha_pago ? ` · ${t('account.paidOn')} ${k.fecha_pago}` : ''}
            </p>
            <p className="text-xs text-tenue">
              {fecha} · {k.lectura === 'ia' ? t('account.ai') : t('account.manual')}
            </p>
          </>
        ) : (
          <p className="truncate text-sm text-tenue">
            {k.motivo} · {fecha}
          </p>
        )}
      </div>
      {Boolean(k.tiene_archivo) && (
        <button onClick={onVer} aria-label={t('account.viewReceipt')} className="self-center rounded-lg border border-borde p-2.5 text-tenue hover:text-white">
          <ImageIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

function DialogoRevisar({
  accion,
  ids,
  cuentaId,
  onCerrar,
  onListo,
}: {
  accion: 'aprobar' | 'rechazar' | null;
  ids: string[];
  cuentaId: string;
  onCerrar: () => void;
  onListo: (r: { hechos: string[]; ya_revisados: number }) => void;
}) {
  const { t } = useI18n();
  const msg = useMensajeError();
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!accion) return;
    setEnviando(true);
    setError('');
    try {
      onListo(await api.post(`/cuentas/${cuentaId}/revisar`, { ids, accion, pin }));
    } catch (err) {
      setError(msg(err));
      setPin('');
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Modal abierto={accion !== null} onCerrar={onCerrar} titulo={accion === 'aprobar' ? t('pin.approve', { n: ids.length }) : t('pin.reject', { n: ids.length })}>
      <form onSubmit={enviar} className="space-y-4">
        <CampoClave pin autoFocus etiqueta={t('pin.title')} required value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Boton type="submit" variante={accion === 'rechazar' ? 'peligro' : 'primario'} cargando={enviando} disabled={pin.length !== 4} className="w-full">
          {accion === 'aprobar' ? t('account.approve') : t('account.reject')}
        </Boton>
      </form>
    </Modal>
  );
}

function DialogoSalida({ abierto, cuentaId, onCerrar, onListo }: { abierto: boolean; cuentaId: string; onCerrar: () => void; onListo: () => void }) {
  const { t } = useI18n();
  const msg = useMensajeError();
  const { usuario } = useSesion();
  const b = useBorrador(`salida-${cuentaId}`, usuario?.id ?? 'anonimo', { monto: '', motivo: '', pin: '' }, ['pin']);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [repetida, setRepetida] = useState(false);
  async function enviar(confirmar = false) {
    setEnviando(true);
    setError('');
    try {
      await api.post(`/cuentas/${cuentaId}/salidas`, { monto: b.valores.monto, motivo: b.valores.motivo, pin: b.valores.pin, confirmar_repetida: confirmar });
      b.limpiar();
      setRepetida(false);
      onListo();
    } catch (err) {
      if ((err as { code?: string }).code === 'salida_repetida') setRepetida(true);
      else setError(msg(err));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={t('outflow.title')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(false);
        }}
        className="space-y-4"
      >
        <p className="text-sm text-tenue">{t('outflow.text')}</p>
        <AvisoBorrador visible={b.recuperado} onEmpezar={b.limpiar} />
        <Campo etiqueta={t('outflow.amount')} inputMode="decimal" required placeholder="0.00" value={b.valores.monto} onChange={(e) => b.set('monto', e.target.value)} />
        <Campo etiqueta={t('outflow.reason')} required minLength={2} maxLength={200} value={b.valores.motivo} onChange={(e) => b.set('motivo', e.target.value)} />
        <CampoClave pin etiqueta={t('field.pin')} required value={b.valores.pin} onChange={(e) => b.set('pin', e.target.value.replace(/\D/g, ''))} />
        {error && <Aviso tipo="error">{error}</Aviso>}
        {repetida ? (
          <div className="space-y-2">
            <Aviso tipo="info">{t('outflow.repeated')}</Aviso>
            <Boton type="button" cargando={enviando} className="w-full" onClick={() => void enviar(true)}>
              {t('outflow.again')}
            </Boton>
          </div>
        ) : (
          <Boton type="submit" cargando={enviando} className="w-full">
            {t('outflow.title')}
          </Boton>
        )}
      </form>
    </Modal>
  );
}

function DialogoPin({ abierto, cuentaId, onCerrar, onListo }: { abierto: boolean; cuentaId: string; onCerrar: () => void; onListo: () => void }) {
  const { t } = useI18n();
  const msg = useMensajeError();
  const [actual, setActual] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await api.post(`/cuentas/${cuentaId}/mi-pin`, { actual, nuevo });
      setActual('');
      setNuevo('');
      onListo();
    } catch (err) {
      setError(msg(err));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={t('account.myPin')}>
      <form onSubmit={enviar} className="space-y-4">
        <CampoClave pin etiqueta={t('myPin.current')} required value={actual} onChange={(e) => setActual(e.target.value.replace(/\D/g, ''))} />
        <CampoClave pin etiqueta={t('myPin.new')} required value={nuevo} onChange={(e) => setNuevo(e.target.value.replace(/\D/g, ''))} />
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Boton type="submit" cargando={enviando} className="w-full">
          {t('common.save')}
        </Boton>
      </form>
    </Modal>
  );
}

function DialogoAjustes({ abierto, detalle, onCerrar, onListo }: { abierto: boolean; detalle: CuentaDetalle; onCerrar: () => void; onListo: () => void }) {
  const { t } = useI18n();
  const msg = useMensajeError();
  const { usuario } = useSesion();
  const b = useBorrador(
    `ajustes-${detalle.cuenta.id}`,
    usuario?.id ?? 'anonimo',
    { nombre: detalle.cuenta.nombre, comision: String(detalle.cuenta.comision_pct), pin: '' },
    ['pin'],
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await api.post(`/cuentas/${detalle.cuenta.id}/ajustes`, {
        nombre: b.valores.nombre,
        comision_pct: Number(b.valores.comision.replace(',', '.')) || 0,
        pin: b.valores.pin,
      });
      b.limpiar();
      onListo();
    } catch (err) {
      setError(msg(err));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={t('account.settings')}>
      <form onSubmit={enviar} className="space-y-4">
        <AvisoBorrador visible={b.recuperado} onEmpezar={b.limpiar} />
        <Campo etiqueta={t('newAccount.name')} required minLength={2} maxLength={80} value={b.valores.nombre} onChange={(e) => b.set('nombre', e.target.value)} />
        <Campo etiqueta={t('newAccount.fee')} inputMode="decimal" value={b.valores.comision} onChange={(e) => b.set('comision', e.target.value)} />
        <CampoClave pin etiqueta={t('field.pin')} required value={b.valores.pin} onChange={(e) => b.set('pin', e.target.value.replace(/\D/g, ''))} />
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Boton type="submit" cargando={enviando} className="w-full">
          {t('common.save')}
        </Boton>
      </form>
    </Modal>
  );
}
