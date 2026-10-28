import { MoreVertical } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../lib/i18n';

export interface Opcion {
  texto: string;
  icono: ReactNode;
  onClick: () => void;
  peligro?: boolean;
}

/** Menú de tres puntos: lo destructivo vive aquí, nunca suelto a la vista. */
export function MenuPuntos({ opciones }: { opciones: Opcion[] }) {
  const { t } = useI18n();
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
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-label={t('common.more')}
        aria-expanded={abierto}
        className="rounded-lg p-2 text-tenue hover:bg-white/5 hover:text-white"
      >
        <MoreVertical className="h-5 w-5" />
      </button>
      {abierto && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-60 rounded-xl border border-borde bg-panel p-1.5 shadow-xl">
          {opciones.map((o) => (
            <button
              key={o.texto}
              role="menuitem"
              onClick={() => {
                setAbierto(false);
                o.onClick();
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-white/5 ${o.peligro ? 'text-red-300' : ''}`}
            >
              {o.icono}
              {o.texto}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
