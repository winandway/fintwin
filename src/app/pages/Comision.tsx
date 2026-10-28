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
