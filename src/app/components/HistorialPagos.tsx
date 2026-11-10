import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatoDinero } from '../../shared/reglas';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { plataformaBonita } from './Comprobantes';

export interface PagoEnviado {
  id: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  monto_cent: number;
  confirmacion: string | null;
  creado_en: number;
  revisado_en: number | null;
  link_slug: string;
  plataforma: string | null;
  motivo: string | null;
}

/**
 * Las capturas que esta persona ya envió por ESTE link, con su estado: en proceso (barra gris),
 * procesado (verde, con el tipo de pago y su número) o no aprobado (rojo, con el motivo).
 * Mientras haya alguna en proceso se vuelve a mirar cada 30 segundos (solo lectura).
 * Candado C-HISTORIAL-PAGADOR-1.
 */
export function HistorialPagos({ slug, version = 0 }: { slug: string; version?: number }) {
  const { t, idioma } = useI18n();
  const [pagos, setPagos] = useState<PagoEnviado[] | null>(null);

  useEffect(() => {
    let vivo = true;
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const cargar = () => {
      api
        .get<{ comprobantes: PagoEnviado[] }>('/mis-pagos')
        .then((r) => {
          if (!vivo) return;
          const mios = r.comprobantes.filter((k) => k.link_slug === slug);
          setPagos(mios);
          if (mios.some((k) => k.estado === 'pendiente')) reloj = setTimeout(cargar, 30_000);
        })
        .catch(() => vivo && setPagos((p) => p ?? []));
    };
    cargar();
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [slug, version]);

  if (!pagos || pagos.length === 0) return null;
  const fecha = (ms: number) => new Date(ms).toLocaleString(idioma === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <section className="mt-8" data-testid="historial-pagos">
      <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wider text-gray-300">{t('history.title')}</h2>
      <ul className="space-y-2">
        {pagos.map((k) => {
          const tipo = plataformaBonita(k.plataforma) ?? t('history.payment');
          const dinero = <span className="font-mono font-bold">{formatoDinero(k.monto_cent, idioma)}</span>;
          if (k.estado === 'aprobado') {
            return (
              <li key={k.id} className="rounded-xl border border-green-700/60 bg-green-900/25 p-3" data-estado="aprobado">
                <p className="flex items-center gap-2 font-semibold text-green-300">
                  <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden /> {t('history.done')}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-green-950">
                  <div className="h-full w-full bg-exito" />
                </div>
                <p className="mt-2 flex justify-between gap-2 text-sm">
                  <span>{tipo}</span>
                  {dinero}
                </p>
                {k.confirmacion && (
                  <p className="text-sm text-tenue">
                    {t('history.id')}: <span className="font-mono text-white">{k.confirmacion}</span>
                  </p>
                )}
                <p className="text-xs text-tenue">{fecha(k.revisado_en ?? k.creado_en)}</p>
              </li>
            );
          }
          if (k.estado === 'rechazado') {
            return (
              <li key={k.id} className="rounded-xl border border-red-700/60 bg-red-900/20 p-3" data-estado="rechazado">
                <p className="flex items-center gap-2 font-semibold text-red-300">
                  <XCircle className="h-5 w-5 shrink-0" aria-hidden /> {t('history.rejected')}
                </p>
                <p className="mt-2 flex justify-between gap-2 text-sm">
                  <span>{tipo}</span>
                  {dinero}
                </p>
                {k.confirmacion && (
                  <p className="text-sm text-tenue">
                    {t('history.id')}: <span className="font-mono">{k.confirmacion}</span>
                  </p>
                )}
                {k.motivo && <p className="mt-1 text-sm text-red-200">{t('history.reason')}: {k.motivo}</p>}
                <p className="text-xs text-tenue">{fecha(k.revisado_en ?? k.creado_en)}</p>
              </li>
            );
          }
          return (
            <li key={k.id} className="rounded-xl border border-borde bg-white/5 p-3" data-estado="pendiente">
              <p className="flex items-center gap-2 font-semibold text-gray-200">
                <Clock className="h-5 w-5 shrink-0 text-tenue" aria-hidden /> {t('history.inProcess')}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={t('history.inProcess')}>
                <div className="h-full w-1/3 animate-[enproceso_1.6s_ease-in-out_infinite] rounded-full bg-gray-400" />
              </div>
              <p className="mt-2 flex justify-between gap-2 text-sm">
                <span>{tipo}</span>
                {dinero}
              </p>
              {k.confirmacion && (
                <p className="text-sm text-tenue">
                  {t('history.id')}: <span className="font-mono">{k.confirmacion}</span>
                </p>
              )}
              <p className="text-xs text-tenue">
                {t('history.sentOn')} {fecha(k.creado_en)}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
