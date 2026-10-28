import { ChevronDown, LogOut, Trash2, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { useSesion } from '../lib/sesion';
import { SelectorIdioma } from './SelectorIdioma';

function MenuCuenta() {
  const { usuario, salir } = useSesion();
  const { t } = useI18n();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);
  if (!usuario) return null;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold text-white hover:bg-white/5"
      >
        <UserRound className="h-4 w-4" aria-hidden />
        <span className="max-w-[8rem] truncate">{usuario.nombre.split(' ')[0]}</span>
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
      {abierto && (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-borde bg-panel p-1.5 shadow-xl">
          <p className="truncate px-3 py-2 text-xs text-tenue">{usuario.email}</p>
          <button onClick={() => void salir()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-white/5">
            <LogOut className="h-4 w-4" aria-hidden /> {t('nav.signOut')}
          </button>
          <Link
            to="/delete-account"
            onClick={() => setAbierto(false)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-red-300 hover:bg-white/5"
          >
            <Trash2 className="h-4 w-4" aria-hidden /> {t('nav.deleteUser')}
          </Link>
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { usuario } = useSesion();
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-borde bg-fondo/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2.5">
          <Link to={usuario ? '/home' : '/'} className="flex items-center gap-2 font-bold">
            <img src="/icon.png" alt="" className="h-8 w-8 rounded-lg" />
            FinTwin
          </Link>
          <div className="flex items-center gap-1">
            <SelectorIdioma conSesion={Boolean(usuario)} />
            {usuario ? (
              <MenuCuenta />
            ) : (
              <Link to="/login" className="rounded-md px-2 py-1.5 text-sm font-semibold hover:bg-white/5">
                {t('nav.signIn')}
              </Link>
            )}
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-borde px-4 py-6 text-center text-xs text-tenue">
        <p className="mb-2 space-x-4">
          <a href="https://windoce.com/privacy/" target="_blank" rel="noopener noreferrer" className="hover:text-white">
            {t('footer.privacy')}
          </a>
          <Link to="/delete-account" className="hover:text-white">
            {t('footer.delete')}
          </Link>
        </p>
        <p>
          © {new Date().getFullYear()} fintwin.windoce.com | {t('footer.rights')}{' '}
          <a href="https://windoce.com" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-white hover:underline">
            Windoce LLC
          </a>
        </p>
      </footer>
    </div>
  );
}
