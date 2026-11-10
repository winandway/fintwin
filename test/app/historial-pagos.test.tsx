import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistorialPagos } from '../../src/app/components/HistorialPagos';
import { I18nProvider } from '../../src/app/lib/i18n';

afterEach(() => vi.unstubAllGlobals());

const base = { monto_cent: 5000, creado_en: Date.UTC(2026, 10, 10), revisado_en: Date.UTC(2026, 10, 10), motivo: null };

// C-HISTORIAL-PAGADOR-1: en el link de pago, quien pagó ve cada captura con su estado.
describe('historial de quien paga', () => {
  it('muestra en proceso, procesado (con tipo e ID) y no aprobado (con motivo), solo de este link', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            empresas: [],
            comprobantes: [
              { ...base, id: 'a', estado: 'pendiente', confirmacion: 'P-1', link_slug: 'abcdefghijkl', plataforma: null },
              { ...base, id: 'b', estado: 'aprobado', confirmacion: 'ZL-778899', link_slug: 'abcdefghijkl', plataforma: 'zelle' },
              { ...base, id: 'c', estado: 'rechazado', confirmacion: 'R-3', link_slug: 'abcdefghijkl', plataforma: null, motivo: 'No llegó' },
              { ...base, id: 'd', estado: 'aprobado', confirmacion: 'OTRA', link_slug: 'zzzzzzzzzzzz', plataforma: null },
            ],
          }),
        ),
      ),
    );
    render(<I18nProvider inicial="es"><HistorialPagos slug="abcdefghijkl" /></I18nProvider>);
    await waitFor(() => expect(screen.getByTestId('historial-pagos')).toBeTruthy());
    expect(screen.getByText('En proceso')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.getByText('Tu pago fue procesado')).toBeTruthy();
    expect(screen.getByText('ZL-778899')).toBeTruthy();
    expect(screen.getByText('Zelle')).toBeTruthy();
    expect(screen.getByText('Tu pago no fue aprobado')).toBeTruthy();
    expect(screen.getByText(/No llegó/)).toBeTruthy();
    expect(screen.queryByText('OTRA')).toBeNull();
    // Lo que salió bien va en verde (regla global).
    expect(document.querySelector('[data-estado="aprobado"]')!.className).toContain('green');
  });

  it('sin capturas no muestra nada', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ empresas: [], comprobantes: [] })));
    vi.stubGlobal('fetch', f);
    const r = render(<I18nProvider inicial="en"><HistorialPagos slug="abcdefghijkl" /></I18nProvider>);
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(r.container.innerHTML).toBe('');
  });
});
