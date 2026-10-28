import { useCallback, useEffect, useRef, useState } from 'react';

// Todo formulario guarda lo escrito mientras se escribe y lo devuelve al volver
// (regla de la casa). Los campos sensibles (contraseñas, PIN) nunca se guardan.

const PREFIJO = 'fintwin:borrador:';

function leer<T>(llave: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIJO + llave);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function limpiarBorradores(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIJO)) localStorage.removeItem(k);
    }
  } catch {
    /* almacenamiento bloqueado: no hay nada que limpiar */
  }
}

/**
 * @param formulario nombre del formulario
 * @param dueno id del usuario (o 'anonimo') para que en una computadora compartida no se mezclen
 * @param inicial valores vacíos
 * @param sensibles campos que jamás se guardan
 */
export function useBorrador<T extends Record<string, string>>(
  formulario: string,
  dueno: string,
  inicial: T,
  sensibles: (keyof T)[] = [],
) {
  const llave = `${formulario}:${dueno}`;
  const [valores, setValores] = useState<T>(() => ({ ...inicial, ...(leer<Partial<T>>(llave) ?? {}) }));
  const [recuperado, setRecuperado] = useState(() => {
    const g = leer<Partial<T>>(llave);
    return Boolean(g && Object.values(g).some((v) => v));
  });
  const inicialRef = useRef(inicial);
  const sensiblesRef = useRef(sensibles);

  useEffect(() => {
    const t = setTimeout(() => {
      const guardar: Partial<T> = {};
      for (const [k, v] of Object.entries(valores) as [keyof T, string][]) {
        if (!sensiblesRef.current.includes(k)) guardar[k] = v as T[keyof T];
      }
      try {
        if (Object.values(guardar).some((v) => v)) localStorage.setItem(PREFIJO + llave, JSON.stringify(guardar));
        else localStorage.removeItem(PREFIJO + llave);
      } catch {
        /* sin almacenamiento: el formulario sigue funcionando */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [valores, llave]);

  const set = useCallback((campo: keyof T, valor: string) => setValores((v) => ({ ...v, [campo]: valor })), []);

  /** Al guardar con éxito o cancelar a propósito. */
  const limpiar = useCallback(() => {
    try {
      localStorage.removeItem(PREFIJO + llave);
    } catch {
      /* nada */
    }
    setValores(inicialRef.current);
    setRecuperado(false);
  }, [llave]);

  return { valores, set, limpiar, recuperado, descartarAviso: () => setRecuperado(false) };
}
