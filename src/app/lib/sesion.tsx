import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type Usuario } from './api';
import { limpiarBorradores } from './borrador';
import { useI18n } from './i18n';

interface Ctx {
  usuario: Usuario | null;
  cargando: boolean;
  recargar: () => Promise<void>;
  salir: () => Promise<void>;
}

const Sesion = createContext<Ctx | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const { setIdioma } = useI18n();

  const recargar = useCallback(async () => {
    try {
      const r = await api.get<{ usuario: Usuario | null }>('/yo');
      setUsuario(r.usuario);
    } catch {
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    api
      .get<{ usuario: Usuario | null }>('/yo')
      .then((r) => vivo && setUsuario(r.usuario))
      .catch(() => undefined)
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (usuario) setIdioma(usuario.idioma);
    // Solo al entrar: luego manda lo que la persona elija en el selector.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  const salir = useCallback(async () => {
    try {
      await api.post('/auth/salir');
    } catch {
      /* si el aviso falla, se sale igual */
    }
    limpiarBorradores();
    // Carga completa: que ningún menú quede como si la sesión siguiera viva.
    window.location.assign('/');
  }, []);

  return <Sesion.Provider value={{ usuario, cargando, recargar, salir }}>{children}</Sesion.Provider>;
}

export function useSesion(): Ctx {
  const c = useContext(Sesion);
  if (!c) throw new Error('useSesion fuera de SesionProvider');
  return c;
}
