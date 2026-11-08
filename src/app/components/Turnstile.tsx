import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (t: string) => void; 'expired-callback': () => void; theme: string; language: string },
      ) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

let configPromesa: Promise<string | null> | null = null;
function siteKey(): Promise<string | null> {
  configPromesa ??= fetch('/datos/config')
    .then((r) => r.json() as Promise<{ turnstile_site_key: string | null }>)
    .then((c) => c.turnstile_site_key)
    .catch(() => null);
  return configPromesa;
}

/** Escudo anti-robots. Si no está configurado, no aparece y el formulario funciona igual. */
export function Turnstile({ onToken }: { onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [key, setKey] = useState<string | null>(null);
  // El recuadro habla el idioma elegido en FinTwin, no el del navegador; al cambiarlo se vuelve a pintar.
  const { idioma } = useI18n();
  useEffect(() => {
    void siteKey().then(setKey);
  }, []);
  useEffect(() => {
    if (!key || !ref.current) return;
    const el = ref.current;
    let id: string | undefined;
    let vivo = true;
    const pintar = () => {
      if (!vivo || !window.turnstile) return;
      id = window.turnstile.render(el, { sitekey: key, callback: onToken, 'expired-callback': () => onToken(''), theme: 'dark', language: idioma });
    };
    if (window.turnstile) pintar();
    else {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      s.async = true;
      s.onload = pintar;
      document.head.appendChild(s);
    }
    return () => {
      vivo = false;
      if (id) window.turnstile?.remove(id);
      onToken('');
    };
  }, [key, onToken, idioma]);
  if (!key) return null;
  return <div ref={ref} className="min-h-[65px]" />;
}
