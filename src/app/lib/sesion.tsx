import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type Usuario } from './api';
import { limpiarBorradores } from './borrador';
import { alNativo, esApp, guardarToken, tokenGuardado } from './nativo';
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

  // En la app de celular: al entrar se pide permiso de avisos y el celular manda su token.
  useEffect(() => {
    if (!esApp() || cargando) return;
    alNativo({ tipo: 'sesion', conectado: Boolean(usuario) });
    if (!usuario) return;
    const alToken = (e: Event) => {
      const detalle = (e as CustomEvent<{ token: string; plataforma: 'ios' | 'android' }>).detail;
      if (!detalle?.token) return;
      guardarToken(detalle.token);
      void api.post('/yo/dispositivo', detalle).catch(() => undefined);
    };
    window.addEventListener('fintwin-push', alToken);
    return () => window.removeEventListener('fintwin-push', alToken);
  }, [usuario, cargando]);

  const salir = useCallback(async () => {
    // Este celular deja de recibir avisos de la cuenta que se cierra.
    const token = tokenGuardado();
    if (token) {
      await api.post('/yo/dispositivo/quitar', { token }).catch(() => undefined);
      guardarToken(null);
    }
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
