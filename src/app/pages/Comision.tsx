import { ArrowLeft, ReceiptText } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatoDinero } from '../../shared/reglas';
import { CampoClave } from '../components/CampoClave';
import { TicketConIA, type LecturaTicket } from '../components/TicketConIA';
import { Aviso, AvisoBorrador, Boton, Campo, Cargando, Pagina, Tarjeta } from '../components/ui';
import { Visor } from '../components/Visor';
import { api } from '../lib/api';
import { useBorrador } from '../lib/borrador';
import { claveCategoria } from '../lib/categorias';
import { useI18n, useMensajeError } from '../lib/i18n';
import { useSesion } from '../lib/sesion';
import { SelectorCategoria } from './Account';

interface Gasto {
  id: string;
  monto_cent: number;
  comercio: string | null;
  categoria: string | null;
  fecha: string | null;
  nota: string | null;
  creado_en: number;
}

interface Comision {
  generada_cent: number;
  gastada_cent: number;
  disponible_cent: number;
  gastos: Gasto[];
  por_categoria_mes: { categoria: string; total_cent: number; cantidad: number }[];
  generada_lista: { creado_en: number; comision_cent: number }[];
}

const diaLocal = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Como el original: lo generado hoy, ayer y este mes; por día; y por mes con lo que queda acumulado. */
function cuentasDeComision(d: Comision) {
  const hoy = diaLocal(Date.now());
  const ayer = diaLocal(Date.now() - 86400000);
  const mes = hoy.slice(0, 7);
  const porDia = new Map<string, { total: number; n: number }>();
  const porMes = new Map<string, { generado: number; gastado: number }>();
  for (const g of d.generada_lista) {
    const dia = diaLocal(g.creado_en);
    const x = porDia.get(dia) ?? { total: 0, n: 0 };
    porDia.set(dia, { total: x.total + g.comision_cent, n: x.n + 1 });
    const m = porMes.get(dia.slice(0, 7)) ?? { generado: 0, gastado: 0 };
    porMes.set(dia.slice(0, 7), { ...m, generado: m.generado + g.comision_cent });
  }
  for (const g of d.gastos) {
    const k = diaLocal(g.creado_en).slice(0, 7);
    const m = porMes.get(k) ?? { generado: 0, gastado: 0 };
    porMes.set(k, { ...m, gastado: m.gastado + g.monto_cent });
  }
  let queda = 0;
  const meses = [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => {
      queda += v.generado - v.gastado;
      return { mes: k, ...v, queda };
    })
    .reverse();
  const delMes = [...porDia.entries()].filter(([k]) => k.startsWith(mes)).reduce((s, [, v]) => s + v.total, 0);
  return {
    hoy: porDia.get(hoy)?.total ?? 0,
    ayer: porDia.get(ayer)?.total ?? 0,
    mes: delMes,
    // Lo que viene de meses anteriores sin gastar.
    arrastre: Math.max(0, d.disponible_cent - Math.max(0, delMes - d.gastos.filter((g) => diaLocal(g.creado_en).startsWith(mes)).reduce((s, g) => s + g.monto_cent, 0))),
    dias: [...porDia.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 60),
    meses,
  };
}

