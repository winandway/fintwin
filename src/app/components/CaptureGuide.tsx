import { CheckCircle2, Hash, ReceiptText } from 'lucide-react';
import { useI18n } from '../lib/i18n';

/**
 * Cómo tiene que verse la captura: una de muestra, igual para cualquier banco o app,
 * con el número de confirmación resaltado (verde; en rojo cuando faltó).
 */
export function CaptureGuide({ payeeName, alert = false }: { payeeName: string; alert?: boolean }) {
  const { t } = useI18n();
  const ring = alert ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50';
  return (
    <div
      className={`space-y-3 rounded-2xl border p-4 ${alert ? 'border-red-800 bg-red-950/20' : 'border-borde bg-panel'}`}
      data-testid="capture-guide"
    >
      <p className="text-sm font-semibold">{alert ? t('guide.titleAlert') : t('guide.title')}</p>
      <div className="mx-auto max-w-[260px] overflow-hidden rounded-xl bg-white text-gray-900 shadow-lg" aria-hidden="true">
        <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-100 px-4 py-2">
          <ReceiptText className="h-4 w-4 text-gray-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t('guide.card')}</span>
        </div>
        <div className="space-y-2 px-4 py-3">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">{t('guide.amount')}</p>
            <p className="text-2xl font-bold">$ 0.00</p>
          </div>
          <Fila label={t('guide.date')} value={t('guide.datePh')} />
          <Fila label={t('guide.to')} value={payeeName} />
          <Fila label={t('guide.from')} value={t('guide.yourName')} />
          <div className={`mt-1 rounded-lg border-2 p-2 ${ring}`}>
            <p className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${alert ? 'text-red-600' : 'text-green-700'}`}>
              <Hash className="h-3 w-3" /> {t('guide.code')}
            </p>
            <p className="font-mono text-sm font-bold tracking-wider text-gray-900">0000000000</p>
          </div>
        </div>
      </div>
      <ul className="space-y-1.5 text-xs text-gray-300">
        <Consejo fuerte>{t('guide.t1')}</Consejo>
        <Consejo>{t('guide.t2')}</Consejo>
        <Consejo>{t('guide.t3')}</Consejo>
        <Consejo>{t('guide.t4')}</Consejo>
      </ul>
    </div>
  );
}

function Fila({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed border-gray-200 pb-1 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}

function Consejo({ children, fuerte = false }: { children: string; fuerte?: boolean }) {
  return (
    <li className="flex gap-2">
      <CheckCircle2 className={`h-4 w-4 shrink-0 ${fuerte ? 'text-green-400' : 'text-gray-500'}`} />
      <span className={fuerte ? 'font-medium text-white' : ''}>{children}</span>
    </li>
  );
}
