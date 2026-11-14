import { AlertTriangle, Ban, CheckCircle, CheckCircle2, Clock, Loader2, Sparkles, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatoDinero, TIPOS_PAGO, type TipoPago } from '../../shared/reglas';
import { api, type Lectura, type Uso } from '../lib/api';
import { useI18n } from '../lib/i18n';

// Piezas de la pantalla de la cuenta copiadas del FinTwin original: el punto de color de cada
// movimiento, la insignia de estado, el panel de lectura con IA y el historial de una captura.

type EstadoMov = 'pendiente' | 'aprobado' | 'rechazado';

export function fechaCorta(ms: number, idioma: 'en' | 'es', conAnio = true): string {
  return new Date(ms).toLocaleString(idioma === 'es' ? 'es-US' : 'en-US', {
    day: 'numeric',
    month: 'short',
    ...(conAnio ? { year: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * El punto de cada movimiento. Aprobado: verde; con la captura usada 1–2 veces más, amarillo; 3 o
 * más, naranja. Rechazado: rojo. Pendiente: naranja con reloj. En espera: rojo con triángulo.
 */
export function PuntoEstado({ estado, enEspera, repetidas }: { estado: EstadoMov; enEspera?: boolean; repetidas: number }) {
  const { t } = useI18n();
  let clase = 'bg-orange-500';
  let Icono = Clock;
  let titulo = t('status.pendiente');
  if (enEspera) {
    clase = 'bg-red-600';
    Icono = AlertTriangle;
    titulo = t('mov.onHold');
  } else if (estado === 'aprobado') {
    if (repetidas >= 3) {
      clase = 'bg-orange-600';
      Icono = AlertTriangle;
    } else if (repetidas >= 1) {
      clase = 'bg-yellow-500';
      Icono = AlertTriangle;
    } else {
      clase = 'bg-green-500';
      Icono = CheckCircle;
    }
    titulo = repetidas > 0 ? t('mov.approvedDup', { n: repetidas }) : t('status.aprobado');
  } else if (estado === 'rechazado') {
    clase = 'bg-red-500';
    Icono = XCircle;
    titulo = t('status.rechazado');
  }
  return (
    <span title={titulo} aria-label={titulo} data-testid="punto" data-color={clase} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${clase}`}>
      <Icono className="h-4 w-4 text-white" aria-hidden />
    </span>
  );
}

export function InsigniaEstado({ estado, enEspera }: { estado: EstadoMov; enEspera?: boolean }) {
  const { t } = useI18n();
  if (enEspera)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
        <AlertTriangle className="h-3 w-3" aria-hidden /> {t('mov.onHold')}
      </span>
    );
  const estilos = {
    aprobado: ['bg-green-500 text-white', CheckCircle],
    rechazado: ['bg-red-500 text-white', XCircle],
    pendiente: ['bg-white/10 text-tenue', Clock],
  } as const;
  const [c, I] = estilos[estado];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${c}`}>
      <I className="h-3 w-3" aria-hidden /> {t(`status.${estado}`)}
    </span>
  );
}

export function plataformaBonita(p: string | null): string | null {
  if (!p) return null;
  return { zelle: 'Zelle', zinli: 'Zinli', paypal: 'PayPal', cashapp: 'Cash App', venmo: 'Venmo', other: 'Other' }[p] ?? p;
}

/** El tipo de pago elegido en el link, en palabras: la clave traducida o lo que escribió en «Otro». */
export function tipoPagoBonito(v: string | null | undefined, t: (k: `paytype.${TipoPago}`) => string): string | null {
  if (!v) return null;
  if (v.startsWith('otro:')) return v.slice(5) || null;
  return (TIPOS_PAGO as readonly string[]).includes(v) ? t(`paytype.${v as TipoPago}`) : v;
}

/** Los datos leídos por la IA en una rejilla pequeña (De, Email, A, Plataforma, Fecha…). */
export function DatosLeidos({ l, conMonto = true }: { l: Partial<Omit<Lectura, 'estado'>> & { monto_cent?: number | null; tipo_pago?: string | null }; conMonto?: boolean }) {
  const { t, idioma } = useI18n();
  const filas: [string, string | null | undefined, boolean?][] = [
    ...(conMonto ? ([[t('read.amount'), l.monto_cent ? formatoDinero(l.monto_cent, idioma) : null]] as [string, string | null][]) : []),
    [t('read.code'), l.confirmacion, true],
    [t('read.from'), l.pagador],
    [t('read.email'), l.pagador_correo],
    [t('read.to'), l.beneficiario],
    [t('read.emailTo'), l.beneficiario_correo],
    [t('paytype.shown'), tipoPagoBonito(l.tipo_pago, t)],
    [t('read.platform'), plataformaBonita(l.plataforma ?? null)],
    [t('read.date'), l.fecha],
  ];
  const visibles = filas.filter(([, v]) => v);
  if (!visibles.length) return null;
  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-0.5 text-[11px] sm:grid-cols-2">
      {visibles.map(([k, v, mono]) => (
        <p key={k} className="truncate">
          <span className="text-tenue">{k}:</span> <span className={mono ? 'font-mono' : ''}>{v}</span>
        </p>
      ))}
    </div>
  );
}

/** El panel bajo la captura mientras la IA la lee y después: verde, amarillo o celeste tranquilizador. */
export function PanelLectura({ leyendo, lectura, pasoFinal }: { leyendo: boolean; lectura: Lectura | null; pasoFinal: string }) {
  const { t } = useI18n();
  if (leyendo)
    return (
      <div className="flex items-center gap-2 rounded-xl border border-blue-700/50 bg-blue-900/20 p-3 text-sm text-blue-200">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t('read.reading')}
      </div>
    );
  if (!lectura) return null;
  if (lectura.estado === 'failed')
    return (
      <div className="space-y-1.5 rounded-xl border border-sky-700/60 bg-sky-900/30 p-3 text-sm text-sky-100" data-testid="lectura-fallida">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-4 w-4 text-sky-300" aria-hidden /> {t('read.failedTitle')}
        </p>
        <p className="text-sky-200/90">{t('read.failedText')}</p>
        <ol className="list-decimal space-y-0.5 pl-5 text-sky-200/90">
          <li>{t('read.step1')}</li>
          <li>{t('read.step2')}</li>
          <li>{pasoFinal}</li>
        </ol>
      </div>
    );
  const exito = lectura.estado === 'success';
  return (
    <div className={`space-y-2 rounded-xl border p-3 ${exito ? 'border-green-700/50 bg-green-900/25' : 'border-yellow-700/50 bg-yellow-900/25'}`} data-testid="lectura">
      <p className={`flex items-center gap-2 text-sm font-semibold ${exito ? 'text-green-300' : 'text-yellow-300'}`}>
        {exito ? <Sparkles className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
        {exito ? t('read.success') : t('read.partial')}
      </p>
      <DatosLeidos l={lectura} />
    </div>
  );
}

/** Una línea por cada uso de la captura: «#1 — cuenta — $X — fecha — código». */
export function LineasUso({ usos, actual }: { usos: Uso[]; actual?: string }) {
  const { t, idioma } = useI18n();
  return (
    <ol className="space-y-0.5 text-[11px]">
      {usos.map((u, i) => (
        <li key={u.id} className={u.id === actual ? 'font-bold text-white' : 'opacity-80'}>
          #{i + 1} — {u.otra_cuenta ? t('dup.otherBusiness') : (u.cuenta ?? t('dup.noName'))}
          {u.monto_cent !== null ? ` — ${formatoDinero(u.monto_cent, idioma)}` : ''} — {fechaCorta(u.creado_en, idioma)} —{' '}
          <span className="font-mono">{u.confirmacion ?? (u.otra_cuenta ? '••••' : t('dup.noCode'))}</span>
          {u.estado === 'rechazado' ? ` · ${t('status.rechazado')}` : ''}
          {u.id === actual ? ` ${t('dup.this')}` : ''}
        </li>
      ))}
    </ol>
  );
}

/** El bloque «Captura repetida (N usos en total)» dentro de un movimiento abierto. */
export function HistorialRepetida({ cuentaId, movId, repetidas }: { cuentaId: string; movId: string; repetidas: number }) {
  const { t } = useI18n();
  const [usos, setUsos] = useState<Uso[] | null>(null);
  useEffect(() => {
    api
      .get<{ usos: Uso[] }>(`/cuentas/${cuentaId}/comprobantes/${movId}/usos`)
      .then((r) => setUsos(r.usos))
      .catch(() => setUsos([]));
  }, [cuentaId, movId]);
  const tono = repetidas >= 3 ? 'border-orange-700/50 bg-orange-900/20 text-orange-200' : 'border-yellow-700/50 bg-yellow-900/20 text-yellow-200';
  return (
    <div className={`space-y-1.5 rounded-xl border p-3 ${tono}`} data-testid="historial-repetida">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4" aria-hidden /> {t('dup.repeated', { n: usos?.length ?? repetidas + 1 })}
      </p>
      {usos === null ? <p className="text-xs">{t('dup.loading')}</p> : <LineasUso usos={usos} actual={movId} />}
    </div>
  );
}

/** El panel rojo «Captura duplicada» al elegir una captura que ya se usó. */
export function AvisoDuplicada({
  creadoEn,
  coincide,
  mismaCuenta,
  historial,
  onCancelar,
  onAceptar,
}: {
  creadoEn: number;
  coincide: 'imagen' | 'codigo';
  mismaCuenta: boolean;
  historial: Uso[];
  onCancelar: () => void;
  onAceptar: () => void;
}) {
  const { t, idioma } = useI18n();
  return (
    <div className="space-y-2 rounded-xl border border-red-700/60 bg-red-900/30 p-3" data-testid="aviso-duplicada">
      <p className="flex items-center gap-2 font-semibold text-red-300">
        <Ban className="h-4 w-4" aria-hidden /> {t('dup.title')}
      </p>
      <p className="text-sm text-red-200">
        {t('dup.text', { date: fechaCorta(creadoEn, idioma) })} {coincide === 'imagen' ? t('dup.sameImage') : t('dup.sameCode')}
      </p>
      {historial.length > 0 && (
        <div className="text-red-200/80">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide">{t('dup.history', { n: historial.length })}</p>
          <LineasUso usos={historial} />
        </div>
      )}
      {mismaCuenta && <p className="text-sm font-semibold text-red-200">{t('dup.sameAccount')}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancelar} className="flex-1 rounded-xl border border-borde px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/5">
          {t('common.cancel')}
        </button>
        {!mismaCuenta && (
          <button type="button" onClick={onAceptar} className="flex-1 rounded-xl bg-green-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-green-500">
            {t('dup.acceptAnyway')}
          </button>
        )}
      </div>
    </div>
  );
}
