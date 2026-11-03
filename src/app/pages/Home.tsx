import { BookOpen, Building2, ChevronRight, KeyRound, LifeBuoy, ListChecks, LogOut, Plus, QrCode, Receipt, RefreshCw, Send, Upload, UserRound, Users, Wallet } from 'lucide-react';
import { MenuPuntos } from '../components/MenuPuntos';
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
  const { usuario, salir } = useSesion();
  const msg = useMensajeError();
  const navigate = useNavigate();
  const [cuentas, setCuentas] = useState<CuentaLista[] | null>(null);
  const [pagos, setPagos] = useState<MisPagos | null>(null);
  const [error, setError] = useState('');

  const cargar = () => {
    api
      .get<{ cuentas: CuentaLista[] }>('/cuentas')
      .then((r) => setCuentas(r.cuentas))
      .catch((e) => setError(msg(e)));
    api.get<MisPagos>('/mis-pagos').then(setPagos).catch(() => setPagos({ empresas: [], comprobantes: [] }));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(cargar, []);

  if (error) return <Pagina><Aviso tipo="error">{error}</Aviso></Pagina>;
  if (!cuentas || !pagos) return <Cargando />;
  const sinCorreo = Boolean(usuario?.sin_correo);
  const primerNombre = usuario?.nombre.split(' ')[0] ?? '';
  const dinero = (c: number) => formatoDinero(c, idioma);
  // El menú de tres puntos del inicio, igual de completo con o sin cuentas (candado C-MENUS-COMPLETOS-1).
  // Cerrar sesión va al final y separado; borrar el usuario NO va aquí (vive en «Mi perfil»).
  const menu = (
    <MenuPuntos
      opciones={[
        { texto: t('home.refresh'), icono: <RefreshCw className="h-4 w-4" />, onClick: cargar },
        ...(sinCorreo ? [] : [{ texto: t('home.newAccount'), icono: <Plus className="h-4 w-4" />, onClick: () => navigate('/accounts/new') }]),
        { texto: t('nav.profile'), icono: <UserRound className="h-4 w-4" />, onClick: () => navigate('/profile') },
        { texto: t('nav.help'), icono: <LifeBuoy className="h-4 w-4" />, onClick: () => navigate('/help') },
        { texto: t('nav.guides'), icono: <BookOpen className="h-4 w-4" />, onClick: () => navigate(idioma === 'es' ? '/es/docs' : '/docs') },
        { texto: t('nav.signOut'), icono: <LogOut className="h-4 w-4" />, onClick: () => void salir(), separado: true },
      ]}
    />
  );

  // Primera vez: sin negocios ni pagos. Dos caminos claros.
  if (cuentas.length === 0 && pagos.empresas.length === 0 && pagos.comprobantes.length === 0) {
    return (
      <Pagina angosta>
        <div className="mb-4 flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold">{t('home.hi', { name: primerNombre })}</h1>
          {menu}
        </div>
        <p className="mb-3 text-tenue">{t('home.welcome')}</p>
        <div className="space-y-3">
          {!sinCorreo && (
            <Link to="/accounts/new" className="block">
              <Tarjeta className="flex items-start gap-3 hover:border-marca">
                <Building2 className="mt-0.5 h-6 w-6 shrink-0 text-marca" aria-hidden />
                <div>
                  <p className="font-semibold">{t('home.optOwner')}</p>
                  <p className="text-sm text-tenue">{t('home.optOwnerText')}</p>
                </div>
              </Tarjeta>
            </Link>
          )}
          <Link to="/access" className="block">
            <Tarjeta className="flex items-start gap-3 hover:border-marca">
              <KeyRound className="mt-0.5 h-6 w-6 shrink-0 text-marca-2" aria-hidden />
              <div>
                <p className="font-semibold">{t('home.optCode')}</p>
                <p className="text-sm text-tenue">{t('home.optCodeText')}</p>
              </div>
            </Tarjeta>
          </Link>
        </div>
      </Pagina>
    );
  }

  const total = cuentas.reduce((s, c) => s + c.total_cent, 0);
  const pendientes = cuentas.reduce((s, c) => s + c.pendientes, 0);
  const conPendientes = cuentas.find((c) => c.pendientes > 0);
  const ultimoPago = (nombre: string) => pagos.comprobantes.find((k) => k.cuenta_nombre === nombre)?.creado_en ?? null;
  const fechaLarga = (ms: number) => new Date(ms).toLocaleDateString(idioma === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium' });
  const titulo = 'mb-2 mt-6 px-1 text-sm font-semibold uppercase tracking-wider text-gray-300';

  return (
    <Pagina angosta>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-tenue">{t('home.hello')}</p>
          <h1 className="truncate text-xl font-bold">{primerNombre}</h1>
        </div>
        {menu}
      </div>

      {cuentas.length > 0 && (
        <>
          <div className="rounded-2xl border border-green-700/50 bg-green-900/20 p-5" data-testid="total-cuentas">
            <p className="text-xs uppercase tracking-wider text-green-300">{t('home.totalAll')}</p>
            <p className={`font-mono text-3xl font-bold ${total < 0 ? 'text-red-400' : ''}`}>{total < 0 ? `-${dinero(-total)}` : dinero(total)}</p>
            <p className="text-xs text-tenue">{t('home.accountsN', { n: cuentas.length })}</p>
          </div>
          {pendientes > 0 && conPendientes && (
            <Link to={`/accounts/${conPendientes.id}/review`} className="mt-3 flex items-center gap-3 rounded-xl border border-amber-700/60 bg-amber-950/30 p-4">
              <ListChecks className="h-6 w-6 shrink-0 text-amber-300" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-amber-200">{t('home.toReviewN', { n: pendientes })}</p>
                <p className="text-xs text-tenue">{t('home.toReviewText')}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-amber-300" aria-hidden />
            </Link>
          )}
        </>
      )}

      {(cuentas.length > 0 || !sinCorreo) && <h2 className={titulo}>{t('home.yourAccounts')}</h2>}
      <div className="space-y-2">
        {cuentas.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-800/70 hover:border-green-600">
            <Link to={`/accounts/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-green-700/50 bg-green-900/40">
                <Wallet className="h-5 w-5 text-green-400" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{c.nombre}</span>
                <span className={`block text-xs ${c.pendientes > 0 ? 'text-amber-300' : 'text-gray-500'}`}>
                  {c.pendientes > 0 ? t('home.pending', { n: c.pendientes }) : t('home.upToDate')}
                  {c.rol === 'validador' ? ` · ${t('home.validator')}` : ''}
                </span>
              </span>
              <span className={`font-mono font-semibold ${c.total_cent < 0 ? 'text-red-400' : 'text-green-400'}`}>{dinero(c.total_cent)}</span>
            </Link>
            <MenuPuntos
              opciones={[
                { texto: c.pendientes > 0 ? `${t('mov.toReview')} (${c.pendientes})` : t('mov.toReview'), icono: <ListChecks className="h-4 w-4" />, onClick: () => navigate(`/accounts/${c.id}/review`) },
                { texto: t('account.payLink'), icono: <QrCode className="h-4 w-4" />, onClick: () => navigate(`/accounts/${c.id}/link`) },
                { texto: t('clients.title'), icono: <Users className="h-4 w-4" />, onClick: () => navigate(`/accounts/${c.id}/clients`) },
                { texto: t('home.openAccount'), icono: <ChevronRight className="h-4 w-4" />, onClick: () => navigate(`/accounts/${c.id}`) },
              ]}
            />
          </div>
        ))}
        {cuentas.length === 0 && !sinCorreo && (
          <Tarjeta className="flex flex-col items-center gap-2 py-6 text-center">
            <Wallet className="h-10 w-10 text-green-400" aria-hidden />
            <p className="font-semibold">{t('home.firstAccount')}</p>
            <p className="text-sm text-tenue">{t('home.firstAccountText')}</p>
          </Tarjeta>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {!sinCorreo && (
          <Link to="/accounts/new">
            <Boton className="w-full">
              <Plus className="h-4 w-4" aria-hidden /> {t('home.newAccount')}
            </Boton>
          </Link>
        )}
        <Link to="/access" className={sinCorreo ? 'col-span-2' : ''}>
          <Boton variante="secundario" className="w-full !px-3">
            <KeyRound className="h-4 w-4" aria-hidden /> {t('home.haveCode')}
          </Boton>
        </Link>
      </div>

      {pagos.empresas.length > 0 && (
        <>
          <h2 className={titulo}>{t('home.whoIPay')}</h2>
          <div className="space-y-2">
            {pagos.empresas.map((e) => {
              const ultimo = ultimoPago(e.nombre);
              return (
                <div key={e.link_slug} className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/70 p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-700/50 bg-blue-900/40">
                    <Send className="h-5 w-5 text-blue-300" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{e.nombre}</span>
                    <span className="block text-xs text-tenue">{ultimo ? t('home.lastPayment', { date: fechaLarga(ultimo) }) : t('home.noPaymentsYet')}</span>
                  </span>
                  <Link to={`/pay/${e.link_slug}`}>
                    <Boton className="!px-3 !py-1.5 text-sm">
                      <Upload className="h-4 w-4" aria-hidden /> {t('home.pay')}
                    </Boton>
                  </Link>
                </div>
              );
            })}
          </div>
        </>
      )}

      {pagos.comprobantes.length > 0 && (
        <>
          <h2 className={titulo}>{t('home.sentPayments')}</h2>
          <div className="divide-y divide-borde rounded-2xl border border-borde bg-panel">
            {pagos.comprobantes.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Receipt className="h-4 w-4 shrink-0 text-tenue" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{k.cuenta_nombre}</p>
                    <p className="truncate text-xs text-tenue">
                      {new Date(k.creado_en).toLocaleString(idioma === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                      {k.confirmacion ? ` · ${k.confirmacion}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-mono text-sm">{dinero(k.monto_cent)}</span>
                  <Estado estado={k.estado} />
                </div>
              </div>
            ))}
          </div>
        </>
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
