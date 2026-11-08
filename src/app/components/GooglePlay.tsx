import { useI18n } from '../lib/i18n';
import { esApp } from '../lib/nativo';

/** Ficha oficial de FinTwin en Google Play (paquete com.windoce.ingresos). */
export const FICHA_GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=com.windoce.ingresos';

/**
 * Distintivo oficial «Get it on Google Play» / «Disponible en Google Play», sin modificar
 * (normas de marca de Google: imagen original, sin recolorear ni deformar, alto mínimo legible
 * y enlace directo a la ficha). Dentro de la app del celular no se muestra: ya la tiene.
 * Candado C-GOOGLE-PLAY-1.
 */
export function BotonGooglePlay({ alto = 48 }: { alto?: number }) {
  const { idioma } = useI18n();
  if (esApp()) return null;
  const es = idioma === 'es';
  return (
    <a
      href={`${FICHA_GOOGLE_PLAY}&hl=${es ? 'es' : 'en'}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      data-testid="google-play"
    >
      <img
        src={es ? '/google-play-es.png' : '/google-play-en.png'}
        alt={es ? 'Disponible en Google Play' : 'Get it on Google Play'}
        style={{ height: alto, width: 'auto' }}
        loading="lazy"
      />
    </a>
  );
}
