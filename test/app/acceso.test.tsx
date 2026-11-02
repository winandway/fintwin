import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { api, ApiError } from '../../src/app/lib/api';
import { I18nProvider } from '../../src/app/lib/i18n';
import { SesionProvider } from '../../src/app/lib/sesion';
import { Access } from '../../src/app/pages/Acceso';
import { SignUp } from '../../src/app/pages/Auth';
import { Pay } from '../../src/app/pages/Publicas';

afterEach(() => vi.restoreAllMocks());

function montar(ruta: string, elemento: ReactNode, path: string, idioma: 'en' | 'es' = 'es') {
  return render(
    <I18nProvider inicial={idioma}>
      <SesionProvider>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path={path} element={elemento} />
            <Route path="/home" element={<p>inicio</p>} />
          </Routes>
        </MemoryRouter>
      </SesionProvider>
    </I18nProvider>,
  );
}

describe('entrar con código de acceso', () => {
  it('quien revisa escribe el código, crea su PIN y entra a la cuenta', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ usuario: null } as never);
    const ir = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign: ir });
    const post = vi.spyOn(api, 'post').mockImplementation(async (p: string) => {
      if (p === '/acceso/ver') return { cuenta_nombre: 'Tienda Centro', nombre: 'Rita Gómez', rol: 'validador', pide_pin: true } as never;
      return { destino: '/accounts/c1' } as never;
    });
    montar('/access?codigo=abcd2345', <Access />, '/access');
    const campo = await screen.findByLabelText('Código de acceso');
    expect(campo).toHaveValue('ABCD-2345');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Hola, Rita. Vas a revisar y aprobar los comprobantes de Tienda Centro.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Crea tu PIN/), '4321');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(ir).toHaveBeenCalledWith('/accounts/c1'));
    expect(post).toHaveBeenLastCalledWith('/acceso/entrar', { codigo: 'ABCD-2345', pin: '4321', idioma: 'es' });
    vi.unstubAllGlobals();
  });

  it('un código que no sirve se dice en palabras', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ usuario: null } as never);
    vi.spyOn(api, 'post').mockRejectedValue(new ApiError(400, 'codigo_acceso_invalido', {}));
    montar('/access', <Access />, '/access');
    await userEvent.type(await screen.findByLabelText('Código de acceso'), 'zzzz9999');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText(/Pídele uno nuevo al negocio/)).toBeInTheDocument();
  });
});

describe('crear la cuenta del dueño', () => {
  it('después de registrarse escribe el código del correo ahí mismo, sin salir de la app', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ usuario: null } as never);
    const post = vi.spyOn(api, 'post').mockResolvedValue({ ok: true } as never);
    montar('/signup', <SignUp />, '/signup', 'en');
    await userEvent.type(await screen.findByLabelText('Your name'), 'Ana Owner');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText(/^Password/), 'clave-segura-1');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText(/We sent a 6-digit code to ana@example.com/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Code from the email'), '12a3456');
    expect(screen.getByLabelText('Code from the email')).toHaveValue('123456');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm my email' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/auth/confirmar-codigo', { email: 'ana@example.com', codigo: '123456' }));
    expect(await screen.findByText('inicio')).toBeInTheDocument();
  });
});

describe('link de pago sin cuenta', () => {
  it('pide solo el nombre, sin correo ni contraseña', async () => {
    let conSesion = false;
    vi.spyOn(api, 'get').mockImplementation(async (p: string) => {
      if (p === '/yo') return { usuario: conSesion ? { id: 'g1', email: null, nombre: 'Ana', idioma: 'es', sin_correo: true } : null } as never;
      return { valido: true, nombre: 'Tienda Centro', lectura_ia: false } as never;
    });
    const post = vi.spyOn(api, 'post').mockImplementation(async () => {
      conSesion = true;
      return { ok: true } as never;
    });
    montar('/pay/abcdefabcdef', <Pay />, '/pay/:slug');
    expect(await screen.findByText(/No necesitas cuenta ni contraseña/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Correo')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Tu nombre'), 'Ana Pago');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/pagar/abcdefabcdef/invitado', { nombre: 'Ana Pago', idioma: 'es' }));
    expect(await screen.findByText('Toma o elige la foto de tu captura')).toBeInTheDocument();
  });
});
