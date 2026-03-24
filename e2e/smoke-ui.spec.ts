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
    ]);

    await page.goto('/');
  });

  test('deve carregar home e ações rápidas', async ({ page }) => {
    await expect(page).toHaveTitle(/GDD App/i);
    await expect(page.getByRole('heading', { level: 1, name: 'GDD Manager' })).toBeVisible();
    await expect(page.getByRole('button', { name: '🤖 Create GDD with AI' })).toBeVisible();
    await expect(page.getByRole('button', { name: '✨ Import Document (AI optional)' })).toBeVisible();
  });

  test('deve abrir página de criação manual de projeto', async ({ page }) => {
    await page.locator('a[href="/projects"]').first().click();
    await expect(page).toHaveURL('/projects');
    await expect(page.getByRole('heading', { name: 'Create Project' })).toBeVisible();
    await expect(page.getByPlaceholder('Project name')).toBeVisible();
  });
});
