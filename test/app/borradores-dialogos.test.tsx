import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { api } from '../../src/app/lib/api';
import { I18nProvider } from '../../src/app/lib/i18n';
import { SesionProvider } from '../../src/app/lib/sesion';
import { Review } from '../../src/app/pages/Revisar';

afterEach(() => vi.restoreAllMocks());

const USUARIO = { id: 'u1', email: 'ana@example.com', nombre: 'Ana', idioma: 'en' as const };
const PENDIENTE = {
  id: 'k1', tipo: 'ingreso', estado: 'pendiente', monto_cent: 1500, comision_cent: 0, fecha_pago: null, confirmacion: 'ABC123',
  pagador: null, beneficiario: null, motivo: null, comercio: null, categoria: null, lectura: null, tiene_archivo: 0,
  creado_en: 1, revisado_en: null, subido_por_nombre: null, revisado_por_nombre: null,
};

function montar() {
  return render(
    <I18nProvider inicial="en">
      <SesionProvider>
        <MemoryRouter initialEntries={['/accounts/c1/review']}>
          <Routes>
            <Route path="/accounts/:id/review" element={<Review />} />
          </Routes>
        </MemoryRouter>
      </SesionProvider>
    </I18nProvider>,
  );
}

// Regla de la casa: ningún formulario pierde lo escrito. El motivo del rechazo vuelve si se cierra la pantalla;
// el PIN nunca se guarda; al rechazar con éxito el borrador se borra.
describe('borrador del motivo de rechazo', () => {
  it('guarda el motivo, lo devuelve al volver y lo borra al rechazar', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (p: string) =>
      (p === '/yo' ? { usuario: USUARIO } : p.includes('comprobantes') ? { comprobantes: [PENDIENTE] } : { cuenta: { nombre: 'Tienda' } }) as never,
    );
    const post = vi.spyOn(api, 'post').mockResolvedValue({ hechos: ['k1'], ya_revisados: 0 } as never);
    const u = userEvent.setup();
    const r = montar();
    await u.click(await screen.findByRole('checkbox', { name: /Select receipt/ }));
    await u.click(screen.getByRole('button', { name: /Reject \(1\)/ }));
    await u.type(screen.getByLabelText(/Reason for rejection/), 'Monto distinto');
    await u.type(screen.getByLabelText(/PIN/), '1234');
    await act(() => new Promise((ok) => setTimeout(ok, 600)));
    const guardado = localStorage.getItem('fintwin:borrador:rechazo-c1:u1');
    expect(guardado).toBe('{"motivo":"Monto distinto"}');
    expect(guardado).not.toContain('1234');

    r.unmount();
    montar();
    // En la app la pantalla va detrás de ConSesion: se espera a que la sesión cargue, como allí.
    await act(() => new Promise((ok) => setTimeout(ok, 50)));
    await u.click(await screen.findByRole('checkbox', { name: /Select receipt/ }));
    await u.click(screen.getByRole('button', { name: /Reject \(1\)/ }));
    expect(screen.getByLabelText(/Reason for rejection/)).toHaveValue('Monto distinto');
    await u.type(screen.getByLabelText(/PIN/), '1234');
    await u.click(screen.getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/cuentas/c1/revisar', expect.objectContaining({ motivo: 'Monto distinto' })));
    await waitFor(() => expect(localStorage.getItem('fintwin:borrador:rechazo-c1:u1')).toBeNull());
  });
});

describe('borrador cuando la sesión carga después de abrir el formulario', () => {
  it('trae el borrador del dueño en vez de pisarlo con vacío, y respeta lo ya escrito', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { useBorrador } = await import('../../src/app/lib/borrador');
    localStorage.setItem('fintwin:borrador:nota:u1', JSON.stringify({ nota: 'Lo de ayer', otro: '' }));
    const h = renderHook(({ dueno }) => useBorrador('nota', dueno, { nota: '', otro: '' }), { initialProps: { dueno: 'anonimo' } });
    expect(h.result.current.valores.nota).toBe('');
    act(() => h.result.current.set('otro', 'recién escrito'));
    h.rerender({ dueno: 'u1' });
    expect(h.result.current.valores).toEqual({ nota: 'Lo de ayer', otro: 'recién escrito' });
    expect(h.result.current.recuperado).toBe(true);
    await act(() => new Promise((ok) => setTimeout(ok, 600)));
    expect(JSON.parse(localStorage.getItem('fintwin:borrador:nota:u1')!)).toEqual({ nota: 'Lo de ayer', otro: 'recién escrito' });
  });
});
