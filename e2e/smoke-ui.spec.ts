import { test, expect } from '@playwright/test';

test.describe('@smoke GDD Manager - Smoke UI', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([
      {
        name: 'e2e-bypass-auth',
        value: '1',
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
      // Pina o idioma para as asserções não dependerem do locale do browser
      {
        name: 'gdd_locale',
        value: 'pt-BR',
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    await page.goto('/');
  });

  test('deve carregar home e ações rápidas', async ({ page }) => {
    await expect(page).toHaveTitle(/GDD App/i);
    await expect(page.getByRole('heading', { level: 1, name: 'GDD Manager' })).toBeVisible();
    // CTAs da barra de ações secundárias (sempre visíveis na home)
    await expect(page.getByRole('link', { name: /Criar GDD com IA/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Importar Documento/i }).first()).toBeVisible();
  });

  test('deve abrir a criação de projeto (só o nome)', async ({ page }) => {
    await page.getByRole('button', { name: /Novo projeto/i }).first().click();
    await page.getByRole('button', { name: /Novo projeto em branco/i }).click();
    await expect(page.getByRole('heading', { name: /Como o jogo se chama/i })).toBeVisible();
    await expect(page.getByPlaceholder('Nome do jogo')).toBeVisible();
  });
});
