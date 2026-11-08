import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

// Red simulada (msw): ninguna prueba de pantallas puede salir a internet ni a la base real.
// Una llamada que nadie simuló hace fallar la prueba en vez de pasar en silencio.
export const red = setupServer();
beforeAll(() => red.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  cleanup();
  localStorage.clear();
  red.resetHandlers();
});
afterAll(() => red.close());
