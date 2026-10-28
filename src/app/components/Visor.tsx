import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useI18n } from '../lib/i18n';

/** Visor de la captura DENTRO de la app (nunca en otra pestaña: en el celular atrapa a la persona). */
export function Visor({ id, onCerrar }: { id: string | null; onCerrar: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    if (!id) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [id, onCerrar]);
  if (!id) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-3" onClick={onCerrar} role="dialog" aria-modal="true">
      <button onClick={onCerrar} aria-label={t('common.close')} className="absolute right-3 top-3 rounded-full bg-white/10 p-2 text-white">
        <X className="h-6 w-6" />
      </button>
      <img src={`/datos/archivo/${id}`} alt={t('account.viewReceipt')} className="max-h-full max-w-full rounded-lg object-contain" />
    </div>
  );
}
