import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useI18n, type Idioma } from '../lib/i18n';

function Bandera({ idioma }: { idioma: Idioma }) {
  // Español = bandera de España; inglés = Estados Unidos.
  return idioma === 'es' ? (
    <svg viewBox="0 0 30 20" className="h-3.5 w-5 rounded-[2px]" aria-hidden>
      <rect width="30" height="20" fill="#AA151B" />
      <rect y="5" width="30" height="10" fill="#F1BF00" />
    </svg>
  ) : (
    <svg viewBox="0 0 38 20" className="h-3.5 w-5 rounded-[2px]" aria-hidden>
      <rect width="38" height="20" fill="#B22234" />
      {[1, 3, 5, 7, 9, 11].map((i) => (
        <rect key={i} y={(i * 20) / 13} width="38" height={20 / 13} fill="#fff" />
      ))}
      <rect width="15.2" height={(20 * 7) / 13} fill="#3C3B6E" />
    </svg>
  );
}

const OPCIONES: { id: Idioma; texto: string }[] = [
  { id: 'en', texto: 'English - EN' },
  { id: 'es', texto: 'español - ES' },
];

/** Selector estilo Amazon: bandera + código + flechita, y una ventanita con radios. */
export function SelectorIdioma({ conSesion }: { conSesion: boolean }) {
  const { idioma, setIdioma, t } = useI18n();
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

  function elegir(i: Idioma) {
    setIdioma(i);
    setAbierto(false);
    if (conSesion) void api.post('/yo/idioma', { idioma: i }).catch(() => undefined);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={t('lang.title')}
        className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm font-bold text-white ${abierto ? 'border-white' : 'border-transparent hover:border-white'}`}
      >
        <Bandera idioma={idioma} />
        {idioma.toUpperCase()}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
      {abierto && (
        <div role="dialog" aria-label={t('lang.title')} className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white p-3 text-gray-900 shadow-xl">
          <span className="absolute -top-1.5 right-5 h-3 w-3 rotate-45 border-l border-t border-gray-200 bg-white" aria-hidden />
          <p className="mb-2 text-sm font-semibold">{t('lang.title')}</p>
          {OPCIONES.map((o, i) => (
            <label key={o.id} className={`flex cursor-pointer items-center gap-2.5 py-2 text-sm ${i > 0 ? 'border-t border-gray-200' : ''}`}>
              <input type="radio" name="idioma" checked={idioma === o.id} onChange={() => elegir(o.id)} className="h-4 w-4 accent-orange-500" />
              <Bandera idioma={o.id} />
              {o.texto}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
