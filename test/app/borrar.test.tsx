import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from '../../src/app/components/Layout';
import { api } from '../../src/app/lib/api';
import { I18nProvider } from '../../src/app/lib/i18n';
import { SesionProvider } from '../../src/app/lib/sesion';
import { DeleteAccount } from '../../src/app/pages/Publicas';

afterEach(() => vi.restoreAllMocks());

const yo = { usuario: { id: 'u1', nombre: 'Laura Gómez', email: 'laura@ejemplo.com', idioma: 'es' } };

function montar(el: React.ReactNode) {
  return render(
    <I18nProvider inicial="es">
      <SesionProvider>
        <MemoryRouter>{el}</MemoryRouter>
      </SesionProvider>
    </I18nProvider>,
  );
}

// Candado C-BORRAR-LEJOS-1: borrar el usuario nunca va pegado a «Cerrar sesión» y pide escribir BORRAR.
describe('borrar el usuario', () => {
  it('el menú del nombre tiene «Cerrar sesión» pero NO «Borrar mi usuario»', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(yo as never);
    montar(<Layout><p>contenido</p></Layout>);
    await userEvent.click(await screen.findByRole('button', { name: /Laura/ }));
    expect(screen.getByText('Cerrar sesión')).toBeInTheDocument();
    expect(screen.getByText('Mi perfil')).toBeInTheDocument();
    expect(screen.queryByText('Borrar mi usuario')).not.toBeInTheDocument();
  });

  it('no se puede borrar sin escribir BORRAR, aunque la contraseña esté puesta', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(yo as never);
    const post = vi.spyOn(api, 'post').mockResolvedValue({ ok: true } as never);
    montar(<DeleteAccount />);
    await userEvent.type(await screen.findByLabelText(/^Contraseña/), 'clave-segura-1');
    const boton = screen.getByRole('button', { name: 'Borrar mi usuario' });
    expect(boton).toBeDisabled();
    await userEvent.type(screen.getByTestId('palabra-borrar'), 'borra');
    expect(boton).toBeDisabled();
    await userEvent.type(screen.getByTestId('palabra-borrar'), 'r');
    expect(boton).toBeEnabled();
    await userEvent.click(boton);
    expect(post).toHaveBeenCalledWith('/yo/borrar', { clave: 'clave-segura-1', confirmar: 'borrar' });
  });
});
