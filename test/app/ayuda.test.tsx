import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { api, ApiError } from '../../src/app/lib/api';
import { buscarGuias, GUIAS, rutaDocs } from '../../src/app/lib/docs';
import { I18nProvider } from '../../src/app/lib/i18n';
import { SesionProvider } from '../../src/app/lib/sesion';
import { Help } from '../../src/app/pages/Ayuda';
import { DocsGuia, DocsIndex } from '../../src/app/pages/Docs';

afterEach(() => vi.restoreAllMocks());

const USUARIO = { id: 'u1', email: 'ana@example.com', nombre: 'Ana', idioma: 'en' as const };

function montar(ruta: string, elemento: ReactNode, path: string) {
  return render(
    <I18nProvider inicial="en">
      <SesionProvider>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path={path} element={elemento} />
          </Routes>
        </MemoryRouter>
      </SesionProvider>
    </I18nProvider>,
  );
}

describe('pantalla Ayuda', () => {
  it('manda el caso con sus capturas y no borra lo escrito si falla el envío', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (p: string) => (p === '/yo' ? { usuario: USUARIO } : { casos: [] }) as never);
    const form = vi
      .spyOn(api, 'form')
      .mockRejectedValueOnce(new ApiError(0, 'sin_conexion', {}))
      .mockResolvedValueOnce({ id: 'abc', numero: 'ABC12345' } as never);
    montar('/help', <Help />, '/help');
    await screen.findByText('You have no cases yet.');
    expect(screen.getByText(/soporte\+fintwin@windoce\.com/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Subject'), 'Missing receipt');
    await userEvent.type(screen.getByLabelText('Message'), 'It does not show up.');
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'shot.png', { type: 'image/png' });
    await userEvent.upload(screen.getByTestId('adjuntos'), png);
    expect(screen.getByText('shot.png')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText(/No connection/)).toBeInTheDocument();
    expect(screen.getByLabelText('Subject')).toHaveValue('Missing receipt');

    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText(/Case ABC12345 sent/)).toBeInTheDocument();
    const enviado = form.mock.calls[1]![1];
    expect(form.mock.calls[1]![0]).toBe('/casos');
    expect(enviado.get('asunto')).toBe('Missing receipt');
    expect((enviado.getAll('adjuntos') as File[]).map((f) => f.name)).toEqual(['shot.png']);
    expect(screen.getByLabelText('Subject')).toHaveValue('');
  });

  it('guarda el borrador mientras se escribe', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(api, 'get').mockImplementation(async (p: string) => (p === '/yo' ? { usuario: USUARIO } : { casos: [] }) as never);
    montar('/help', <Help />, '/help');
    await userEvent.type(await screen.findByLabelText('Subject'), 'Hola');
    act(() => vi.advanceTimersByTime(600));
    await waitFor(() => expect(localStorage.getItem('fintwin:borrador:caso-nuevo:u1')).toContain('Hola'));
    vi.useRealTimers();
  });
});

describe('Docs', () => {
  it('cada guía tiene inglés y español completos y el buscador encuentra sin acentos', () => {
    for (const g of GUIAS) {
      expect(g.cuerpo.en.length).toBe(g.cuerpo.es.length);
      expect(g.titulo.es).not.toBe(g.titulo.en);
    }
    expect(buscarGuias('caso numero', 'es').map((g) => g.slug)).toEqual(['help-cases']);
    expect(buscarGuias('codigo de acceso', 'es').map((g) => g.slug)).toEqual(['team-access-codes']);
    expect(buscarGuias('CAPTURAS ayuda', 'es')).toHaveLength(1);
    expect(buscarGuias('zzz', 'en')).toEqual([]);
    expect(rutaDocs('es', 'help-cases')).toBe('/es/docs/help-cases');
    expect(rutaDocs('en')).toBe('/docs');
  });

  it('la guía en español vive en /es y el menú izquierdo sigue ahí con la guía resaltada', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ usuario: null } as never);
    montar('/es/docs/help-cases', <DocsGuia />, '/es/docs/:slug');
    expect(await screen.findByRole('heading', { level: 1, name: 'Pide ayuda dentro de la app' })).toBeInTheDocument();
    const activos = screen.getAllByRole('link', { name: 'Pide ayuda dentro de la app' });
    expect(activos[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '← Docs' })).toHaveAttribute('href', '/es/docs');
  });

  it('la portada de Docs filtra mientras se escribe', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ usuario: null } as never);
    montar('/docs', <DocsIndex />, '/docs');
    await userEvent.type(screen.getByLabelText('Search the guides'), 'nothing like this');
    expect(screen.getByText('No guide matches your search.')).toBeInTheDocument();
  });
});
