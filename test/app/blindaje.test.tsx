/* eslint-disable security/detect-non-literal-fs-filename -- la prueba solo recorre la carpeta src/app del propio repo */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { red } from './setup';

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

describe('blindaje de las pantallas', () => {
  it('una llamada de red que nadie simuló falla, no sale a internet', async () => {
    await expect(fetch('https://servicio-real.example.com/cobrar')).rejects.toThrow();
  });

  it('las llamadas simuladas con msw sí responden', async () => {
    red.use(http.get('https://simulado.example.com/ok', () => HttpResponse.json({ ok: true })));
    const r = await fetch('https://simulado.example.com/ok');
    expect(await r.json()).toEqual({ ok: true });
  });

  // Regla de la casa: toda contraseña o PIN pasa por CampoClave (con su ojito). Ningún campo de clave suelto.
  it('no hay ningún campo de contraseña fuera de CampoClave', () => {
    const sueltos = archivos('src/app').filter(
      (f) => !f.endsWith('CampoClave.tsx') && /type=["'{]+password/.test(readFileSync(f, 'utf8')),
    );
    expect(sueltos).toEqual([]);
  });
});
