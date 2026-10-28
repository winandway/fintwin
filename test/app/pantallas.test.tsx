import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CampoClave } from '../../src/app/components/CampoClave';
import { CaptureGuide } from '../../src/app/components/CaptureGuide';
import { SelectorIdioma } from '../../src/app/components/SelectorIdioma';
import { useBorrador } from '../../src/app/lib/borrador';
import { I18nProvider } from '../../src/app/lib/i18n';
import type { ReactNode } from 'react';

const conIdioma = (idioma: 'en' | 'es') => ({ children }: { children: ReactNode }) => <I18nProvider inicial={idioma}>{children}</I18nProvider>;

describe('borrador de formularios', () => {
  it('guarda lo escrito, lo devuelve al volver y nunca guarda lo sensible', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useBorrador('prueba', 'u1', { nombre: '', clave: '' }, ['clave']));
    act(() => {
      result.current.set('nombre', 'Ana');
      result.current.set('clave', 'secreta');
    });
    act(() => vi.advanceTimersByTime(600));
    unmount();
    expect(localStorage.getItem('fintwin:borrador:prueba:u1')).toBe('{"nombre":"Ana"}');

    const otra = renderHook(() => useBorrador('prueba', 'u1', { nombre: '', clave: '' }, ['clave']));
    expect(otra.result.current.valores).toEqual({ nombre: 'Ana', clave: '' });
    expect(otra.result.current.recuperado).toBe(true);

    // Otro usuario en la misma computadora no ve el borrador ajeno.
    const ajeno = renderHook(() => useBorrador('prueba', 'u2', { nombre: '', clave: '' }, ['clave']));
    expect(ajeno.result.current.valores.nombre).toBe('');

    act(() => otra.result.current.limpiar());
    expect(localStorage.getItem('fintwin:borrador:prueba:u1')).toBeNull();
    vi.useRealTimers();
  });
});

describe('campo de contraseña', () => {
  it('arranca oculto y el ojito lo muestra', async () => {
    render(<CampoClave etiqueta="Password" defaultValue="abc" />, { wrapper: conIdioma('en') });
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });
});

describe('selector de idioma', () => {
  it('es estilo Amazon, con España para el español y Escape lo cierra', async () => {
    render(<SelectorIdioma conSesion={false} />, { wrapper: conIdioma('en') });
    await userEvent.click(screen.getByRole('button', { name: 'Change language' }));
    expect(screen.getByText('English - EN')).toBeInTheDocument();
    expect(screen.getByText('español - ES')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('español - ES'));
    expect(screen.getByRole('button', { name: 'Cambiar idioma' })).toHaveTextContent('ES');
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar idioma' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('English - EN')).not.toBeInTheDocument();
  });
});

describe('guía de la captura', () => {
  it('resalta el número de confirmación y pasa a rojo cuando faltó', () => {
    const { rerender } = render(<CaptureGuide payeeName="Sucursal Centro" />, { wrapper: conIdioma('es') });
    expect(screen.getByText('Sucursal Centro')).toBeInTheDocument();
    expect(screen.getByText(/Sin él, la captura no entra/)).toBeInTheDocument();
    rerender(<CaptureGuide payeeName="Sucursal Centro" alert />);
    expect(screen.getByText('Tu captura tiene que verse así')).toBeInTheDocument();
  });
});
