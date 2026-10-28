import { ChevronRight, Plus, Receipt, Upload } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CampoClave } from '../components/CampoClave';
import { Aviso, AvisoBorrador, Boton, Campo, Cargando, Pagina, Tarjeta } from '../components/ui';
import { formatoDinero } from '../../shared/reglas';
import { api, type CuentaLista } from '../lib/api';
import { useBorrador } from '../lib/borrador';
import { useI18n, useMensajeError } from '../lib/i18n';
import { useSesion } from '../lib/sesion';

interface MisPagos {
  empresas: { nombre: string; link_slug: string }[];
  comprobantes: { id: string; estado: 'pendiente' | 'aprobado' | 'rechazado'; monto_cent: number; confirmacion: string | null; creado_en: number; cuenta_nombre: string }[];
}

export function Estado({ estado }: { estado: 'pendiente' | 'aprobado' | 'rechazado' }) {
  const { t } = useI18n();
  // Verde = salió bien; rojo solo para problemas; gris = pendiente.
  const estilos = { pendiente: 'bg-white/10 text-tenue', aprobado: 'bg-exito/15 text-green-300', rechazado: 'bg-problema/15 text-red-300' }[estado];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${estilos}`}>{t(`status.${estado}`)}</span>;
}

export function Home() {
  const { t, idioma } = useI18n();
  const { usuario } = useSesion();
  const msg = useMensajeError();
  const [tab, setTab] = useState<'cuentas' | 'pagos'>('cuentas');
  const [cuentas, setCuentas] = useState<CuentaLista[] | null>(null);
  const [pagos, setPagos] = useState<MisPagos | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<{ cuentas: CuentaLista[] }>('/cuentas')
      .then((r) => {
        setCuentas(r.cuentas);
        if (r.cuentas.length === 0) setTab('pagos');
      })
      .catch((e) => setError(msg(e)));
    api.get<MisPagos>('/mis-pagos').then(setPagos).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <Pagina><Aviso tipo="error">{error}</Aviso></Pagina>;
  if (!cuentas) return <Cargando />;

  return (
    <Pagina>
      <h1 className="mb-4 text-2xl font-bold">{t('home.hi', { name: usuario?.nombre.split(' ')[0] ?? '' })}</h1>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-borde bg-panel p-1" role="tablist">
        {(['cuentas', 'pagos'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-lg py-2 text-sm font-semibold ${tab === k ? 'bg-white/10 text-white' : 'text-tenue'}`}
          >
            {k === 'cuentas' ? t('home.myAccounts') : t('home.myPayments')}
          </button>
        ))}
      </div>

      {tab === 'cuentas' ? (
        <div className="space-y-3">
          {cuentas.length === 0 && <p className="text-sm text-tenue">{t('home.emptyAccounts')}</p>}
          {cuentas.map((c) => (
            <Link key={c.id} to={`/accounts/${c.id}`} className="block">
              <Tarjeta className="flex items-center justify-between gap-3 hover:border-tenue">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.nombre}</p>
                  <p className="text-xs text-tenue">
                    {c.rol === 'dueno' ? t('home.owner') : t('home.validator')}
                    {c.pendientes > 0 && <span className="ml-2 font-semibold text-amber-300">· {t('home.pending', { n: c.pendientes })}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{formatoDinero(c.total_cent, idioma)}</span>
                  <ChevronRight className="h-4 w-4 text-tenue" aria-hidden />
                </div>
              </Tarjeta>
            </Link>
          ))}
          <Link to="/accounts/new">
            <Boton variante="secundario" className="mt-2 w-full">
              <Plus className="h-4 w-4" aria-hidden /> {t('home.newAccount')}
            </Boton>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {!pagos || (pagos.empresas.length === 0 && pagos.comprobantes.length === 0) ? (
            <p className="text-sm text-tenue">{t('home.emptyPayments')}</p>
          ) : (
            <>
              {pagos.empresas.map((e) => (
                <Link key={e.link_slug} to={`/pay/${e.link_slug}`}>
                  <Tarjeta className="flex items-center justify-between gap-3 hover:border-tenue">
                    <span className="truncate font-semibold">{e.nombre}</span>
                    <span className="flex items-center gap-1.5 text-sm text-marca">
                      <Upload className="h-4 w-4" aria-hidden /> {t('home.uploadAgain')}
                    </span>
                  </Tarjeta>
                </Link>
              ))}
              <div className="divide-y divide-borde rounded-2xl border border-borde bg-panel">
                {pagos.comprobantes.map((k) => (
                  <div key={k.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Receipt className="h-4 w-4 shrink-0 text-tenue" aria-hidden />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{k.cuenta_nombre}</p>
                        <p className="truncate text-xs text-tenue">
                          {new Date(k.creado_en).toLocaleDateString(idioma === 'es' ? 'es-US' : 'en-US')} · #{k.confirmacion}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-mono text-sm">{formatoDinero(k.monto_cent, idioma)}</span>
                      <Estado estado={k.estado} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Pagina>
  );
}

export function NewAccount() {
  const { t } = useI18n();
  const msg = useMensajeError();
  const { usuario } = useSesion();
  const navigate = useNavigate();
  const b = useBorrador('nueva-cuenta', usuario?.id ?? 'anonimo', { nombre: '', comision: '0', pin: '' }, ['pin']);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const r = await api.post<{ id: string }>('/cuentas', {
        nombre: b.valores.nombre,
        pin: b.valores.pin,
        comision_pct: Number(b.valores.comision.replace(',', '.')) || 0,
      });
      b.limpiar();
      navigate(`/accounts/${r.id}`, { replace: true });
    } catch (err) {
      setError(msg(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pagina angosta>
      <Tarjeta>
        <h1 className="mb-4 text-xl font-bold">{t('newAccount.title')}</h1>
        <form onSubmit={enviar} className="space-y-4">
          <AvisoBorrador visible={b.recuperado} onEmpezar={b.limpiar} />
          <Campo etiqueta={t('newAccount.name')} placeholder={t('newAccount.namePh')} required minLength={2} maxLength={80} value={b.valores.nombre} onChange={(e) => b.set('nombre', e.target.value)} />
          <Campo etiqueta={t('newAccount.fee')} ayuda={t('newAccount.feeHint')} inputMode="decimal" value={b.valores.comision} onChange={(e) => b.set('comision', e.target.value)} />
          <CampoClave pin etiqueta={t('field.pin')} ayuda={t('field.pinHint')} required value={b.valores.pin} onChange={(e) => b.set('pin', e.target.value.replace(/\D/g, ''))} />
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="flex gap-2">
            <Boton type="button" variante="secundario" className="flex-1" onClick={() => { b.limpiar(); navigate('/home'); }}>
              {t('common.cancel')}
            </Boton>
            <Boton type="submit" cargando={enviando} className="flex-1">
              {t('newAccount.create')}
            </Boton>
          </div>
        </form>
      </Tarjeta>
    </Pagina>
  );
}
