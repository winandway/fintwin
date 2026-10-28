import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { useI18n } from '../lib/i18n';

export function Boton({
  variante = 'primario',
  cargando = false,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' | 'peligro' | 'fantasma'; cargando?: boolean }) {
  const estilos = {
    primario: 'bg-marca text-[#05210f] hover:brightness-110',
    secundario: 'bg-panel border border-borde text-white hover:border-tenue',
    peligro: 'bg-problema text-white hover:brightness-110',
    fantasma: 'text-tenue hover:text-white',
  }[variante];
  return (
    <button
      {...rest}
      disabled={rest.disabled || cargando}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${estilos} ${className}`}
    >
      {cargando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  error,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string; error?: boolean }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-white">{etiqueta}</span>
      <input
        {...rest}
        aria-invalid={error || undefined}
        className={`w-full rounded-xl border bg-[#0d1528] px-4 py-3 text-white placeholder:text-tenue/60 outline-none focus:border-marca ${error ? 'border-problema' : 'border-borde'}`}
      />
      {ayuda && <span className="block text-xs text-tenue">{ayuda}</span>}
    </label>
  );
}

export function Aviso({ tipo, children }: { tipo: 'error' | 'exito' | 'info'; children: ReactNode }) {
  const estilos = {
    error: 'border-problema/50 bg-problema/10 text-red-200',
    exito: 'border-exito/50 bg-exito/10 text-green-200',
    info: 'border-borde bg-panel text-tenue',
  }[tipo];
  const Icono = tipo === 'exito' ? CheckCircle2 : AlertCircle;
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`flex gap-2 rounded-xl border px-3 py-2.5 text-sm ${estilos}`}>
      <Icono className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function AvisoBorrador({ visible, onEmpezar }: { visible: boolean; onEmpezar: () => void }) {
  const { t } = useI18n();
  if (!visible) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-tenue" data-testid="aviso-borrador">
      {t('draft.recovered')}
      <button type="button" onClick={onEmpezar} className="font-semibold text-marca underline-offset-2 hover:underline">
        {t('draft.startOver')}
      </button>
    </p>
  );
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-borde bg-panel p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function Modal({ abierto, onCerrar, titulo, children }: { abierto: boolean; onCerrar: () => void; titulo: string; children: ReactNode }) {
  const { t } = useI18n();
  useEffect(() => {
    if (!abierto) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-borde bg-panel p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button onClick={onCerrar} aria-label={t('common.close')} className="rounded-lg p-1 text-tenue hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Cargando() {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-tenue">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {t('common.loading')}
    </div>
  );
}

export function Pagina({ children, angosta = false }: { children: ReactNode; angosta?: boolean }) {
  return <main className={`mx-auto w-full px-4 py-6 ${angosta ? 'max-w-md' : 'max-w-3xl'}`}>{children}</main>;
}
