// Puente con la app de celular (iPhone/Android). En el navegador no hace nada.
declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (m: string) => void };
  }
}

export type MensajeNativo =
  | { tipo: 'sesion'; conectado: boolean }
  | { tipo: 'compartir'; texto: string; url: string };

export function esApp(): boolean {
  return typeof window !== 'undefined' && Boolean(window.ReactNativeWebView);
}

export function alNativo(m: MensajeNativo): void {
  window.ReactNativeWebView?.postMessage(JSON.stringify(m));
}

const LLAVE_TOKEN = 'fintwin:push-token';

export function tokenGuardado(): string | null {
  try {
    return localStorage.getItem(LLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function guardarToken(t: string | null): void {
  try {
    if (t) localStorage.setItem(LLAVE_TOKEN, t);
    else localStorage.removeItem(LLAVE_TOKEN);
  } catch {
    /* sin almacenamiento */
  }
}

/** Compartir con el menú del celular; en el navegador usa el de la web si existe. */
export async function compartir(texto: string, url: string): Promise<boolean> {
  if (esApp()) {
    alNativo({ tipo: 'compartir', texto, url });
    return true;
  }
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({ text: texto, url });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
