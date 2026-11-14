import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { api } from '../../src/app/lib/api';
import { I18nProvider } from '../../src/app/lib/i18n';
import { SesionProvider } from '../../src/app/lib/sesion';
import { Pay } from '../../src/app/pages/Publicas';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

// C-TIPO-PAGO-1: el selector de tipo de pago del link, con «Otro» escrito a mano.
describe('selector de tipo de pago en el link', () => {
  it('ofrece Zelle, bolívares, dólares… y «Otro» pide escribir cuál; se envía con la captura', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (p: string) => {
      if (p === '/yo') return { usuario: { id: 'u1', email: null, nombre: 'Ana', idioma: 'es', sin_correo: true } } as never;
      if (p === '/mis-pagos') return { empresas: [], comprobantes: [] } as never;
      return { valido: true, nombre: 'Tienda Centro', lectura_ia: false, exigir_confirmacion: true } as never;
    });
    const form = vi.spyOn(api, 'form').mockResolvedValue({ lectura: { monto_cent: 1000, confirmacion: 'AB123456' } } as never);
    render(
      <I18nProvider inicial="es">
        <SesionProvider>
          <MemoryRouter initialEntries={['/pay/abcdefabcdef']}>
            <Routes>
              <Route path="/pay/:slug" element={<Pay />} />
            </Routes>
          </MemoryRouter>
        </SesionProvider>
      </I18nProvider>,
    );
    const selector = (await screen.findByTestId('tipo-pago')) as HTMLSelectElement;
    const opciones = Array.from(selector.options).map((o) => o.textContent);
    expect(opciones).toEqual(expect.arrayContaining(['Zelle', 'Bolívares (Pago Móvil o transferencia)', 'Dólares (efectivo o transferencia)', 'Otro']));
    expect(screen.queryByTestId('tipo-pago-otro')).toBeNull();
    await userEvent.selectOptions(selector, 'otro');
    expect(screen.getByTestId('tipo-pago-otro')).toBeInTheDocument();

    const foto = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'c.png', { type: 'image/png' });
    await userEvent.upload(screen.getByTestId('archivo'), foto);
    await userEvent.type(screen.getByPlaceholderText('Monto que pagaste'), '10');
    await userEvent.type(screen.getByPlaceholderText('0000000000'), 'AB123456');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /Enviar/ }));
    expect(await screen.findByText('Escribe qué tipo de pago usaste.')).toBeInTheDocument();
    expect(form).not.toHaveBeenCalled();

    await userEvent.type(screen.getByTestId('tipo-pago-otro'), 'Binance');
    await userEvent.click(screen.getByRole('button', { name: /Enviar/ }));
    await waitFor(() => expect(form).toHaveBeenCalled());
    const enviado = form.mock.calls[0]![1] as FormData;
    expect(enviado.get('tipo_pago')).toBe('otro');
    expect(enviado.get('tipo_pago_otro')).toBe('Binance');
  });
});
