import { expect, test } from '@playwright/test';

// Humo en vivo: las rutas principales responden 200 y el escudo anti-robots aparece en la entrada.
const RUTAS = ['/', '/login', '/signup', '/forgot', '/docs', '/es/docs', '/docs/sign-in-security-check', '/es/docs/sign-in-security-check', '/docs/seguridad-entrar-en.png', '/docs/seguridad-registro-es.png'];

for (const ruta of RUTAS) {
  test(`responde 200: ${ruta}`, async ({ request }) => {
    const r = await request.get(ruta);
    expect(r.status()).toBe(200);
  });
}

test('el canario dice que el escudo y las variables están bien', async ({ request }) => {
  const s = await (await request.get('/datos/salud')).json();
  expect(s.ok).toBe(true);
  expect(s.piezas.turnstile).toBe('ok');
  expect(s.piezas.variables).toBe('ok');
});

for (const ruta of ['/login', '/signup']) {
  test(`el escudo de Cloudflare aparece en ${ruta}`, async ({ page }) => {
    await page.goto(ruta);
    // El recuadro va dentro de una capa cerrada: se busca entre los marcos de la página, no en el HTML.
    await expect
      .poll(() => page.frames().filter((f) => f.url().includes('challenges.cloudflare.com')).length, { timeout: 30_000 })
      .toBeGreaterThan(0);
  });
}

test('la guía del escudo se ve en español', async ({ page }) => {
  await page.goto('/es/docs/sign-in-security-check');
  await expect(page.getByRole('heading', { name: 'La verificación de seguridad al entrar' })).toBeVisible();
});

// C-GOOGLE-PLAY-1: el distintivo oficial se ve en la portada y lleva a la ficha de Play.
test('el botón de Google Play aparece en la portada y lleva a la ficha', async ({ page, request }) => {
  await page.goto('/');
  const boton = page.getByTestId('google-play').first();
  await expect(boton).toBeVisible();
  expect(await boton.getAttribute('href')).toContain('play.google.com/store/apps/details?id=com.windoce.ingresos');
  const html = await (await request.get('/')).text();
  expect(html).toContain('play.google.com/store/apps/details?id=com.windoce.ingresos');
  for (const l of ['en', 'es']) expect((await request.get(`/google-play-${l}.png`)).status()).toBe(200);
});
