import { test, expect } from '@playwright/test';

test.describe('@critical GDD Manager - Sync crítico', () => {
  test.beforeEach(async ({ page, context }) => {
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
      { name: 'gdd_locale', value: 'pt-BR', domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
    ]);

    await page.route('**/api/projects/sync', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('deve enviar sync sem refresh após criar projeto e seções', async ({ page }) => {
    const syncPayloads: any[] = [];

    await page.unroute('**/api/projects/sync');
    await page.route('**/api/projects/sync', async (route) => {
      if (route.request().method() === 'POST') {
        const data = route.request().postDataJSON();
        syncPayloads.push(data);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/projects');

    await page.getByPlaceholder('Nome do projeto').fill('Projeto Sync E2E');
    await page.getByPlaceholder('Descrição').fill('Teste de sincronização sem refresh');
    await page.getByPlaceholder('Nome do projeto').blur();
    await page.getByRole('button', { name: 'Salvar Projeto' }).click();

    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/projects\/.+/);

    const projectIdFromUrl = page.url().split('/projects/')[1];

    await page.getByPlaceholder('Nova seção').fill('Seção E2E');
    await page.getByRole('button', { name: 'Adicionar' }).first().click();

    await expect.poll(() => syncPayloads.length, { timeout: 10000 }).toBeGreaterThan(0);

    const hasProjectPayload = syncPayloads.some((payload) => payload?.project?.id === projectIdFromUrl);
    expect(hasProjectPayload).toBeTruthy();

  });

  test('deve manter dados locais após reload', async ({ page }) => {
    await page.goto('/projects');

    await page.getByPlaceholder('Nome do projeto').fill('Projeto Reload E2E');
    await page.getByPlaceholder('Descrição').fill('Persistência após reload');
    await page.getByPlaceholder('Nome do projeto').blur();
    await page.getByRole('button', { name: 'Salvar Projeto' }).click();

    await page.waitForURL(/\/projects\/[^/]+/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/projects\/.+/);
    await page.reload();

    await expect(page.getByRole('heading', { level: 1, name: 'Projeto Reload E2E' })).toBeVisible();
  });
});
