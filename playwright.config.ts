import { defineConfig } from '@playwright/test';

// Pruebas de punta a punta contra el sitio publicado (o el que diga FINTWIN_URL).
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 1,
  use: { baseURL: process.env.FINTWIN_URL ?? 'https://fintwin.windoce.com', viewport: { width: 390, height: 844 } },
});