/** Gastos pagados con la comisión: cada uno con su ticket, leído por la IA. */
export function Commission() {
  const { id = '' } = useParams();
  const { t, idioma } = useI18n();
  const msg = useMensajeError();
  const { usuario } = useSesion();
  const [datos, setDatos] = useState<Comision | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [visor, setVisor] = useState<string | null>(null);
  const b = useBorrador(`gasto-${id}`, usuario?.id ?? 'anonimo', { monto: '', comercio: '', categoria: '', fecha: '', nota: '', pin: '' }, ['pin']);
  const [archivo, setArchivo] = useState<Blob | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState('');
  const dinero = (c: number) => formatoDinero(c, idioma);

  const cargar = useCallback(() => {
    api.get<Comision>(`/cuentas/${id}/comision`).then(setDatos).catch((e) => setError(msg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(cargar, [cargar]);

  function aplicarLectura(l: LecturaTicket) {
    if (l.total_cent && !b.valores.monto) b.set('monto', (l.total_cent / 100).toFixed(2));
    if (l.comercio) b.set('comercio', l.comercio);
    if (l.categoria) b.set('categoria', l.categoria);
    if (l.fecha) b.set('fecha', l.fecha);
    if (l.resumen && !b.valores.nota) b.set('nota', l.resumen);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!archivo) return setErrorForm(t('err.ticket_requerido'));
    setEnviando(true);
    setErrorForm('');
    try {
      const form = new FormData();
      form.append('archivo', archivo, 'ticket');
      for (const k of ['monto', 'comercio', 'categoria', 'fecha', 'nota', 'pin'] as const) form.append(k, b.valores[k]);
      await api.form(`/cuentas/${id}/comision/gastos`, form);
      b.limpiar();
      setArchivo(null);
      setAviso(t('expense.done'));
      cargar();
    } catch (err) {
      setErrorForm(msg(err));
    } finally {
      setEnviando(false);
    }
  }

  if (error) return <Pagina><Aviso tipo="error">{error}</Aviso></Pagina>;
  if (!datos) return <Cargando />;

  return (
    <Pagina>
      <div className="mb-4 flex items-center gap-2">
        <Link to={`/accounts/${id}`} aria-label={t('common.back')} className="rounded-lg p-1.5 text-tenue hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">{t('expense.title')}</h1>
      </div>
      <p className="mb-4 text-sm text-tenue">{t('expense.text')}</p>

      <Tarjeta className="mb-4">
        <p className="text-sm text-tenue">{t('expense.available')}</p>
        <p className="font-mono text-3xl font-bold" data-testid="comision-disponible">{dinero(datos.disponible_cent)}</p>
        <p className="mt-1 text-xs text-tenue">
          {t('expense.earned')} {dinero(datos.generada_cent)} · {t('expense.spent')} {dinero(datos.gastada_cent)}
        </p>
      </Tarjeta>

      <ResumenComision datos={datos} />

      {aviso && <div className="mb-3"><Aviso tipo="exito">{aviso}</Aviso></div>}

      <Tarjeta className="mb-4">
        <h2 className="mb-3 font-semibold">{t('expense.new')}</h2>
        <form onSubmit={guardar} className="space-y-4">
          <AvisoBorrador visible={b.recuperado} onEmpezar={b.limpiar} />
          <TicketConIA cuentaId={id} etiqueta={t('expense.ticket')} archivo={archivo} onArchivo={setArchivo} onLectura={aplicarLectura} />
          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta={t('outflow.amount')} inputMode="decimal" required placeholder="0.00" value={b.valores.monto} onChange={(e) => b.set('monto', e.target.value)} />
            <Campo etiqueta={t('expense.date')} type="date" value={b.valores.fecha} onChange={(e) => b.set('fecha', e.target.value)} />
            <Campo etiqueta={t('expense.merchant')} maxLength={80} value={b.valores.comercio} onChange={(e) => b.set('comercio', e.target.value)} />
            <SelectorCategoria valor={b.valores.categoria} onCambio={(v) => b.set('categoria', v)} />
          </div>
          <Campo etiqueta={t('expense.note')} maxLength={200} value={b.valores.nota} onChange={(e) => b.set('nota', e.target.value)} />
          <CampoClave pin etiqueta={t('field.pin')} required value={b.valores.pin} onChange={(e) => b.set('pin', e.target.value.replace(/\D/g, ''))} />
          {errorForm && <Aviso tipo="error">{errorForm}</Aviso>}
          <Boton type="submit" cargando={enviando} disabled={!archivo} className="w-full">
            {t('expense.save')}
          </Boton>
        </form>
      </Tarjeta>

      {datos.por_categoria_mes.length > 0 && (
        <Tarjeta className="mb-4">
          <h2 className="mb-2 font-semibold">{t('expense.byCategory')}</h2>
          <div className="space-y-1 text-sm" data-testid="por-categoria">
            {datos.por_categoria_mes.map((c) => (
              <div key={c.categoria || 'sin'} className="flex justify-between gap-2">
                <span className="text-tenue">{t(claveCategoria(c.categoria))} ({c.cantidad})</span>
                <span className="font-mono">{dinero(c.total_cent)}</span>
              </div>
            ))}
          </div>
        </Tarjeta>
      )}

      <h2 className="mb-2 font-semibold">{t('expense.history')}</h2>
      {datos.gastos.length === 0 ? (
        <p className="py-6 text-center text-sm text-tenue">{t('expense.empty')}</p>
      ) : (
        <div className="space-y-2 pb-10">
          {datos.gastos.map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-2xl border border-borde bg-panel p-3">
              <ReceiptText className="h-5 w-5 shrink-0 text-tenue" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{g.comercio ?? t(claveCategoria(g.categoria))}</p>
                <p className="truncate text-xs text-tenue">
                  {t(claveCategoria(g.categoria))} · {g.fecha ?? new Date(g.creado_en).toLocaleDateString(idioma === 'es' ? 'es-US' : 'en-US')}
                  {g.nota ? ` · ${g.nota}` : ''}
                </p>
              </div>
              <span className="font-mono font-semibold">-{dinero(g.monto_cent)}</span>
              <button onClick={() => setVisor(g.id)} className="rounded-lg border border-borde px-2 py-1.5 text-xs text-tenue hover:text-white">
                {t('expense.viewTicket')}
              </button>
            </div>
          ))}
        </div>
      )}
      <Visor id={visor} onCerrar={() => setVisor(null)} ruta="/datos/gasto-archivo/" />
    </Pagina>
  );
}

function ResumenComision({ datos }: { datos: Comision }) {
  const { t, idioma } = useI18n();
  const [verDias, setVerDias] = useState(false);
  const c = cuentasDeComision(datos);
  const dinero = (x: number) => formatoDinero(x, idioma);
  const nombreMes = (k: string) => {
    const [y, m] = k.split('-').map(Number) as [number, number];
    return new Date(y, m - 1, 1).toLocaleDateString(idioma === 'es' ? 'es-US' : 'en-US', { month: 'short', year: 'numeric' });
  };
  return (
    <div className="mb-4 space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          [t('fee.today'), c.hoy, 'text-green-400'],
          [t('fee.yesterday'), c.ayer, ''],
          [t('mov.thisMonth'), c.mes, ''],
        ].map(([k, v, cl]) => (
          <div key={k as string} className="rounded-xl border border-borde bg-white/5 px-1 py-2">
            <p className="text-[10px] font-semibold uppercase text-tenue">{k}</p>
            <p className={`font-mono text-sm font-bold ${cl as string}`}>{dinero(v as number)}</p>
          </div>
        ))}
      </div>
      {c.arrastre > 0 && (
        <p className="rounded-xl border border-amber-700/50 bg-amber-900/20 p-3 text-xs text-amber-200">{t('fee.carry', { amount: dinero(c.arrastre) })}</p>
      )}
      {c.dias.length > 0 && (
        <Tarjeta>
          <button onClick={() => setVerDias((v) => !v)} className="flex w-full items-center justify-between text-sm font-semibold">
            {t('fee.byDay', { n: c.dias.length })} <span className="text-tenue">{verDias ? '−' : '+'}</span>
          </button>
          {verDias && (
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
              {c.dias.map(([dia, v]) => (
                <div key={dia} className="flex justify-between gap-2">
                  <span className="text-tenue">
                    {new Date(`${dia}T12:00:00`).toLocaleDateString(idioma === 'es' ? 'es-US' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {t('fee.receiptsN', { n: v.n })}
                  </span>
                  <span className="font-mono text-green-400">+ {dinero(v.total)}</span>
                </div>
              ))}
            </div>
          )}
        </Tarjeta>
      )}
      {c.meses.length > 0 && (
        <Tarjeta>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-tenue">{t('fee.byMonth')}</h2>
          <table className="w-full text-sm" data-testid="comision-por-mes">
            <thead>
              <tr className="text-left text-[11px] text-tenue">
                <th className="font-medium">{t('mov.month')}</th>
                <th className="text-right font-medium">{t('fee.generated')}</th>
                <th className="text-right font-medium">{t('account.outflows')}</th>
                <th className="text-right font-medium">{t('fee.left')}</th>
              </tr>
            </thead>
            <tbody>
              {c.meses.map((m) => (
                <tr key={m.mes}>
                  <td className="py-0.5">{nombreMes(m.mes)}</td>
                  <td className="text-right font-mono text-green-400">{dinero(m.generado)}</td>
                  <td className="text-right font-mono">−{dinero(m.gastado)}</td>
                  <td className="text-right font-mono font-bold">{dinero(m.queda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-tenue">{t('fee.leftNote')}</p>
        </Tarjeta>
      )}
    </div>
  );
}
