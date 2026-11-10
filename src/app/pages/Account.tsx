import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  Download,
  ImagePlus,
  Info,
  KeyRound,
  ListChecks,
  LogOut,
  Menu,
  MessageCircle,
  MinusCircle,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  X,
  XCircle,
  AlertTriangle,
  Percent,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { comisionDe, formatoDinero } from '../../shared/reglas';
import { CampoClave } from '../components/CampoClave';
import { AvisoDuplicada, DatosLeidos, fechaCorta, HistorialRepetida, InsigniaEstado, PanelLectura, PuntoEstado } from '../components/Comprobantes';
import { Aviso, AvisoBorrador, Boton, Campo, Cargando, Modal, Pagina, Tarjeta } from '../components/ui';
import { TicketConIA, type LecturaTicket } from '../components/TicketConIA';
import { Visor } from '../components/Visor';
import { CATEGORIAS, claveCategoria } from '../lib/categorias';
import { recordarClaveUnica, useEtiquetaValidar } from '../lib/claveUnica';
import { api, ApiError, type CuentaDetalle, type Lectura, type Movimiento, type Movimientos, type Uso } from '../lib/api';
import { useBorrador } from '../lib/borrador';
import { imagenParaSubir } from '../lib/imagen';
import { useI18n, useMensajeError } from '../lib/i18n';
import { useSesion } from '../lib/sesion';

type Dialogo =
  | null
  | 'salida'
  | 'pin'
  | 'clave'
  | 'ajustes'
  | 'salir'
  | { tipo: 'aprobar' | 'espera' | 'cancelar'; mov: Movimiento };

const tz = () => new Date().getTimezoneOffset();

