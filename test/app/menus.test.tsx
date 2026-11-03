import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../../src/app/lib/api';
import { I18nProvider } from '../../src/app/lib/i18n';
import { SesionProvider } from '../../src/app/lib/sesion';
import { Home } from '../../src/app/pages/Home';

afterEach(() => vi.restoreAllMocks());

function respuestas(usuario: Record<string, unknown>, cuentas: unknown[]) {
  vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
    if (ruta === '/yo') return { usuario } as never;
    if (ruta === '/cuentas') return { cuentas } as never;
    return { empresas: [], comprobantes: [] } as never;
  });
}

function montar() {
  return render(
    <I18nProvider inicial="es">
      <SesionProvider>
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      </SesionProvider>
    </I18nProvider>,
  );
}

const yo = { id: 'u1', nombre: 'Laura Gómez', email: 'laura@ejemplo.com', idioma: 'es' };
const cuenta = { id: 'c1', nombre: 'Demo Store', rol: 'dueno', total_cent: 1000, pendientes: 0, comision_pct: 0, link_slug: 'abc' };

// Candado C-MENUS-COMPLETOS-1: el menú de tres puntos del inicio lleva todo (no solo Actualizar y Cerrar
// sesión), y borrar el usuario sigue fuera de él.
describe('menú de tres puntos del inicio', () => {
  it.each([
    ['con cuentas', [cuenta]],
    ['la primera vez, sin cuentas', []],
  ])('está completo %s', async (_, cuentas) => {
    respuestas(yo, cuentas);
    montar();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Más opciones' }))[0]!);
    for (const texto of ['Actualizar totales', 'Nueva cuenta', 'Mi perfil', 'Ayuda y soporte', 'Docs', 'Cerrar sesión'])
      expect(screen.getByRole('menuitem', { name: texto })).toBeInTheDocument();
    expect(screen.queryByText('Borrar mi usuario')).not.toBeInTheDocument();
  });

  it('a quien entró con un código no le ofrece crear un negocio', async () => {
    respuestas({ ...yo, email: null, sin_correo: true }, [cuenta]);
    montar();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Más opciones' }))[0]!);
    expect(screen.getByRole('menuitem', { name: 'Mi perfil' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Nueva cuenta' })).not.toBeInTheDocument();
  });
});
