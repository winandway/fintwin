import { AlertTriangle, ArrowLeft, Check, CheckCircle2, QrCode, Search, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatoDinero } from '../../shared/reglas';
import { CampoClave } from '../components/CampoClave';
import { fechaCorta } from '../components/Comprobantes';
import { Aviso, AvisoBorrador, Boton, Cargando, Modal, Pagina, Tarjeta } from '../components/ui';
import { useBorrador } from '../lib/borrador';
import { Visor } from '../components/Visor';
import { api, type Comprobante, type CuentaDetalle } from '../lib/api';
import { recordarClaveUnica, useEtiquetaValidar } from '../lib/claveUnica';
import { useI18n, useMensajeError } from '../lib/i18n';
import { useSesion } from '../lib/sesion';

/**
 * La bandeja «Por revisar» del original: los pendientes y en espera de una cuenta, con su miniatura,
 * sus etiquetas, y aprobar o rechazar en lote con el PIN.
 */
export function Review() {
  const { id = '' } = useParams();
  const { t, idioma } = useI18n();
  const msg = useMensajeError();
  const [nombre, setNombre] = useState('');
  const [lista, setLista] = useState<Comprobante[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [accion, setAccion] = useState<'aprobar' | 'rechazar' | null>(null);
  const [visor, setVisor] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'info'; texto: string } | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    api
      .get<{ comprobantes: Comprobante[] }>(`/cuentas/${id}/comprobantes?vista=pendientes`)
      .then((r) => setLista(r.comprobantes))
      .catch((e) => setError(msg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    api.get<CuentaDetalle>(`/cuentas/${id}`).then((d) => { setNombre(d.cuenta.nombre); recordarClaveUnica(d.cuenta.id, d.clave_unica?.activa); }).catch(() => undefined);
    cargar();
  }, [id, cargar]);

  const marcados = useMemo(() => (lista ?? []).filter((k) => sel.has(k.id)), [lista, sel]);
  const totalMarcado = marcados.reduce((s, k) => s + k.monto_cent, 0);

  function alternar(kid: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(kid)) n.delete(kid);
      else n.add(kid);
      return n;
    });
  }

  return (
    <Pagina angosta>
      <div className="mb-4 flex items-center gap-2">
        <Link to={`/accounts/${id}`} aria-label={t('common.back')} className="rounded-lg p-1.5 text-tenue hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{t('mov.toReview')}</h1>
          <p className="truncate text-sm text-tenue">{nombre}</p>
        </div>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {aviso && (
        <div className="mb-3">
          <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>
        </div>
      )}
      {!lista ? (
        !error && <Cargando />
      ) : lista.length === 0 ? (
        <Tarjeta className="flex flex-col items-center gap-2 border-green-700/50 bg-green-900/20 py-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-400" aria-hidden />
          <p className="text-lg font-semibold">{t('review.allClear')}</p>
          <p className="text-sm text-tenue">{t('review.allClearText')}</p>
        </Tarjeta>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <label className="flex items-center gap-2 text-sm text-tenue">
              <input
                type="checkbox"
                className="h-4 w-4 accent-green-500"
                checked={sel.size === lista.length}
                onChange={(e) => setSel(e.target.checked ? new Set(lista.map((k) => k.id)) : new Set())}
              />
              {t('review.selectAll', { n: lista.length })}
            </label>
            {sel.size > 0 && <span className="font-mono text-sm font-semibold text-green-400">{formatoDinero(totalMarcado, idioma)}</span>}
          </div>
          <div className="space-y-2 pb-24">
            {lista.map((k) => {
              const marcado = sel.has(k.id);
              const difiere = k.monto_leido_cent && Math.abs(k.monto_leido_cent - k.monto_cent) >= 1;
              return (
                <div key={k.id} className={`flex gap-3 rounded-2xl border p-3 ${marcado ? 'border-green-600 bg-marca/5' : 'border-borde bg-panel'}`}>
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => alternar(k.id)}
                    aria-label={t('review.select', { amount: formatoDinero(k.monto_cent, idioma) })}
                    className="mt-1 h-5 w-5 shrink-0 accent-green-500"
                  />
                  {k.tiene_archivo ? (
                    <button onClick={() => setVisor(k.id)} aria-label={t('account.viewReceipt')} className="shrink-0">
                      <img src={`/datos/archivo/${k.id}`} alt="" loading="lazy" className="h-16 w-16 rounded-lg object-cover" />
                    </button>
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-lg bg-white/5" />
                  )}
                  <button onClick={() => alternar(k.id)} className="min-w-0 flex-1 text-left">
                    <p className="font-mono text-lg font-bold">{formatoDinero(k.monto_cent, idioma)}</p>
                    {k.confirmacion ? (
                      <p className="truncate text-sm">
                        <span className="text-tenue">{t('account.confirmation')}:</span> <span className="font-mono font-semibold">{k.confirmacion}</span>
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-amber-300">{t('review.noCode')}</p>
                    )}
                    <p className="truncate text-xs text-tenue">
                      {[k.pagador ?? k.subido_por_nombre, k.plataforma, fechaCorta(k.creado_en, idioma, false)].filter(Boolean).join(' · ')}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {k.via === 'link' && <span className="rounded bg-blue-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">{t('review.byLink')}</span>}
                      {Boolean(k.en_espera) && <span className="rounded bg-amber-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">{t('mov.onHold')}</span>}
                      {difiere && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                          <AlertTriangle className="h-3 w-3" aria-hidden /> {t('review.receiptSays', { amount: formatoDinero(k.monto_leido_cent!, idioma) })}
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {sel.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-fondo/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-md gap-2">
            <Boton variante="secundario" className="flex-1 !border-red-700 !text-red-300" onClick={() => setAccion('rechazar')}>
              <X className="h-4 w-4" aria-hidden /> {t('review.rejectN', { n: sel.size })}
            </Boton>
            <Boton className="flex-1" onClick={() => setAccion('aprobar')}>
              <Check className="h-4 w-4" aria-hidden /> {t('review.approveN', { n: sel.size })}
            </Boton>
          </div>
        </div>
      )}

      {accion && (
        <DialogoLote
          accion={accion}
          ids={[...sel]}
          total={totalMarcado}
          cuentaId={id}
          cuentaNombre={nombre}
          onCerrar={() => setAccion(null)}
          onListo={(r) => {
            const partes = [t(accion === 'aprobar' ? 'account.approvedN' : 'account.rejectedN', { n: r.hechos.length })];
            if (r.ya_revisados > 0) partes.push(t('account.reviewSkipped', { n: r.ya_revisados }));
            setAviso({ tipo: r.ya_revisados > 0 ? 'info' : 'exito', texto: partes.join(' ') });
            setAccion(null);
            setSel(new Set());
            cargar();
          }}
        />
      )}
      <Visor id={visor} onCerrar={() => setVisor(null)} />
    </Pagina>
  );
}

function DialogoLote({
  accion,
  ids,
  total,
  cuentaId,
  cuentaNombre,
  onCerrar,
  onListo,
}: {
  accion: 'aprobar' | 'rechazar';
  ids: string[];
  total: number;
  cuentaId: string;
  cuentaNombre: string;
  onCerrar: () => void;
  onListo: (r: { hechos: string[]; ya_revisados: number }) => void;
}) {
  const etiquetaValidar = useEtiquetaValidar(cuentaId);
  const { t, idioma } = useI18n();
  const msg = useMensajeError();
  const { usuario } = useSesion();
  const [pin, setPin] = useState('');
  // El motivo del rechazo se guarda mientras se escribe (el PIN nunca).
  const b = useBorrador(`rechazo-${cuentaId}`, usuario?.id ?? 'anonimo', { motivo: '' });
  const motivo = b.valores.motivo;
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const r = await api.post<{ hechos: string[]; ya_revisados: number }>(`/cuentas/${cuentaId}/revisar`, {
        ids,
        accion,
        pin,
        motivo: accion === 'rechazar' ? motivo.trim() || undefined : undefined,
      });
      if (accion === 'rechazar') b.limpiar();
      onListo(r);
    } catch (err) {
      setError(msg(err));
      setPin('');
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Modal abierto onCerrar={onCerrar} titulo={accion === 'aprobar' ? t('pin.approve', { n: ids.length }) : t('pin.reject', { n: ids.length })}>
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-tenue">
          {accion === 'aprobar' ? t('review.approveText', { amount: formatoDinero(total, idioma), name: cuentaNombre }) : t('review.rejectText')}
        </p>
        {accion === 'rechazar' && <AvisoBorrador visible={b.recuperado} onEmpezar={b.limpiar} />}
        {accion === 'rechazar' && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-white">{t('review.reason')}</span>
            <textarea
              rows={2}
              maxLength={200}
              value={motivo}
              onChange={(e) => b.set('motivo', e.target.value)}
              className="w-full rounded-xl border border-borde bg-[#0d1528] px-4 py-3 text-white outline-none focus:border-marca"
            />
          </label>
        )}
        <CampoClave pin autoFocus etiqueta={etiquetaValidar} required value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="flex gap-2">
          <Boton
            type="button"
            variante="secundario"
            className="flex-1"
            onClick={() => {
              if (accion === 'rechazar') b.limpiar();
              onCerrar();
            }}
          >
            {t('common.cancel')}
          </Boton>
          <Boton type="submit" variante={accion === 'rechazar' ? 'peligro' : 'primario'} cargando={enviando} disabled={pin.length !== 4} className="flex-1">
            {accion === 'aprobar' ? t('account.approve') : t('account.reject')}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}

interface Cliente {
  clave: string;
  nombre: string | null;
  tiene_usuario: boolean;
  por_link: boolean;
  comprobantes: number;
  aprobado_cent: number;
  por_revisar: number;
  rechazados: number;
  ultimo: number;
}

/** «Clientes que te pagan»: por quien subió o por el nombre que leyó la IA, con buscador. */
export function Clients() {
  const { id = '' } = useParams();
  const { t, idioma } = useI18n();
  const msg = useMensajeError();
  const [nombre, setNombre] = useState('');
  const [lista, setLista] = useState<Cliente[] | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    api.get<CuentaDetalle>(`/cuentas/${id}`).then((d) => { setNombre(d.cuenta.nombre); recordarClaveUnica(d.cuenta.id, d.clave_unica?.activa); }).catch(() => undefined);
    api
      .get<{ clientes: Cliente[] }>(`/cuentas/${id}/clientes`)
      .then((r) => setLista(r.clientes))
      .catch((e) => setError(msg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const filtrados = (lista ?? []).filter((c) => !q.trim() || (c.nombre ?? '').toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Pagina angosta>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link to={`/accounts/${id}`} aria-label={t('common.back')} className="rounded-lg p-1.5 text-tenue hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{t('clients.title')}</h1>
            <p className="truncate text-sm text-tenue">{nombre}</p>
          </div>
        </div>
        <Link to={`/accounts/${id}/link`} aria-label={t('account.payLink')} className="rounded-lg p-2 text-tenue hover:text-white">
          <QrCode className="h-5 w-5" />
        </Link>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {!lista ? (
        !error && <Cargando />
      ) : lista.length === 0 ? (
        <Tarjeta className="flex flex-col items-center gap-2 py-8 text-center">
          <Users className="h-12 w-12 text-marca" aria-hidden />
          <p className="font-semibold">{t('clients.empty')}</p>
          <p className="text-sm text-tenue">{t('clients.emptyText')}</p>
          <Link to={`/accounts/${id}/link`}>
            <Boton className="mt-2">{t('clients.share')}</Boton>
          </Link>
        </Tarjeta>
      ) : (
        <>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tenue" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('clients.search')}
              aria-label={t('clients.search')}
              className="w-full rounded-xl border border-borde bg-[#0d1528] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-tenue/60 focus:border-marca"
            />
          </div>
          <p className="mb-3 px-1 text-xs text-tenue">
            {t('clients.count', { n: lista.length })} {t('clients.note')}
          </p>
          {filtrados.length === 0 && <p className="py-6 text-center text-sm text-tenue">{t('clients.noMatch')}</p>}
          <div className="space-y-2">
            {filtrados.map((c) => (
              <Tarjeta key={c.clave} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.nombre ?? (c.clave === 'x' ? t('clients.noName') : t('clients.withUser'))}</p>
                  <p className="text-xs text-tenue">
                    {t('clients.receipts', { n: c.comprobantes })} · {t('clients.last', { date: new Date(c.ultimo).toLocaleDateString(idioma === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium' }) })}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.tiene_usuario && <span className="rounded bg-green-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-green-300">{t('clients.hasUser')}</span>}
                    {c.por_link && <span className="rounded bg-blue-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">{t('review.byLink')}</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono font-semibold text-green-400">{formatoDinero(c.aprobado_cent, idioma)}</p>
                  <p className="text-[10px] text-tenue">{t('clients.approved')}</p>
                  {c.por_revisar > 0 && (
                    <Link to={`/accounts/${id}/review`} className="block text-xs font-semibold text-amber-300">
                      {t('home.pending', { n: c.por_revisar })}
                    </Link>
                  )}
                  {c.rechazados > 0 && <p className="text-xs text-red-400">{t('clients.rejected', { n: c.rechazados })}</p>}
                </div>
              </Tarjeta>
            ))}
          </div>
          <p className="mt-4 px-1 text-xs text-tenue">{t('clients.footer')}</p>
        </>
      )}
    </Pagina>
  );
}