function nombreMes(mes: string, idioma: 'en' | 'es'): string {
  const [y, m] = mes.split('-').map(Number) as [number, number];
  const s = new Date(y, m - 1, 1).toLocaleDateString(idioma === 'es' ? 'es-US' : 'en-US', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function haceCuanto(ms: number, idioma: 'en' | 'es'): string {
  const rtf = new Intl.RelativeTimeFormat(idioma === 'es' ? 'es' : 'en', { numeric: 'auto' });
  const seg = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(seg);
  if (abs < 60) return rtf.format(seg, 'second');
  if (abs < 3600) return rtf.format(Math.round(seg / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seg / 3600), 'hour');
  return rtf.format(Math.round(seg / 86400), 'day');
}

/** «-$992.83», nunca «$-992.83». */
function dineroConSigno(cent: number, idioma: 'en' | 'es'): string {
  return cent < 0 ? `-${formatoDinero(-cent, idioma)}` : formatoDinero(cent, idioma);
}

/**
 * La pantalla de la cuenta, copiada del FinTwin original: total histórico, mes elegido con sus cifras,
 * registrar comprobante con lectura y aviso de repetida, salidas, y la lista de movimientos con su
 * punto de color, su búsqueda y sus acciones.
 */
export function Account() {
  const { id = '' } = useParams();
  const { t, idioma } = useI18n();
  const msg = useMensajeError();
  const navigate = useNavigate();
  const [detalle, setDetalle] = useState<CuentaDetalle | null>(null);
  const [periodo, setPeriodo] = useState<string>('');
  const [datos, setDatos] = useState<Movimientos | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [visor, setVisor] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error' | 'info'; texto: string } | null>(null);
  const [error, setError] = useState('');

  const cargarDetalle = useCallback(() => {
    api.get<CuentaDetalle>(`/cuentas/${id}`).then((d) => { recordarClaveUnica(d.cuenta.id, d.clave_unica?.activa); setDetalle(d); }).catch((e) => setError(msg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const cargar = useCallback(() => {
    api
      .get<Movimientos>(`/cuentas/${id}/movimientos?periodo=${periodo || 'mes'}&tz=${tz()}`)
      .then(setDatos)
      .catch((e) => setError(msg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, periodo]);
  useEffect(cargarDetalle, [cargarDetalle]);
  useEffect(cargar, [cargar]);

  const filtrados = useMemo(() => filtrar(datos?.movimientos ?? [], busqueda), [datos, busqueda]);

  if (error) {
    return (
      <Pagina>
        <Aviso tipo="error">{error}</Aviso>
      </Pagina>
    );
  }
  if (!detalle || !datos) return <Cargando />;

  const esDueno = detalle.rol === 'dueno';
  const pct = detalle.cuenta.comision_pct;
  const dinero = (c: number) => formatoDinero(c, idioma);
  const todo = datos.periodo === 'todo';
  const esActual = datos.periodo === datos.mes_actual;

  function exportar() {
    void api.get<Movimientos>(`/cuentas/${id}/movimientos?periodo=todo&tz=${tz()}`).then((r) => {
      if (!r.movimientos.length) return setAviso({ tipo: 'info', texto: t('mov.nothingToExport') });
      const cab = [t('csv.date'), t('csv.type'), t('csv.amount'), t('csv.fee'), t('csv.net'), t('csv.status'), t('csv.code'), t('csv.from'), t('csv.notes')];
      const limpio = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
      const filas = r.movimientos.map((k) => {
        const d = new Date(k.creado_en);
        const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const estado = k.en_espera ? t('mov.onHold') : t(`status.${k.estado}`);
        const neto = k.tipo === 'ingreso' ? k.monto_cent - k.comision_cent : k.monto_cent;
        return [fecha, k.tipo === 'ingreso' ? t('mov.income') : t('mov.outflow'), (k.monto_cent / 100).toFixed(2), (k.comision_cent / 100).toFixed(2), (neto / 100).toFixed(2), estado, k.confirmacion, k.pagador, k.notas ?? k.motivo]
          .map(limpio)
          .join(',');
      });
      const csv = '﻿' + [cab.map(limpio).join(','), ...filas].join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const hoy = new Date().toISOString().slice(0, 10);
      a.download = `${t('csv.file')}-${detalle!.cuenta.nombre.replace(/[^\p{L}\p{N}]+/gu, '-')}-${hoy}.csv`;
      a.click();
      setAviso({ tipo: 'exito', texto: t('mov.exported') });
    });
  }

  function trasAccion(texto: string) {
    setDialogo(null);
    setAviso({ tipo: 'exito', texto });
    cargar();
    cargarDetalle();
  }

  return (
    <Pagina>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/home" aria-label={t('common.back')} className="rounded-lg p-1.5 text-tenue hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="truncate text-lg font-bold">{t('mov.screenTitle')}</h1>
        </div>
        <MenuCuenta
          nombre={detalle.cuenta.nombre}
          meses={datos.meses}
          periodo={datos.periodo}
          mesActual={datos.mes_actual}
          onPeriodo={(p) => {
            setAbierto(null);
            setPeriodo(p === datos.mes_actual ? '' : p);
          }}
          acciones={[
            { texto: t('mov.refresh'), icono: <RefreshCw className="h-4 w-4" />, onClick: () => { cargar(); cargarDetalle(); } },
            { texto: `${t('mov.toReview')} (${datos.pendientes})`, icono: <ListChecks className="h-4 w-4" />, onClick: () => navigate(`/accounts/${id}/review`) },
            { texto: t('clients.title'), icono: <Users className="h-4 w-4" />, onClick: () => navigate(`/accounts/${id}/clients`) },
            { texto: t('mov.export'), icono: <Download className="h-4 w-4" />, onClick: exportar },
            ...(esDueno ? [{ texto: t('expense.title'), icono: <Percent className="h-4 w-4" />, onClick: () => navigate(`/accounts/${id}/commission`) }] : []),
            { texto: t('account.payLink'), icono: <QrCode className="h-4 w-4" />, onClick: () => navigate(`/accounts/${id}/link`) },
            ...(esDueno ? [{ texto: t('account.addPeople'), icono: <UserPlus className="h-4 w-4" />, onClick: () => navigate(`/accounts/${id}/team`) }] : []),
            { texto: t('account.myPin'), icono: <KeyRound className="h-4 w-4" />, onClick: () => setDialogo('pin') },
            { texto: t('unique.menu'), icono: <ShieldCheck className="h-4 w-4" />, onClick: () => setDialogo('clave') },
            ...(esDueno ? [{ texto: t('account.settings'), icono: <Settings className="h-4 w-4" />, onClick: () => setDialogo('ajustes') }] : []),
            {
              texto: t('mov.info'),
              icono: <Info className="h-4 w-4" />,
              onClick: () =>
                setAviso({
                  tipo: 'info',
                  texto: t('mov.infoText', { name: detalle.cuenta.nombre, date: new Date(detalle.cuenta.creado_en).toLocaleDateString(idioma === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium' }), pct }),
                }),
            },
            ...(!esDueno ? [{ texto: t('account.leave'), icono: <LogOut className="h-4 w-4" />, onClick: () => setDialogo('salir'), peligro: true }] : []),
          ]}
        />
      </div>

      {/* Tarjeta de la cuenta, estilo banco */}
      <div className="mb-3 overflow-hidden rounded-2xl border border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900">
        <div className="flex items-start justify-between gap-2 p-4 pb-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-gray-400">{t('mov.accountLabel')}</p>
            <p className="truncate text-xl font-bold" data-testid="nombre-cuenta">{detalle.cuenta.nombre}</p>
            <p className="text-xs text-gray-400">
              {t('mov.since', { date: new Date(detalle.cuenta.creado_en).toLocaleDateString(idioma === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium' }) })}
            </p>
          </div>
          <span className="rounded-full bg-blue-500 px-2.5 py-0.5 text-xs font-semibold text-white">{t('mov.active')}</span>
        </div>
        <div className="mx-4 mb-3 rounded-xl border border-blue-700/50 bg-gradient-to-br from-blue-900/40 to-blue-800/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">{t('account.total')}</p>
            {datos.ultimo && <p className="text-[11px] text-blue-300/70">{haceCuanto(datos.ultimo, idioma)}</p>}
          </div>
          <p className={`break-all font-mono text-3xl font-bold sm:text-4xl ${datos.total_cent < 0 ? 'text-red-400' : ''}`} data-testid="total">
            {dineroConSigno(datos.total_cent, idioma)}
          </p>
          <p className="text-xs text-blue-200/70">{t('account.totalHint')}</p>
          {datos.total_cent < 0 && (
            <p className="mt-1 text-xs text-red-300" data-testid="saldo-en-contra">
              {t('account.negative')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-gray-700/60 px-4 py-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Calendar className="h-4 w-4 text-tenue" aria-hidden />
            {todo ? t('mov.general') : nombreMes(datos.periodo, idioma)}
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white ${todo ? 'bg-purple-600' : esActual ? 'bg-blue-600' : 'bg-yellow-600'}`}>
              {todo ? t('mov.allTime') : esActual ? t('mov.currentMonth') : t('mov.pastMonth')}
            </span>
          </p>
          {!esActual && (
            <button onClick={() => setPeriodo('')} className="text-xs font-semibold text-blue-300 hover:text-white">
              ← {t('mov.backToCurrent')}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
          <Cifra etiqueta={t('mov.gross')} valor={dinero(datos.cifras.bruto_cent)} clase="border-gray-700 bg-gray-700/40" />
          <Link
            to={esDueno ? `/accounts/${id}/commission` : '#'}
            className="rounded-xl border border-green-700/50 bg-green-900/25 px-2 py-2 hover:border-green-500 hover:bg-green-900/40"
          >
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-green-300 sm:text-xs">{t('mov.feeLabel', { pct })}</p>
            <p className="truncate font-mono text-sm font-bold text-green-400">{dinero(datos.cifras.comision_queda_cent)}</p>
            {datos.cifras.comision_queda_cent !== datos.cifras.comision_cent && (
              <p className="truncate text-[10px] text-green-300/70">{t('mov.feeOf', { amount: dinero(datos.cifras.comision_cent) })}</p>
            )}
          </Link>
          {todo && (
            <Cifra
              etiqueta={t('mov.thisMonth')}
              valor={datos.este_mes_cent === datos.cifras.bruto_cent && datos.este_mes_cent > 0 ? t('mov.sameAsAll') : dinero(datos.este_mes_cent)}
              clase="border-purple-700/40 bg-purple-900/20 text-purple-300"
            />
          )}
          <Cifra etiqueta={t('account.outflows')} valor={dinero(datos.cifras.salidas_cent)} clase="border-red-700/40 bg-red-900/20 text-red-400" />
          <Cifra
            etiqueta={t('mov.cancelled')}
            valor={dinero(datos.cifras.cancelados_cent)}
            clase={`border-gray-600/50 bg-gray-700/30 text-gray-300 ${todo ? 'col-span-2 sm:col-span-1' : ''}`}
          />
        </div>
      </div>

      {aviso && (
        <div className="mb-3">
          <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>
        </div>
      )}

      <RegistrarComprobante
        cuentaId={id}
        nombre={detalle.cuenta.nombre}
        pct={pct}
        onListo={() => {
          setAviso({ tipo: 'exito', texto: t('mov.registered') });
          if (!esActual) setPeriodo('');
          cargar();
        }}
      />

      {esDueno && (
        <Tarjeta className="mb-3 space-y-2">
          <button
            onClick={() => setDialogo('salida')}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-600 px-4 py-3 font-semibold text-red-400 hover:bg-red-900/30"
          >
            <MinusCircle className="h-4 w-4" aria-hidden /> {t('account.recordOutflow')}
          </button>
          <p className="text-center text-xs text-tenue">{t('mov.outflowHint')}</p>
        </Tarjeta>
      )}

      <Tarjeta className="mb-24">
        <h2 className="mb-3 font-semibold">{t('mov.list', { n: datos.movimientos.length })}</h2>
        {datos.movimientos.length > 0 && (
          <div className="mb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tenue" aria-hidden />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={t('mov.searchPh')}
                aria-label={t('mov.searchPh')}
                className="w-full rounded-xl border border-borde bg-[#0d1528] py-2.5 pl-9 pr-9 text-sm text-white outline-none placeholder:text-tenue/60 focus:border-marca"
              />
              {busqueda && (
                <button onClick={() => setBusqueda('')} aria-label={t('mov.clearSearch')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-tenue hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {busqueda && (
              <p className="mt-1 text-xs text-tenue">
                {filtrados.length ? t('mov.matches', { n: filtrados.length, total: datos.movimientos.length }) : t('mov.noMatches')}
              </p>
            )}
          </div>
        )}
        {datos.movimientos.length === 0 ? (
          <p className="py-6 text-center text-sm text-tenue">{todo ? t('mov.emptyAll') : t('mov.emptyMonth')}</p>
        ) : (
          <div className="space-y-2">
            {filtrados.map((k) => (
              <FilaMovimiento
                key={k.id}
                k={k}
                cuentaId={id}
                pct={pct}
                abierta={abierto === k.id}
                onAlternar={() => setAbierto((a) => (a === k.id ? null : k.id))}
                onVer={() => setVisor(k.id)}
                onAccion={(tipo) => setDialogo({ tipo, mov: k })}
                onCopiado={() => setAviso({ tipo: 'exito', texto: t('mov.codeCopied') })}
              />
            ))}
          </div>
        )}
      </Tarjeta>

      {dialogo && typeof dialogo === 'object' && (
        <DialogoMovimiento
          key={`${dialogo.tipo}-${dialogo.mov.id}`}
          tipo={dialogo.tipo}
          mov={dialogo.mov}
          cuentaId={id}
          onCerrar={() => setDialogo(null)}
          onListo={trasAccion}
        />
      )}
      <DialogoSalida
        abierto={dialogo === 'salida'}
        cuentaId={id}
        totalCent={datos.total_cent}
        onCerrar={() => setDialogo(null)}
        onListo={() => trasAccion(t('outflow.done'))}
      />
      <DialogoClaveUnica
        abierto={dialogo === 'clave'}
        detalle={detalle}
        onCerrar={() => setDialogo(null)}
        onListo={(texto) => { setDialogo(null); setAviso({ tipo: 'exito', texto }); cargarDetalle(); }}
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
          cargar();
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

/** La búsqueda del original: monto, código, nombres, correos, plataforma, notas, y palabras de tipo y estado. */
function filtrar(lista: Movimiento[], q: string): Movimiento[] {
  const s = q.trim().toLowerCase();
  if (!s) return lista;
  const claves: Record<string, (k: Movimiento) => boolean> = {
    deposito: (k) => k.tipo === 'ingreso',
    depósito: (k) => k.tipo === 'ingreso',
    ingreso: (k) => k.tipo === 'ingreso',
    income: (k) => k.tipo === 'ingreso',
    retiro: (k) => k.tipo === 'salida',
    salida: (k) => k.tipo === 'salida',
    outflow: (k) => k.tipo === 'salida',
    pendiente: (k) => k.estado === 'pendiente' && !k.en_espera,
    pending: (k) => k.estado === 'pendiente' && !k.en_espera,
    aprobado: (k) => k.estado === 'aprobado',
    approved: (k) => k.estado === 'aprobado',
    rechazado: (k) => k.estado === 'rechazado',
    rejected: (k) => k.estado === 'rechazado',
    espera: (k) => Boolean(k.en_espera),
    hold: (k) => Boolean(k.en_espera),
    revision: (k) => Boolean(k.en_espera),
    revisión: (k) => Boolean(k.en_espera),
    banco: (k) => Boolean(k.en_espera),
  };
  const clave = claves[s];
  if (clave) return lista.filter(clave);
  return lista.filter((k) =>
    [
      (k.monto_cent / 100).toFixed(2),
      String(k.monto_cent / 100),
      k.confirmacion,
      k.pagador,
      k.pagador_correo,
      k.beneficiario,
      k.beneficiario_correo,
      k.plataforma,
      k.notas,
      k.motivo,
      k.comercio,
    ].some((v) => v && String(v).toLowerCase().includes(s)),
  );
}

function Cifra({ etiqueta, valor, clase }: { etiqueta: string; valor: string; clase: string }) {
  return (
    <div className={`rounded-xl border px-2 py-2 ${clase}`}>
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide opacity-80 sm:text-xs">{etiqueta}</p>
      <p className="truncate font-mono text-sm font-bold">{valor}</p>
    </div>
  );
}

interface Accion {
  texto: string;
  icono: ReactNode;
  onClick: () => void;
  peligro?: boolean;
}

/** El menú de la cuenta: los meses con movimientos, «Control general» y las acciones. */
function MenuCuenta({
  nombre,
  meses,
  periodo,
  mesActual,
  onPeriodo,
  acciones,
}: {
  nombre: string;
  meses: string[];
  periodo: string;
  mesActual: string;
  onPeriodo: (p: string) => void;
  acciones: Accion[];
}) {
  const { t, idioma } = useI18n();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAbierto(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [abierto]);
  const item = 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5';
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setAbierto((v) => !v)} aria-label={t('common.more')} aria-expanded={abierto} className="rounded-lg p-2 text-tenue hover:bg-white/5 hover:text-white">
        <Menu className="h-5 w-5" />
      </button>
      {abierto && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1 max-h-[80vh] w-64 overflow-y-auto rounded-xl border border-borde bg-panel p-1.5 shadow-xl">
          <p className="truncate px-3 py-1.5 text-xs font-semibold text-tenue">{nombre}</p>
          <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-wider text-tenue">{t('mov.month')}</p>
          {meses.map((m) => (
            <button key={m} role="menuitem" className={item} onClick={() => { setAbierto(false); onPeriodo(m); }}>
              <span className="flex-1">{nombreMes(m, idioma)}</span>
              {m === mesActual && <span className="text-[9px] font-bold uppercase text-blue-400">{t('mov.current')}</span>}
              {m === periodo && <Check className="h-4 w-4 text-green-400" aria-hidden />}
            </button>
          ))}
          <button role="menuitem" className={item} onClick={() => { setAbierto(false); onPeriodo('todo'); }}>
            <TrendingUp className="h-4 w-4" aria-hidden />
            <span className="flex-1">{t('mov.general')}</span>
            {periodo === 'todo' && <Check className="h-4 w-4 text-green-400" aria-hidden />}
          </button>
          <div className="my-1 border-t border-borde" />
          <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-wider text-tenue">{t('mov.actions')}</p>
          {acciones.map((a) => (
            <button key={a.texto} role="menuitem" className={`${item} ${a.peligro ? 'text-red-400' : ''}`} onClick={() => { setAbierto(false); a.onClick(); }}>
              {a.icono} {a.texto}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Una fila de «Movimientos»: cerrada muestra monto, fecha, código y el punto; abierta, todo lo leído y las acciones. */
function FilaMovimiento({
  k,
  cuentaId,
  pct,
  abierta,
  onAlternar,
  onVer,
  onAccion,
  onCopiado,
}: {
  k: Movimiento;
  cuentaId: string;
  pct: number;
  abierta: boolean;
  onAlternar: () => void;
  onVer: () => void;
  onAccion: (tipo: 'aprobar' | 'espera' | 'cancelar') => void;
  onCopiado: () => void;
}) {
  const { t, idioma } = useI18n();
  const salida = k.tipo === 'salida';
  const enEspera = Boolean(k.en_espera);
  const comision = k.estado === 'aprobado' ? k.comision_cent : comisionDe(k.monto_cent, pct);
  const dinero = (c: number) => formatoDinero(c, idioma);
  return (
    <div className={`overflow-hidden rounded-xl border ${salida ? 'border-red-800/30 bg-red-900/20' : abierta ? 'border-gray-600 bg-gray-700/30' : 'border-transparent bg-gray-700/50'}`}>
      <button onClick={onAlternar} aria-expanded={abierta} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5">
        <ChevronDown className={`h-4 w-4 shrink-0 text-tenue transition-transform ${abierta ? 'rotate-180' : ''}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className={`font-mono font-bold ${salida ? 'text-red-400' : ''}`}>
            {salida ? '− ' : '+ '}
            {dinero(k.monto_cent)}
          </p>
          <p className="truncate text-[11px] text-tenue">
            {salida ? t('mov.outflowDot') : t('mov.incomeDot')} {fechaCorta(k.creado_en, idioma, false)}
          </p>
        </div>
        {k.confirmacion && (
          <span dir="rtl" title={k.confirmacion} className="min-w-0 max-w-[45%] truncate font-mono text-sm font-bold text-indigo-300 sm:text-lg">
            <bdi>{k.confirmacion}</bdi>
          </span>
        )}
        <PuntoEstado estado={k.estado} enEspera={enEspera} repetidas={k.repetidas} />
      </button>
      {abierta && (
        <div className="space-y-3 border-t border-gray-600/60 p-3">
          {salida ? (
            <div className="rounded-xl border border-red-700/50 bg-red-900/30 p-3">
              <p className="text-[11px] font-semibold uppercase text-red-300">{t('mov.outflowAmount')}</p>
              <p className="font-mono text-xl font-bold text-red-400">−{dinero(k.monto_cent)}</p>
              <p className="text-xs text-red-200/70">{t('mov.outflowSub')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center">
              <Mini etiqueta={t('mov.gross')} valor={dinero(k.monto_cent)} clase="bg-white/5" />
              <Mini etiqueta={t('mov.feeShort', { pct })} valor={dinero(comision)} clase="bg-green-900/30 text-green-400" />
              <Mini etiqueta={t('mov.net')} valor={dinero(k.monto_cent - comision)} clase="bg-blue-900/30 text-blue-300" />
            </div>
          )}
          {(k.notas || k.motivo) && (
            <p className="flex gap-2 text-sm">
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" aria-hidden />
              <span className="whitespace-pre-line">
                {k.notas}
                {k.notas && k.motivo ? '\n' : ''}
                {k.motivo}
              </span>
            </p>
          )}
          {k.confirmacion && (
            <div className="rounded-xl border border-indigo-600/50 bg-gradient-to-br from-indigo-900/40 to-indigo-800/20 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300">{t('mov.codeTitle')}</p>
              <p className="select-all break-all font-mono text-xl font-bold sm:text-3xl">{k.confirmacion}</p>
              <button
                onClick={() => void navigator.clipboard?.writeText(k.confirmacion ?? '').then(onCopiado)}
                className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white"
              >
                <Copy className="h-3 w-3" aria-hidden /> {t('mov.tapToCopy')}
              </button>
            </div>
          )}
          {!salida && (k.pagador || k.beneficiario || k.plataforma || k.pagador_correo) && (
            <div className="rounded-xl border border-indigo-700/40 bg-indigo-900/20 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-indigo-300">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> {t('mov.detected')}
              </p>
              <DatosLeidos l={k} conMonto={false} />
            </div>
          )}
          {!salida && k.monto_leido_cent && Math.abs(k.monto_leido_cent - k.monto_cent) >= 1 && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {t('review.receiptSays', { amount: dinero(k.monto_leido_cent) })}
            </p>
          )}
          {Boolean(k.tiene_archivo) && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase text-tenue">{t('mov.receipt')}</p>
              <button onClick={onVer} className="block w-full" aria-label={t('account.viewReceipt')}>
                <img src={`/datos/archivo/${k.id}`} alt="" loading="lazy" className="mx-auto max-h-64 cursor-zoom-in rounded-lg object-contain" />
              </button>
            </div>
          )}
          {k.repetidas > 0 && <HistorialRepetida cuentaId={cuentaId} movId={k.id} repetidas={k.repetidas} />}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-600/60 pt-2">
            <div className="text-[11px] text-tenue">
              <p>{new Date(k.creado_en).toLocaleString(idioma === 'es' ? 'es-US' : 'en-US', { dateStyle: 'long', timeStyle: 'short' })}</p>
              {k.subido_por_nombre && <p>{t('account.uploadedBy', { name: k.subido_por_nombre })}{k.via === 'link' ? ` · ${t('review.byLink')}` : ''}</p>}
            </div>
            <InsigniaEstado estado={k.estado} enEspera={enEspera} />
          </div>
          {!salida && (
            <div className="flex gap-2">
              {k.estado === 'pendiente' && !enEspera && (
                <>
                  <button onClick={() => onAccion('cancelar')} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-700 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/30">
                    <XCircle className="h-4 w-4" aria-hidden /> {t('common.cancel')}
                  </button>
                  <button onClick={() => onAccion('aprobar')} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-green-600 px-3 py-2 text-sm font-semibold text-green-400 hover:bg-green-900/30">
                    <ShieldCheck className="h-4 w-4" aria-hidden /> {t('mov.confirm')}
                  </button>
                </>
              )}
              {enEspera && (
                <button onClick={() => onAccion('aprobar')} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-green-600 px-3 py-2 text-sm font-semibold text-green-400 hover:bg-green-900/30">
                  <ShieldCheck className="h-4 w-4" aria-hidden /> {t('mov.arrived')}
                </button>
              )}
              {k.estado === 'aprobado' && (
                <button onClick={() => onAccion('espera')} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-700 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/30">
                  <AlertTriangle className="h-4 w-4" aria-hidden /> {t('mov.putOnHold')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Mini({ etiqueta, valor, clase }: { etiqueta: string; valor: string; clase: string }) {
  return (
    <div className={`rounded-lg px-1 py-1.5 ${clase}`}>
      <p className="truncate text-[10px] opacity-80">{etiqueta}</p>
      <p className="truncate font-mono text-xs font-semibold">{valor}</p>
    </div>
  );
}

/** Aprobar (con PIN), poner en espera (con PIN y nota) o cancelar un pendiente. */
function DialogoMovimiento({
  tipo,
  mov,
  cuentaId,
  onCerrar,
  onListo,
}: {
  tipo: 'aprobar' | 'espera' | 'cancelar';
  mov: Movimiento;
  cuentaId: string;
  onCerrar: () => void;
  onListo: (texto: string) => void;
}) {
  const { t, idioma } = useI18n();
  const etiquetaValidar = useEtiquetaValidar(cuentaId);
  const msg = useMensajeError();
  const { usuario } = useSesion();
  const [pin, setPin] = useState('');
  // La nota de «en espera» se guarda mientras se escribe (el PIN nunca).
  const b = useBorrador(`espera-${mov.id}`, usuario?.id ?? 'anonimo', { nota: '' });
  const nota = b.valores.nota;
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      if (tipo === 'aprobar') {
        await api.post(`/cuentas/${cuentaId}/revisar`, { ids: [mov.id], accion: 'aprobar', pin });
        onListo(t('mov.approvedOne'));
      } else if (tipo === 'espera') {
        await api.post(`/cuentas/${cuentaId}/comprobantes/${mov.id}/espera`, { pin, nota: nota.trim() || undefined });
        b.limpiar();
        onListo(t('mov.heldOne'));
      } else {
        await api.post(`/cuentas/${cuentaId}/comprobantes/${mov.id}/cancelar`);
        onListo(t('mov.cancelledOne'));
      }
    } catch (err) {
      setError(msg(err));
      setPin('');
    } finally {
      setEnviando(false);
    }
  }
  const titulo = tipo === 'aprobar' ? t('mov.approveTitle') : tipo === 'espera' ? t('mov.holdTitle') : t('mov.cancelTitle');
  return (
    <Modal abierto onCerrar={onCerrar} titulo={titulo}>
      <form onSubmit={enviar} className="space-y-4">
        {tipo === 'cancelar' ? (
          <p className="text-sm text-tenue">{t('mov.cancelText', { amount: formatoDinero(mov.monto_cent, idioma) })}</p>
        ) : (
          <>
            <p className="text-sm text-tenue">{tipo === 'aprobar' ? t('mov.approveText') : t('mov.holdText')}</p>
            {tipo === 'espera' && (
              <>
                <AvisoBorrador visible={b.recuperado} onEmpezar={b.limpiar} />
                <Campo etiqueta={t('mov.holdNote')} maxLength={200} value={nota} onChange={(e) => b.set('nota', e.target.value)} />
              </>
            )}
            <CampoClave pin autoFocus etiqueta={etiquetaValidar} required value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          </>
        )}
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="flex gap-2">
          <Boton
            type="button"
            variante="secundario"
            className="flex-1"
            onClick={() => {
              if (tipo === 'espera') b.limpiar();
              onCerrar();
            }}
          >
            {tipo === 'cancelar' ? t('mov.goBack') : t('common.cancel')}
          </Boton>
          <Boton
            type="submit"
            variante={tipo === 'aprobar' ? 'primario' : 'peligro'}
            cargando={enviando}
            disabled={tipo !== 'cancelar' && pin.length !== 4}
            className="flex-1"
          >
            {tipo === 'aprobar' ? t('account.approve') : tipo === 'espera' ? t('mov.putOnHold') : t('mov.yesCancel')}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}

/**
 * «Registrar comprobante», como el original: al elegir la captura la IA la lee sola; si ya se usó,
 * el aviso rojo con su historial; antes de enviar, «ENTRADA de dinero» para no confundirse.
 */
function RegistrarComprobante({ cuentaId, nombre, pct, onListo }: { cuentaId: string; nombre: string; pct: number; onListo: () => void }) {
  const { t, idioma } = useI18n();
  const etiquetaValidar = useEtiquetaValidar(cuentaId);
  const msg = useMensajeError();
  const { usuario } = useSesion();
  const b = useBorrador(`registrar-${cuentaId}`, usuario?.id ?? 'anonimo', { monto: '', notas: '' });
  const input = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<Blob | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [repetida, setRepetida] = useState<{ creado_en: number; coincide: 'imagen' | 'codigo'; misma_cuenta: boolean } | null>(null);
  const [historial, setHistorial] = useState<Uso[]>([]);
  const [confirmar, setConfirmar] = useState(false);
  const [aceptar, setAceptar] = useState(false);
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const montoCent = Math.round((Number(b.valores.monto.replace(',', '.')) || 0) * 100);
  const comision = comisionDe(montoCent, pct);

  function limpiar() {
    b.limpiar();
    setArchivo(null);
    setVista(null);
    setLectura(null);
    setRepetida(null);
    setHistorial([]);
    setPin('');
    setError('');
    if (input.current) input.current.value = '';
  }

  async function elegir(f: File | undefined) {
    if (!f) return;
    setError('');
    if (!f.type.startsWith('image/')) return setError(t('err.no_es_imagen'));
    setLectura(null);
    setRepetida(null);
    setHistorial([]);
    const blob = await imagenParaSubir(f);
    setArchivo(blob);
    setVista(URL.createObjectURL(blob));
    setLeyendo(true);
    try {
      const form = new FormData();
      form.append('archivo', blob, 'captura');
      const r = await api.form<{ lectura: Lectura | null; repetida: typeof repetida; historial: Uso[] }>(`/cuentas/${cuentaId}/leer-captura`, form);
      setLectura(r.lectura);
      // El monto sale SIEMPRE de la captura actual (regla C-CAPTURA-MEZCLADA-1 del original).
      if (r.lectura?.monto_cent) b.set('monto', (r.lectura.monto_cent / 100).toFixed(2));
      setRepetida(r.repetida);
      setHistorial(r.historial);
    } catch (err) {
      setError(msg(err));
    } finally {
      setLeyendo(false);
    }
  }

  function intentar(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!archivo || !b.valores.monto) return setError(t('mov.fillAll'));
    if (repetida) return setError(t('mov.dupBlocked'));
    if (montoCent <= 0) return setError(t('err.monto_invalido'));
    setConfirmar(true);
  }

  async function enviar(conPin = false) {
    if (!archivo) return;
    setEnviando(true);
    setError('');
    try {
      const form = new FormData();
      form.append('archivo', archivo, 'captura');
      form.append('monto', b.valores.monto);
      form.append('notas', b.valores.notas);
      if (conPin) {
        form.append('aceptar_repetida', '1');
        form.append('pin', pin);
      }
      await api.form(`/cuentas/${cuentaId}/comprobantes`, form);
      setConfirmar(false);
      setAceptar(false);
      limpiar();
      onListo();
    } catch (err) {
      const e = err as ApiError;
      setConfirmar(false);
      if (e.code === 'captura_repetida' || e.code === 'repetida_misma_cuenta') {
        setAceptar(false);
        setRepetida({ creado_en: Date.now(), coincide: 'imagen', misma_cuenta: e.code === 'repetida_misma_cuenta' });
        setHistorial((e.data.historial as Uso[]) ?? []);
        if (historial.length === 0 && Array.isArray(e.data.historial) && e.data.historial[0]) {
          setRepetida({ creado_en: (e.data.historial as Uso[])[0]!.creado_en, coincide: (e.data.historial as Uso[])[0]!.coincide, misma_cuenta: e.code === 'repetida_misma_cuenta' });
        }
      } else if (conPin) {
        setError(msg(err));
        setPin('');
      } else setError(msg(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tarjeta className="mb-3">
      <h2 className="mb-3 font-semibold">{t('mov.register')}</h2>
      <form onSubmit={intentar} className="space-y-3">
        <AvisoBorrador visible={b.recuperado} onEmpezar={limpiar} />
        <Campo etiqueta={`${t('pay.amount')} *`} inputMode="decimal" placeholder="0.00" value={b.valores.monto} onChange={(e) => b.set('monto', e.target.value)} />
        {montoCent > 0 && (
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-green-700/50 bg-green-900/30 p-2 text-center">
            <Mini etiqueta={t('mov.gross')} valor={formatoDinero(montoCent, idioma)} clase="" />
            <Mini etiqueta={`${pct}%`} valor={formatoDinero(comision, idioma)} clase="text-green-400" />
            <Mini etiqueta={t('mov.net')} valor={formatoDinero(montoCent - comision, idioma)} clase="text-blue-400" />
          </div>
        )}
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void elegir(e.target.files?.[0])} data-testid="captura-cuenta" />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-5 ${archivo ? 'border-green-500 bg-green-900/30' : 'border-gray-600 text-tenue hover:border-blue-500 hover:text-white'}`}
        >
          {vista ? (
            <>
              <img src={vista} alt="" className="max-h-48 rounded-lg object-contain" />
              <span className="text-sm text-tenue">{t('mov.tapToChange')}</span>
            </>
          ) : (
            <>
              <ImagePlus className="h-7 w-7" aria-hidden />
              <span className="font-semibold">{t('mov.tapToUpload')} *</span>
              <span className="text-xs">{t('mov.fileHint')}</span>
            </>
          )}
        </button>
        {repetida ? (
          <AvisoDuplicada
            creadoEn={repetida.creado_en}
            coincide={repetida.coincide}
            mismaCuenta={repetida.misma_cuenta}
            historial={historial}
            onCancelar={limpiar}
            onAceptar={() => setAceptar(true)}
          />
        ) : (
          <PanelLectura leyendo={leyendo} lectura={lectura} pasoFinal={t('mov.step3')} />
        )}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-white">{t('mov.notes')}</span>
          <textarea
            rows={2}
            maxLength={300}
            value={b.valores.notas}
            onChange={(e) => b.set('notas', e.target.value)}
            placeholder={t('mov.notesPh')}
            className="w-full rounded-xl border border-borde bg-[#0d1528] px-4 py-3 text-white outline-none placeholder:text-tenue/60 focus:border-marca"
          />
        </label>
        {error && <Aviso tipo="error">{error}</Aviso>}
        {!repetida && (
          <div className="flex gap-2">
            {(archivo || b.valores.monto || b.valores.notas) && (
              <Boton type="button" variante="secundario" disabled={leyendo || enviando} onClick={limpiar}>
                {t('common.cancel')}
              </Boton>
            )}
            <Boton type="submit" className="flex-1" cargando={enviando} disabled={!archivo || !b.valores.monto || leyendo}>
              {enviando ? t('mov.uploading') : t('mov.upload')}
            </Boton>
          </div>
        )}
      </form>

      <Modal abierto={confirmar} onCerrar={() => setConfirmar(false)} titulo={t('mov.entryTitle')}>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-yellow-400 bg-yellow-500/20">
            <AlertTriangle className="h-10 w-10 text-yellow-400" aria-hidden />
          </div>
          <p className="text-2xl font-bold text-yellow-300">{t('mov.entryTitle')}</p>
          <p className="font-semibold">{t('mov.entryNot')}</p>
          <p className="text-sm text-tenue">{t('mov.entryText', { amount: formatoDinero(montoCent, idioma), name: nombre })}</p>
          <div className="flex gap-2">
            <Boton variante="secundario" className="flex-1" onClick={() => setConfirmar(false)}>
              {t('common.cancel')}
            </Boton>
            <Boton className="flex-1 !bg-blue-600 hover:!bg-blue-500" cargando={enviando} onClick={() => void enviar(false)}>
              {t('mov.accept')}
            </Boton>
          </div>
        </div>
      </Modal>

      <Modal abierto={aceptar} onCerrar={() => { setAceptar(false); setPin(''); }} titulo={t('dup.bigTitle')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pin.length !== 4) return setError(t('dup.writePin'));
            void enviar(true);
          }}
          className="space-y-4"
        >
          <div className="rounded-xl border-2 border-red-500 bg-red-900/30 p-4 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-red-500" aria-hidden />
            <p className="text-xl font-extrabold uppercase text-red-400">{t('dup.bigTitle')}</p>
            <p className="font-semibold">{t('dup.sure')}</p>
            <p className="mt-1 text-sm text-red-200">{t('dup.needPin')}</p>
          </div>
          <CampoClave pin autoFocus etiqueta={etiquetaValidar} required value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="flex gap-2">
            <Boton type="button" variante="secundario" className="flex-1" onClick={() => { setAceptar(false); setPin(''); }}>
              {t('common.cancel')}
            </Boton>
            <Boton type="submit" variante="peligro" className="flex-1" cargando={enviando} disabled={pin.length !== 4}>
              {t('dup.uploadWithPin')}
            </Boton>
          </div>
        </form>
      </Modal>
    </Tarjeta>
  );
}

function DialogoSalida({
  abierto,
  cuentaId,
  totalCent,
  onCerrar,
  onListo,
}: {
  abierto: boolean;
  cuentaId: string;
  totalCent: number;
  onCerrar: () => void;
  onListo: () => void;
}) {
  const { t, idioma } = useI18n();
  const msg = useMensajeError();
  const { usuario } = useSesion();
  const b = useBorrador(
    `salida-${cuentaId}`,
    usuario?.id ?? 'anonimo',
    { monto: '', motivo: '', comercio: '', categoria: '', fecha: '', pin: '' },
    ['pin'],
  );
  const [archivo, setArchivo] = useState<Blob | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [repetida, setRepetida] = useState(false);
  const montoCent = Math.round((Number(b.valores.monto.replace(',', '.')) || 0) * 100);
  const quedaria = totalCent - montoCent;

  function aplicarLectura(l: LecturaTicket) {
    if (l.total_cent && !b.valores.monto) b.set('monto', (l.total_cent / 100).toFixed(2));
    if (l.comercio) b.set('comercio', l.comercio);
    if (l.categoria) b.set('categoria', l.categoria);
    if (l.fecha) b.set('fecha', l.fecha);
    if (!b.valores.motivo && (l.resumen || l.comercio)) b.set('motivo', (l.resumen || l.comercio) ?? '');
  }

  async function enviar(confirmar = false) {
    if (!archivo) {
      setError(t('err.factura_requerida'));
      return;
    }
    setEnviando(true);
    setError('');
    try {
      const form = new FormData();
      form.append('archivo', archivo, 'factura');
      for (const k of ['monto', 'motivo', 'comercio', 'categoria', 'fecha', 'pin'] as const) form.append(k, b.valores[k]);
      if (confirmar) form.append('confirmar_repetida', '1');
      await api.form(`/cuentas/${cuentaId}/salidas`, form);
      b.limpiar();
      setArchivo(null);
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
        <TicketConIA cuentaId={cuentaId} etiqueta={t('outflow.ticket')} archivo={archivo} onArchivo={setArchivo} onLectura={aplicarLectura} />
        <Campo etiqueta={t('outflow.amount')} inputMode="decimal" required placeholder="0.00" value={b.valores.monto} onChange={(e) => b.set('monto', e.target.value)} />
        {montoCent > 0 && quedaria < 0 && (
          <Aviso tipo="info">
            <span data-testid="aviso-en-contra">{t('outflow.negative', { amount: formatoDinero(quedaria, idioma) })}</span>
          </Aviso>
        )}
        <Campo etiqueta={t('outflow.reason')} required minLength={2} maxLength={200} value={b.valores.motivo} onChange={(e) => b.set('motivo', e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Campo etiqueta={t('expense.merchant')} maxLength={80} value={b.valores.comercio} onChange={(e) => b.set('comercio', e.target.value)} />
          <SelectorCategoria valor={b.valores.categoria} onCambio={(v) => b.set('categoria', v)} />
        </div>
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
          <Boton type="submit" cargando={enviando} disabled={!archivo} className="w-full">
            {t('outflow.title')}
          </Boton>
        )}
      </form>
    </Modal>
  );
}

export function SelectorCategoria({ valor, onCambio }: { valor: string; onCambio: (v: string) => void }) {
  const { t } = useI18n();
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-white">{t('expense.category')}</span>
      <select
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="w-full rounded-xl border border-borde bg-[#0d1528] px-3 py-3 text-white outline-none focus:border-marca"
      >
        <option value="">—</option>
        {CATEGORIAS.map((c) => (
          <option key={c} value={c}>
            {t(claveCategoria(c))}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Clave única para validar (C-CLAVE-UNICA-1): crearla, cambiarla si es mía, o ver quién la tiene. */
function DialogoClaveUnica({ abierto, detalle, onCerrar, onListo }: { abierto: boolean; detalle: CuentaDetalle; onCerrar: () => void; onListo: (texto: string) => void }) {
  const { t, idioma } = useI18n();
  const msg = useMensajeError();
  const [pin, setPin] = useState('');
  const [nueva, setNueva] = useState('');
  const [repite, setRepite] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const estado = detalle.clave_unica ?? { activa: false, por_mi: false, nombre: null, en: null };
  const fecha = estado.en ? new Date(estado.en).toLocaleDateString(idioma === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium' }) : '';
  const solo = (v: string) => v.replace(/\D/g, '').slice(0, 4);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (nueva !== repite) return setError(t('unique.mismatch'));
    setEnviando(true);
    try {
      await api.post(`/cuentas/${detalle.cuenta.id}/clave-unica`, estado.activa ? { actual: pin, nueva } : { pin, nueva });
      setPin('');
      setNueva('');
      setRepite('');
      onListo(estado.activa ? t('unique.changed') : t('unique.created'));
    } catch (err) {
      setError(msg(err));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={t('unique.title')}>
      {estado.activa && !estado.por_mi ? (
        <div className="space-y-4" data-testid="clave-de-otro">
          <p className="text-sm text-tenue">{t('unique.otherText', { name: estado.nombre ?? '—', date: fecha })}</p>
          <Boton variante="secundario" className="w-full" onClick={onCerrar}>
            {t('common.close')}
          </Boton>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <p className="text-sm text-tenue">{estado.activa ? t('unique.mineText', { date: fecha }) : t('unique.offText')}</p>
          <CampoClave pin etiqueta={estado.activa ? t('unique.current') : t('unique.myPin')} required value={pin} onChange={(e) => setPin(solo(e.target.value))} />
          <CampoClave pin etiqueta={t('unique.new')} required value={nueva} onChange={(e) => setNueva(solo(e.target.value))} />
          <CampoClave pin etiqueta={t('unique.repeat')} required value={repite} onChange={(e) => setRepite(solo(e.target.value))} />
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Boton type="submit" cargando={enviando} className="w-full">
            {estado.activa ? t('unique.change') : t('unique.create')}
          </Boton>
        </form>
      )}
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
