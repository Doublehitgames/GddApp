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

  test('deve abrir página de criação manual de projeto', async ({ page }) => {
    // O link /projects fica dentro do dropdown "+ Novo projeto"
    await page.getByRole('button', { name: /Novo projeto/i }).click();
    await page.locator('a[href="/projects"]').first().click();
    await expect(page).toHaveURL('/projects');
    await expect(page.getByRole('heading', { name: /Wizard de Criação Manual/i })).toBeVisible();
    await expect(page.getByText(/Passo 1 de/i)).toBeVisible();
  });
});
