import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; 'expired-callback': () => void; theme: string }) => string;
      reset: (id?: string) => void;
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
  useEffect(() => {
    void siteKey().then(setKey);
  }, []);
  useEffect(() => {
    if (!key || !ref.current) return;
    const el = ref.current;
    const pintar = () => window.turnstile?.render(el, { sitekey: key, callback: onToken, 'expired-callback': () => onToken(''), theme: 'dark' });
    if (window.turnstile) {
      pintar();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    s.onload = pintar;
    document.head.appendChild(s);
  }, [key, onToken]);
  if (!key) return null;
  return <div ref={ref} className="min-h-[65px]" />;
}
