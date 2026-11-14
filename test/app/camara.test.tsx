/* eslint-disable security/detect-non-literal-fs-filename -- la prueba solo lee el propio código de src/app */
import { fireEvent, render, screen } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotonCamara, SubirOFoto } from '../../src/app/components/BotonCamara';
import { I18nProvider } from '../../src/app/lib/i18n';

afterEach(() => vi.unstubAllGlobals());

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

// C-CAMARA-1 (regla global del 9 nov 2026): toda casilla de imagen ofrece «Tomar foto».
describe('cámara en toda casilla de imagen', () => {
  it('cada casilla para subir imagen tiene su «Tomar foto» al lado (si una queda sin cámara, rojo)', () => {
    const sinCamara: string[] = [];
    for (const f of archivos(join(__dirname, '../../src/app'))) {
      if (f.endsWith('BotonCamara.tsx')) continue;
      const s = readFileSync(f, 'utf8');
      const casillas = (s.match(/type="file"[^>]*accept="image/g) ?? []).length + (s.match(/accept="image[^"]*"[^>]*type="file"/g) ?? []).length;
      const camaras = (s.match(/<(SubirOFoto|BotonCamara)\b/g) ?? []).length;
      if (casillas > camaras) sinCamara.push(`${f.split('src/app/')[1]}: ${casillas} casilla(s), ${camaras} cámara(s)`);
    }
    expect(sinCamara).toEqual([]);
  });

  it('se encuentran las cuatro casillas conocidas (link de pago, registrar, ticket y ayuda)', () => {
    const conCamara = archivos(join(__dirname, '../../src/app')).filter((f) => /<(SubirOFoto|BotonCamara)\b/.test(readFileSync(f, 'utf8')));
    const nombres = conCamara.map((f) => f.split('/').pop());
    expect(nombres).toEqual(expect.arrayContaining(['Publicas.tsx', 'Account.tsx', 'TicketConIA.tsx', 'Ayuda.tsx']));
  });

  it('muestra los dos botones: «Subir desde archivos» y «Tomar foto»', () => {
    const onArchivos = vi.fn();
    render(<I18nProvider inicial="es"><SubirOFoto onArchivos={onArchivos} onFoto={() => undefined} /></I18nProvider>);
    fireEvent.click(screen.getByText('Subir desde archivos'));
    expect(onArchivos).toHaveBeenCalled();
    expect(screen.getByText('Tomar foto')).toBeTruthy();
  });

  it('en el celular abre la cámara trasera y entrega la foto a la casilla de siempre', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('coarse'), addEventListener() {}, removeEventListener() {} }));
    const onFoto = vi.fn();
    render(<I18nProvider inicial="es"><BotonCamara onFoto={onFoto} /></I18nProvider>);
    const input = screen.getByTestId('camara-sistema') as HTMLInputElement;
    expect(input.getAttribute('capture')).toBe('environment');
    const abrir = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByText('Tomar foto'));
    expect(abrir).toHaveBeenCalled();
    const foto = new File([new Uint8Array([1, 2, 3])], 'foto.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [foto] } });
    expect(onFoto).toHaveBeenCalledWith(foto);
  });

  it('sin cámara lo dice en palabras, sin ventana en blanco', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: undefined });
    render(<I18nProvider inicial="es"><BotonCamara onFoto={() => undefined} /></I18nProvider>);
    fireEvent.click(screen.getByText('Tomar foto'));
    expect(screen.getByRole('alert').textContent).toMatch(/No pudimos abrir la cámara/);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('en la computadora abre la cámara web en una ventanita con «Capturar»', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] }));
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia } });
    render(<I18nProvider inicial="es"><BotonCamara onFoto={() => undefined} /></I18nProvider>);
    fireEvent.click(screen.getByText('Tomar foto'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(getUserMedia).toHaveBeenCalled();
    expect(screen.getByText('Capturar')).toBeTruthy();
    fireEvent.click(screen.getByText('Cancelar'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
