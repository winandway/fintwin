import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Turnstile } from '../../src/app/components/Turnstile';
import { I18nProvider } from '../../src/app/lib/i18n';

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.turnstile;
});

// C-TURNSTILE-1: el recuadro de Cloudflare se pinta con la clave del sitio y en el idioma elegido en FinTwin.
describe('recuadro anti-robots', () => {
  it('se pinta en español cuando la app está en español y se quita al salir', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ turnstile_site_key: 'clave-sitio' }))));
    const renderTs = vi.fn(() => 'w1');
    const remove = vi.fn();
    window.turnstile = { render: renderTs, reset: vi.fn(), remove };
    const onToken = vi.fn();
    const r = render(
      <I18nProvider inicial="es">
        <Turnstile onToken={onToken} />
      </I18nProvider>,
    );
    await waitFor(() => expect(renderTs).toHaveBeenCalledTimes(1));
    expect(renderTs.mock.calls[0]).toEqual([expect.any(HTMLElement), expect.objectContaining({ sitekey: 'clave-sitio', language: 'es' })]);
    r.unmount();
    expect(remove).toHaveBeenCalledWith('w1');
  });
});
