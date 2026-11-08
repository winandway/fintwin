import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { BotonGooglePlay, FICHA_GOOGLE_PLAY } from '../../src/app/components/GooglePlay';
import { I18nProvider } from '../../src/app/lib/i18n';

afterEach(() => {
  delete window.ReactNativeWebView;
});

// C-GOOGLE-PLAY-1: el distintivo oficial lleva a la ficha de Play, en el idioma elegido.
describe('botón de Google Play', () => {
  it('en inglés: «Get it on Google Play» y lleva a la ficha de com.windoce.ingresos', () => {
    render(<I18nProvider inicial="en"><BotonGooglePlay /></I18nProvider>);
    const img = screen.getByAltText('Get it on Google Play');
    expect(img.getAttribute('src')).toBe('/google-play-en.png');
    const a = screen.getByTestId('google-play');
    expect(a.getAttribute('href')).toBe(`${FICHA_GOOGLE_PLAY}&hl=en`);
    expect(FICHA_GOOGLE_PLAY).toBe('https://play.google.com/store/apps/details?id=com.windoce.ingresos');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toContain('noopener');
  });

  it('en español: «Disponible en Google Play», con su imagen en español', () => {
    render(<I18nProvider inicial="es"><BotonGooglePlay /></I18nProvider>);
    expect(screen.getByAltText('Disponible en Google Play').getAttribute('src')).toBe('/google-play-es.png');
    expect(screen.getByTestId('google-play').getAttribute('href')).toContain('hl=es');
  });

  it('dentro de la app del celular no se muestra', () => {
    window.ReactNativeWebView = { postMessage: () => undefined };
    render(<I18nProvider inicial="es"><BotonGooglePlay /></I18nProvider>);
    expect(screen.queryByTestId('google-play')).toBeNull();
  });

  it('las imágenes oficiales existen y son PNG', () => {
    for (const l of ['en', 'es']) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- ruta fija del repo
      const b = readFileSync(`public/google-play-${l}.png`);
      expect(b.subarray(1, 4).toString()).toBe('PNG');
    }
  });
});

describe('enlace a Google Play en el HTML del servidor', () => {
  it('index.html lleva la ficha de Play sin necesitar JavaScript', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('https://play.google.com/store/apps/details?id=com.windoce.ingresos');
    expect(html).toContain('Get it on Google Play');
    expect(html).toContain('Disponible en Google Play');
  });
});
